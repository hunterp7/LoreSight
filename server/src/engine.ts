import { randomUUID } from "node:crypto";
import { CASEWORKER, createArtifacts, getEnding } from "./content.js";
import type {
  ArtifactId,
  EndingId,
  GameState,
  IntakeAction,
  PublicGameState,
  Stage,
} from "./types.js";

const sessions = new Map<string, GameState>();

export interface AdminLegacySessionSummary {
  sessionId: string;
  worldId: "agency.applicant-intake.legacy";
  worldVersion: "prototype";
  stateVersion: number;
  status: Stage;
  startedAt: string;
  kind: "legacy";
}

const firstActions: IntakeAction[] = [
  "confirm_alive",
  "express_uncertainty",
  "refuse_status",
];

const memoryActions: IntakeAction[] = [
  "deny_previous_life",
  "admit_dejavu",
  "request_personnel_file",
];

function applicantNumber(id: string): string {
  const digits = id.replace(/\D/g, "").slice(0, 5).padEnd(5, "7");
  return `71-442-${digits}`;
}

function availableActions(state: GameState): string[] {
  if (state.stage === "orientation") return firstActions;
  if (state.stage === "memory_review") return memoryActions;
  if (state.stage === "investigation") {
    return state.artifacts
      .filter((artifact) => artifact.visible && !artifact.examined)
      .map((artifact) => `examine:${artifact.id}`);
  }
  if (state.stage === "resolution") {
    return ["retain_life", "return_life", "join_agency"];
  }
  return ["restart"];
}

function progress(state: GameState): number {
  if (state.stage === "complete") return 100;
  const base =
    state.stage === "orientation"
      ? 8
      : state.stage === "memory_review"
        ? 20
        : state.stage === "investigation"
          ? 35
          : 90;
  const evidence = state.artifacts.filter((artifact) => artifact.examined).length * 13;
  return Math.min(96, base + evidence);
}

export function publicState(state: GameState): PublicGameState {
  return {
    ...structuredClone(state),
    progress: progress(state),
    availableActions: availableActions(state),
  };
}

export function startGame(): PublicGameState {
  const id = randomUUID();
  const state: GameState = {
    playerId: id,
    applicantNumber: applicantNumber(id),
    stage: "orientation",
    stateVersion: 1,
    caseworkerLine: CASEWORKER.welcome,
    objective: "Choose the closest answer.",
    responses: [],
    artifacts: createArtifacts(),
    startedAt: new Date().toISOString(),
  };
  sessions.set(id, state);
  return publicState(state);
}

export function getGame(playerId: string): PublicGameState {
  const state = sessions.get(playerId);
  if (!state) throw new Error("Applicant record not found. It may not have happened yet.");
  return publicState(state);
}

export function listLegacySessionsForAdmin(): AdminLegacySessionSummary[] {
  return [...sessions.values()]
    .map((state) => ({
      sessionId: state.playerId,
      worldId: "agency.applicant-intake.legacy" as const,
      worldVersion: "prototype" as const,
      stateVersion: state.stateVersion,
      status: state.stage,
      startedAt: state.startedAt,
      kind: "legacy" as const,
    }))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export function getLegacySessionForAdmin(playerId: string): GameState | undefined {
  const state = sessions.get(playerId);
  return state ? structuredClone(state) : undefined;
}

export function respond(
  playerId: string,
  action: IntakeAction,
  playerWords?: string,
): PublicGameState {
  const state = sessions.get(playerId);
  if (!state) throw new Error("Applicant record not found.");

  if (state.stage === "orientation") {
    if (!firstActions.includes(action)) throw new Error("That response is not valid during mortality review.");
    state.responses.push({ action, playerWords });
    state.stage = "memory_review";
    state.caseworkerLine =
      action === "confirm_alive"
        ? CASEWORKER.alive
        : action === "express_uncertainty"
          ? CASEWORKER.uncertain
          : CASEWORKER.refused;
    state.objective = "Choose the closest answer.";
  } else if (state.stage === "memory_review") {
    if (!memoryActions.includes(action)) throw new Error("That response is not valid during memory review.");
    state.responses.push({ action, playerWords });
    state.stage = "investigation";
    state.caseworkerLine = CASEWORKER.investigate;
    state.objective = "Open the first clue.";
  } else {
    throw new Error("LoreSight is not currently accepting interview responses.");
  }

  state.stateVersion += 1;
  return publicState(state);
}

export function examineArtifact(playerId: string, artifactId: ArtifactId): PublicGameState {
  const state = sessions.get(playerId);
  if (!state) throw new Error("Applicant record not found.");
  if (state.stage !== "investigation") throw new Error("Evidence review is not currently available.");

  const artifact = state.artifacts.find((item) => item.id === artifactId);
  if (!artifact || !artifact.visible) throw new Error("That record is not available at your clearance level.");

  artifact.examined = true;
  const initialRecords = state.artifacts.slice(0, 3);
  const initialComplete = initialRecords.every((item) => item.examined);
  const finalRecord = state.artifacts.find((item) => item.id === "original-assignee");

  if (initialComplete && finalRecord && !finalRecord.visible) {
    finalRecord.visible = true;
    state.caseworkerLine = CASEWORKER.finalRecord;
    state.objective = "Open the final clue.";
  } else if (artifact.id === "original-assignee") {
    state.stage = "resolution";
    state.caseworkerLine = CASEWORKER.resolution;
    state.objective = "Choose what happens next.";
  } else {
    state.caseworkerLine = "You opened a clue. It may be connected to you.";
  }

  state.stateVersion += 1;
  return publicState(state);
}

export function chooseEnding(playerId: string, endingId: EndingId): PublicGameState {
  const state = sessions.get(playerId);
  if (!state) throw new Error("Applicant record not found.");
  if (state.stage !== "resolution") throw new Error("Your file is not complete enough to choose a disposition.");

  const ending = getEnding(endingId);
  state.ending = ending;
  state.stage = "complete";
  state.caseworkerLine = ending.caseworkerLine;
  state.objective = "Your intake is complete. Retain this record for all future lives.";
  state.stateVersion += 1;
  return publicState(state);
}

export function resetSessionsForTests(): void {
  sessions.clear();
}

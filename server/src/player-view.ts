import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StoryApplicationService } from "@storyframe/application";
import { MemoryStoryframeRepository } from "@storyframe/persistence";
import type { ArtifactView, PlayerView } from "@storyframe/projections";
import { compileStoryframe } from "@storyframe/storyframe";
import type { WorldPack } from "@storyframe/world-schema";

export type PlayerLayout = "focus" | "investigation" | "decision" | "complete";
export type PlayerIntentKind = "primary" | "inspect" | "decision";

export interface PlayerFrameView {
  kind: "default-crt" | "authored";
  preset?: "institutional" | "ornate" | "industrial" | "minimal";
  label?: string;
  mark?: string;
  colors?: { surround: string; surface: string; edge: string; accent: string };
}

export interface PlayerIntentView {
  id: string;
  title: string;
  description: string;
  kind: PlayerIntentKind;
  artifactId?: string;
}

export interface PlayerArtifactView {
  id: string;
  kind: string;
  title: string;
  shortTitle: string;
  summary: string;
  body: string[];
  stamp?: string;
  reviewed: boolean;
  visual?: { assetKey: string; altText: string; caption: string; textLines?: string[] };
}

export interface StoryframePlayerView {
  audience: "player";
  session: {
    id: string;
    worldId: string;
    worldVersion: string;
    stateVersion: number;
    status: "active" | "complete";
  };
  presentation: {
    worldTitle: string;
    identityLabel: string;
    identityValue: string;
    layout: PlayerLayout;
    stageLabel: string;
    stepLabel: string;
    headline: string;
    speakerLine: string;
    objective: string;
    progress: number;
    atmosphere: string;
    footer: string;
    frame: PlayerFrameView;
  };
  availableIntents: PlayerIntentView[];
  artifacts: PlayerArtifactView[];
  ending?: { title: string; disposition: string; certificate: string };
}

export interface SubmitStoryIntentResult {
  status: "committed" | "duplicate" | "rejected";
  view: StoryframePlayerView;
  code?: "version-conflict" | "intent-unavailable";
  message?: string;
}

export interface CharacterRecapView {
  session: StoryframePlayerView["session"];
  characters: Array<{
    id: string;
    name: string;
    role?: string;
    observations: string[];
    present: boolean;
  }>;
}

export interface WorldRecapView {
  session: StoryframePlayerView["session"];
  currentMoment: { frameId: string; title: string; objective: string };
  visibleFacts: Array<{ id: string; statement: string }>;
  releasedClues: Array<{
    id: string;
    title: string;
    summary: string;
    reviewed: boolean;
  }>;
}

const here = dirname(fileURLToPath(import.meta.url));
const agencySourcePath = resolve(here, "../../worlds/the-agency/applicant-intake.storyframe");
const agencySource = readFileSync(agencySourcePath, "utf8");
const compiledAgency = compileStoryframe(agencySource, agencySourcePath);
if (!compiledAgency.ok || !compiledAgency.world) {
  throw new Error(`LoreSight's conformance world did not compile:\n${compiledAgency.diagnostics.map((item) => item.message).join("\n")}`);
}
export const agencyWorld: WorldPack = compiledAgency.world;
const agencyHash = createHash("sha256").update(JSON.stringify(agencyWorld)).digest("hex");
const clock = { now: () => new Date().toISOString() };

let repository: MemoryStoryframeRepository;
let application: StoryApplicationService;
let releaseReady: Promise<unknown>;

function initializeApplication(): void {
  repository = new MemoryStoryframeRepository();
  application = new StoryApplicationService(repository, repository, clock);
  releaseReady = repository.publish({
    worldId: agencyWorld.manifest.id,
    worldVersion: agencyWorld.manifest.version,
    contentHash: agencyHash,
    world: agencyWorld,
    createdAt: clock.now(),
    createdBy: agencyWorld.manifest.rights.owner,
  });
}
initializeApplication();

const shortArtifactTitles: Record<string, string> = {
  "personnel-a17": "Work history",
  "elevator-1974": "Elevator log",
  "childhood-kit": "Childhood notes",
  "original-assignee": "Final note",
};

const artifactIntentIds: Record<string, string> = {
  examine_personnel_a17: "personnel-a17",
  examine_elevator_1974: "elevator-1974",
  examine_childhood_kit: "childhood-kit",
  examine_original_assignee: "original-assignee",
};

function applicantNumber(sessionId: string): string {
  const digits = sessionId.replace(/\D/g, "").slice(0, 5).padEnd(5, "7");
  return `71-442-${digits}`;
}

function frameFor(view: PlayerView) {
  return agencyWorld.frames?.find((frame) => frame.id === view.state.frameId);
}

function layoutFor(view: PlayerView): PlayerLayout {
  if (view.state.status === "complete") return "complete";
  if (view.state.frameId === "resolution") return "decision";
  if (view.state.frameId === "investigation") return "investigation";
  return "focus";
}

function stageCopy(view: PlayerView) {
  if (view.state.status === "complete") {
    return { stageLabel: "Complete", stepLabel: "Complete", headline: frameFor(view)?.title ?? "Your case is complete" };
  }
  if (view.state.frameId === "orientation") {
    return { stageLabel: "Getting started", stepLabel: "Step 1 of 2", headline: "Before we begin" };
  }
  if (view.state.frameId.startsWith("memory_")) {
    return { stageLabel: "One more question", stepLabel: "Step 2 of 2", headline: "One simple question" };
  }
  if (view.state.frameId === "investigation") {
    return { stageLabel: "Looking for answers", stepLabel: "Right now", headline: "We found something that does not match" };
  }
  return { stageLabel: "Your decision", stepLabel: "Right now", headline: "You decide what happens next" };
}

function objectiveFor(view: PlayerView): string {
  if (view.state.status === "complete") return "Your intake is complete. Retain this record for all future lives.";
  if (view.state.frameId === "orientation" || view.state.frameId.startsWith("memory_")) return "Choose the closest answer.";
  if (view.state.frameId === "resolution") return "Choose what happens next.";
  return view.artifacts.some((artifact) => artifact.id === "original-assignee")
    ? "Open the final clue."
    : "Open the visible clues.";
}

function progressFor(view: PlayerView): number {
  if (view.state.status === "complete") return 100;
  if (view.state.frameId === "orientation") return 8;
  if (view.state.frameId.startsWith("memory_")) return 20;
  if (view.state.frameId === "resolution") return 90;
  const reviewed = ["personnel-reviewed", "elevator-reviewed", "childhood-reviewed"]
    .filter((clue) => view.state.clues.includes(clue)).length;
  return Math.min(88, 35 + reviewed * 13);
}

function artifactView(artifact: ArtifactView, view: PlayerView): PlayerArtifactView {
  return {
    id: artifact.id,
    kind: artifact.kind,
    title: artifact.title,
    shortTitle: shortArtifactTitles[artifact.id] ?? artifact.title,
    summary: artifact.summary,
    body: structuredClone(artifact.textFallback),
    reviewed: artifact.clueId ? view.state.clues.includes(artifact.clueId) : false,
    visual: artifact.asset ? {
      assetKey: artifact.asset.key,
      altText: artifact.altText,
      caption: artifact.caption ?? artifact.summary,
      textLines: artifact.id === "elevator-1974" ? [
        "+-- TRANSIT TRACE / ELEVATOR-1974 --+",
        "| 08:14  [ LOBBY ENTRY ]            |",
        "|              |                     |",
        "|              +----> [ 1974 ]       |",
        "|              |      ! DUPLICATE    |",
        "|              |        APPLICANT    |",
        "| 08:15  [ LOBBY RETURN ]           |",
        "+------------------------------------+",
      ] : undefined,
    } : undefined,
  };
}

function intentView(intent: PlayerView["availableIntents"][number]): PlayerIntentView {
  const artifactId = artifactIntentIds[intent.id];
  return {
    ...intent,
    kind: artifactId ? "inspect" : ["retain_life", "return_life", "join_agency"].includes(intent.id) ? "decision" : "primary",
    artifactId,
  };
}

export function projectApplicationPlayerView(view: PlayerView): StoryframePlayerView {
  const frame = frameFor(view);
  const lines = frame?.text?.split(/\n\s*\n/).filter(Boolean) ?? [];
  const completed = view.state.status === "complete";
  return {
    audience: "player",
    session: {
      id: view.state.sessionId,
      worldId: view.state.worldId,
      worldVersion: view.state.worldVersion,
      stateVersion: view.state.stateVersion,
      status: completed ? "complete" : "active",
    },
    presentation: {
      worldTitle: "LoreSight",
      identityLabel: view.state.frameId === "orientation" || view.state.frameId.startsWith("memory_") ? "A message for you" : "Your case",
      identityValue: applicantNumber(view.state.sessionId),
      layout: layoutFor(view),
      ...stageCopy(view),
      speakerLine: lines[0] ?? "Your case remains open.",
      objective: objectiveFor(view),
      progress: progressFor(view),
      atmosphere: "Something does not match · Your case is open",
      footer: view.state.frameId === "orientation" || view.state.frameId.startsWith("memory_") ? "Take your time." : "Your choices are saved.",
      frame: agencyWorld.presentation?.playerFrame ?? { kind: "default-crt" },
    },
    availableIntents: view.availableIntents.map(intentView),
    artifacts: view.artifacts.map((artifact) => artifactView(artifact, view)),
    ending: completed ? {
      title: frame?.title ?? "Your case is complete",
      disposition: lines[0] ?? "The case is closed.",
      certificate: lines[1] ?? lines[0] ?? "The case is closed.",
    } : undefined,
  };
}

function actor(ownerId: string, scope: "read" | "write") {
  return {
    subjectId: ownerId,
    scopes: scope === "read"
      ? ["story:sessions:read" as const]
      : ["story:sessions:read" as const, "story:sessions:write" as const],
  };
}

export async function startStorySession(ownerId = "local-development"): Promise<StoryframePlayerView> {
  await releaseReady;
  const view = await application.startStory({
    actor: actor(ownerId, "write"),
    sessionId: randomUUID(),
    worldId: agencyWorld.manifest.id,
    worldVersion: agencyWorld.manifest.version,
    seed: Math.floor(Math.random() * 0xffff_ffff) || 1,
  });
  return projectApplicationPlayerView(view);
}

export async function getStoryState(
  sessionId: string,
  ownerId = "local-development",
): Promise<StoryframePlayerView> {
  await releaseReady;
  return projectApplicationPlayerView(await application.getStory(actor(ownerId, "read"), sessionId));
}

export async function getCharacterRecap(
  sessionId: string,
  ownerId = "local-development",
): Promise<CharacterRecapView> {
  await releaseReady;
  const safe = await application.getStory(actor(ownerId, "read"), sessionId);
  const session = projectApplicationPlayerView(safe).session;
  return {
    session,
    characters: agencyWorld.characters.map((character) => ({
      ...character,
      observations: safe.characterLedger
        .filter((entry) => entry.subjectId === character.id)
        .map((entry) => entry.statement),
      present: safe.state.status === "active",
    })),
  };
}

export async function getWorldRecap(
  sessionId: string,
  ownerId = "local-development",
): Promise<WorldRecapView> {
  await releaseReady;
  const safe = await application.getStory(actor(ownerId, "read"), sessionId);
  const projected = projectApplicationPlayerView(safe);
  return {
    session: projected.session,
    currentMoment: {
      frameId: safe.state.frameId,
      title: projected.presentation.headline,
      objective: projected.presentation.objective,
    },
    visibleFacts: safe.canon.map(({ id, statement }) => ({ id, statement })),
    releasedClues: projected.artifacts.map(({ id, title, summary, reviewed }) => ({
      id,
      title,
      summary,
      reviewed,
    })),
  };
}

export async function submitStoryIntent(input: {
  sessionId: string;
  intentId: string;
  expectedStateVersion: number;
  mutationId: string;
  playerWords?: string;
  ownerId?: string;
}): Promise<SubmitStoryIntentResult> {
  await releaseReady;
  const result = await application.submitIntent({
    actor: actor(input.ownerId ?? "local-development", "write"),
    sessionId: input.sessionId,
    command: {
      intentId: input.intentId,
      parameters: input.playerWords ? { playerWords: input.playerWords } : undefined,
    },
    expectedStateVersion: input.expectedStateVersion,
    mutationId: input.mutationId,
  });
  const view = projectApplicationPlayerView(result.view);
  if (result.status === "conflict") {
    return {
      status: "rejected",
      code: "version-conflict",
      message: "The story changed before that choice arrived. The latest moment has been restored.",
      view,
    };
  }
  if (result.status === "rejected") {
    const versionConflict = result.engine.status === "rejected" && result.engine.code === "version-conflict";
    return {
      status: "rejected",
      code: versionConflict ? "version-conflict" : "intent-unavailable",
      message: versionConflict
        ? "The story changed before that choice arrived. The latest moment has been restored."
        : result.engine.status === "rejected" ? result.engine.message : "That choice is not available.",
      view,
    };
  }
  return { status: result.status, view };
}

export function createMutationId(): string {
  return randomUUID();
}

export function resetPlayerViewAdapterForTests(): void {
  initializeApplication();
}

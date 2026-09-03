import { projectModelView, type ModelView } from "@storyframe/projections";
import type {
  FrameDefinition,
  GameState,
  InventionPersistence,
  NarrativeBeatDefinition,
  WorldPack,
} from "@storyframe/world-schema";

export interface PerformanceDialogue {
  speakerId: string;
  text: string;
}

export interface SessionDetailProposal {
  id: string;
  text: string;
  persistence: InventionPersistence;
}

export interface Performance {
  narration: string;
  dialogue: PerformanceDialogue[];
  completedBeatIds: string[];
  surfacedIntentIds: string[];
  proposedSessionDetails: SessionDetailProposal[];
  referencedCanonIds: string[];
}

export interface DirectorProgress {
  completedBeatIds: string[];
  acceptedSessionDetails: SessionDetailProposal[];
}

export interface DirectorRequest {
  traceId: string;
  frame: FrameDefinition;
  modelView: ModelView;
  progress: DirectorProgress;
}

export interface DirectorProvider {
  generate(request: DirectorRequest): Promise<unknown>;
}

export interface PerformanceIssue {
  code:
    | "invalid-shape"
    | "missing-exact-line"
    | "incomplete-required-beat"
    | "unknown-beat"
    | "forbidden-claim"
    | "hidden-canon-reference"
    | "unknown-canon-reference"
    | "unknown-intent"
    | "unknown-speaker"
    | "semantic-establish-failed"
    | "implied-forbidden-claim"
    | "semantic-evaluation-failed";
  message: string;
}

export interface DirectorResult {
  status: "generated" | "fallback" | "unavailable";
  traceId: string;
  attempts: number;
  performance?: Performance;
  progress: DirectorProgress;
  issues: PerformanceIssue[];
}

export interface DirectorTelemetryEvent {
  type: "attempt" | "result";
  traceId: string;
  sessionId: string;
  stateVersion: number;
  frameId: string;
  status: "accepted" | "rejected" | "provider-error" | "generated" | "fallback" | "unavailable";
  attempt?: number;
  durationMs?: number;
  issueCodes: PerformanceIssue["code"][];
}

export interface DirectorTelemetrySink {
  record(event: DirectorTelemetryEvent): void | Promise<void>;
}

export interface DirectorSemanticEvaluationRequest {
  traceId: string;
  modelView: ModelView;
  frame: FrameDefinition;
  performance: Performance;
}

export interface DirectorSemanticEvaluator {
  evaluate(request: DirectorSemanticEvaluationRequest): Promise<PerformanceIssue[]>;
}

export interface PerformFrameInput {
  world: WorldPack;
  state: GameState;
  provider: DirectorProvider;
  progress?: DirectorProgress;
  maxAttempts?: number;
  telemetry?: DirectorTelemetrySink;
  semanticEvaluator?: DirectorSemanticEvaluator;
  nowMs?: () => number;
}

const EMPTY_PROGRESS: DirectorProgress = {
  completedBeatIds: [],
  acceptedSessionDetails: [],
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function parsePerformance(value: unknown): Performance | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.narration !== "string") return undefined;
  if (!Array.isArray(item.dialogue) || !item.dialogue.every((line) =>
    line && typeof line === "object" && !Array.isArray(line) &&
    typeof (line as Record<string, unknown>).speakerId === "string" &&
    typeof (line as Record<string, unknown>).text === "string"
  )) return undefined;
  for (const key of ["completedBeatIds", "surfacedIntentIds", "referencedCanonIds"] as const) {
    if (!Array.isArray(item[key]) || !item[key].every((entry) => typeof entry === "string")) return undefined;
  }
  if (!Array.isArray(item.proposedSessionDetails) || !item.proposedSessionDetails.every((detail) => {
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) return false;
    const entry = detail as Record<string, unknown>;
    return typeof entry.id === "string" && typeof entry.text === "string" &&
      ["turn", "scene", "session", "proposal"].includes(String(entry.persistence));
  })) return undefined;
  return structuredClone(value) as Performance;
}

function performanceText(performance: Performance): string {
  return [performance.narration, ...performance.dialogue.map((line) => line.text)].join("\n");
}

export function validatePerformance(
  world: WorldPack,
  state: GameState,
  frame: FrameDefinition,
  candidate: unknown,
): { performance?: Performance; issues: PerformanceIssue[] } {
  const performance = parsePerformance(candidate);
  if (!performance) {
    return { issues: [{ code: "invalid-shape", message: "The Director response did not match the structured Performance contract." }] };
  }
  const contract = frame.performance;
  if (!contract) return { performance, issues: [] };

  const issues: PerformanceIssue[] = [];
  const beats = new Map(contract.beats.map((beat) => [beat.id, beat]));
  const completed = new Set(performance.completedBeatIds);
  const output = normalized(performanceText(performance));
  for (const beatId of completed) {
    if (!beats.has(beatId)) issues.push({ code: "unknown-beat", message: `Performance completed unknown beat ${beatId}.` });
  }
  for (const beat of contract.beats.filter((item) => item.authority !== "suggest")) {
    if (!completed.has(beat.id)) issues.push({ code: "incomplete-required-beat", message: `Required beat ${beat.id} was not completed.` });
    if (beat.authority === "exact" && !output.includes(normalized(beat.text))) {
      issues.push({ code: "missing-exact-line", message: `Exact line ${beat.id} was not present verbatim.` });
    }
  }
  for (const claim of contract.forbiddenClaims) {
    if (normalized(claim) && output.includes(normalized(claim))) {
      issues.push({ code: "forbidden-claim", message: `Performance included prohibited frame claim: ${claim}` });
    }
  }

  const visibleCanonIds = new Set(projectModelView(world, state).canon.map((fact) => fact.id));
  const allCanonIds = new Set(world.canon.map((fact) => fact.id));
  for (const canonId of performance.referencedCanonIds) {
    if (!allCanonIds.has(canonId)) issues.push({ code: "unknown-canon-reference", message: `Performance referenced unknown canon ${canonId}.` });
    else if (!visibleCanonIds.has(canonId)) issues.push({ code: "hidden-canon-reference", message: `Performance referenced canon ${canonId} before it was visible to the model.` });
  }

  const legalIntents = new Set(projectModelView(world, state).availableIntents.map((intent) => intent.id));
  for (const intentId of performance.surfacedIntentIds) {
    if (!legalIntents.has(intentId)) issues.push({ code: "unknown-intent", message: `Performance surfaced unavailable intent ${intentId}.` });
  }
  const characterIds = new Set(world.characters.map((character) => character.id));
  for (const line of performance.dialogue) {
    if (!characterIds.has(line.speakerId)) issues.push({ code: "unknown-speaker", message: `Performance attributed dialogue to unknown speaker ${line.speakerId}.` });
  }
  return issues.length > 0 ? { issues } : { performance, issues };
}

function requiredBeatIds(beats: NarrativeBeatDefinition[]): string[] {
  return beats.filter((beat) => beat.authority !== "suggest").map((beat) => beat.id);
}

function fallbackFor(frame: FrameDefinition, legalIntentIds: string[]): Performance | undefined {
  const lines = frame.performance?.fallback ?? (frame.text ? [frame.text] : []);
  if (lines.length === 0) return undefined;
  return {
    narration: lines.join("\n\n"),
    dialogue: [],
    completedBeatIds: frame.performance ? requiredBeatIds(frame.performance.beats) : [],
    surfacedIntentIds: legalIntentIds,
    proposedSessionDetails: [],
    referencedCanonIds: [],
  };
}

async function emitTelemetry(sink: DirectorTelemetrySink | undefined, event: DirectorTelemetryEvent): Promise<void> {
  if (!sink) return;
  try {
    await sink.record(structuredClone(event));
  } catch {
    // Telemetry is non-authoritative and must never block authored fallback or story play.
  }
}

export async function performCurrentFrame(input: PerformFrameInput): Promise<DirectorResult> {
  const frame = input.world.frames?.find((candidate) => candidate.id === input.state.frameId);
  const prior = structuredClone(input.progress ?? EMPTY_PROGRESS);
  const nowMs = input.nowMs ?? (() => performance.now());
  if (!frame) {
    const traceId = `${input.state.sessionId}:${input.state.stateVersion}:missing-frame`;
    await emitTelemetry(input.telemetry, {
      type: "result", traceId, sessionId: input.state.sessionId, stateVersion: input.state.stateVersion,
      frameId: input.state.frameId, status: "unavailable", issueCodes: [],
    });
    return { status: "unavailable", traceId, attempts: 0, progress: prior, issues: [] };
  }
  const modelView = projectModelView(input.world, input.state);
  const maxAttempts = Math.max(1, Math.min(input.maxAttempts ?? 2, 3));
  const issues: PerformanceIssue[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const traceId = `${input.state.sessionId}:${input.state.stateVersion}:${frame.id}:${attempt}`;
    const startedAt = nowMs();
    try {
      const candidate = await input.provider.generate({ traceId, frame: structuredClone(frame), modelView, progress: prior });
      const validated = validatePerformance(input.world, input.state, frame, candidate);
      const attemptIssues = [...validated.issues];
      if (validated.performance && input.semanticEvaluator) {
        try {
          const semanticIssues = await input.semanticEvaluator.evaluate({
            traceId,
            modelView: structuredClone(modelView),
            frame: structuredClone(frame),
            performance: structuredClone(validated.performance),
          });
          attemptIssues.push(...semanticIssues);
        } catch {
          attemptIssues.push({
            code: "semantic-evaluation-failed",
            message: "The semantic evaluator was unavailable; generated performance was rejected safely.",
          });
        }
      }
      issues.push(...attemptIssues);
      const accepted = validated.performance && attemptIssues.length === 0 ? validated.performance : undefined;
      await emitTelemetry(input.telemetry, {
        type: "attempt", traceId, sessionId: input.state.sessionId, stateVersion: input.state.stateVersion,
        frameId: frame.id, status: accepted ? "accepted" : "rejected", attempt,
        durationMs: Math.max(0, Math.round(nowMs() - startedAt)), issueCodes: attemptIssues.map((issue) => issue.code),
      });
      if (accepted) {
        const progress = {
          completedBeatIds: unique([...prior.completedBeatIds, ...accepted.completedBeatIds]),
          acceptedSessionDetails: uniqueDetails([...prior.acceptedSessionDetails, ...accepted.proposedSessionDetails.filter((detail) => detail.persistence === "session")]),
        };
        await emitTelemetry(input.telemetry, {
          type: "result", traceId, sessionId: input.state.sessionId, stateVersion: input.state.stateVersion,
          frameId: frame.id, status: "generated", attempt, issueCodes: issues.map((issue) => issue.code),
        });
        return { status: "generated", traceId, attempts: attempt, performance: accepted, progress, issues };
      }
    } catch {
      issues.push({ code: "invalid-shape", message: `Director provider failed during attempt ${attempt}.` });
      await emitTelemetry(input.telemetry, {
        type: "attempt", traceId, sessionId: input.state.sessionId, stateVersion: input.state.stateVersion,
        frameId: frame.id, status: "provider-error", attempt,
        durationMs: Math.max(0, Math.round(nowMs() - startedAt)), issueCodes: ["invalid-shape"],
      });
    }
  }
  const fallback = fallbackFor(frame, modelView.availableIntents.map((intent) => intent.id));
  const traceId = `${input.state.sessionId}:${input.state.stateVersion}:${frame.id}:fallback`;
  if (!fallback) {
    await emitTelemetry(input.telemetry, {
      type: "result", traceId, sessionId: input.state.sessionId, stateVersion: input.state.stateVersion,
      frameId: frame.id, status: "unavailable", attempt: maxAttempts, issueCodes: issues.map((issue) => issue.code),
    });
    return { status: "unavailable", traceId, attempts: maxAttempts, progress: prior, issues };
  }
  await emitTelemetry(input.telemetry, {
    type: "result", traceId, sessionId: input.state.sessionId, stateVersion: input.state.stateVersion,
    frameId: frame.id, status: "fallback", attempt: maxAttempts, issueCodes: issues.map((issue) => issue.code),
  });
  return {
    status: "fallback",
    traceId,
    attempts: maxAttempts,
    performance: fallback,
    progress: { ...prior, completedBeatIds: unique([...prior.completedBeatIds, ...fallback.completedBeatIds]) },
    issues,
  };
}

function uniqueDetails(details: SessionDetailProposal[]): SessionDetailProposal[] {
  const byId = new Map(details.map((detail) => [detail.id, detail]));
  return [...byId.values()];
}

export class StaticDirectorProvider implements DirectorProvider {
  constructor(private readonly candidate: unknown | ((request: DirectorRequest) => unknown)) {}
  async generate(request: DirectorRequest): Promise<unknown> {
    return typeof this.candidate === "function" ? this.candidate(request) : structuredClone(this.candidate);
  }
}

export class FailingDirectorProvider implements DirectorProvider {
  async generate(): Promise<never> {
    throw new Error("Generation unavailable");
  }
}

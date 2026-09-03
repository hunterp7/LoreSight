import {
  applyCommittedEvent,
  createSession,
  evaluateCondition,
  getAvailableIntents,
  replay,
  resolveTurn,
} from "@storyframe/engine-core";
import { projectModelView, projectPlayerView } from "@storyframe/projections";
import type {
  AuthoredTestAssertion,
  DomainEvent,
  GameState,
  ResolveTurnResult,
  SourceMapEntry,
  StateOperation,
  StoryCommand,
  WorldPack,
} from "@storyframe/world-schema";

export interface IntentExplanation {
  intentId: string;
  exists: boolean;
  available: boolean;
  frameMatched?: boolean;
  conditionResult?: boolean;
  currentFrameId: string;
  message: string;
  source?: SourceMapEntry;
}

export interface OperationExplanation {
  operation: StateOperation;
  summary: string;
}

export interface TurnExplanation {
  eventId: string;
  stateVersionBefore: number;
  stateVersionAfter: number;
  intentId: string;
  intentSource?: SourceMapEntry;
  operations: OperationExplanation[];
  rules: Array<{
    ruleId: string;
    outcome: "fired" | "condition-false" | "already-triggered";
    source?: SourceMapEntry;
  }>;
  randomOutcomes: DomainEvent["randomOutcomes"];
}

export interface StoryAuditIssue {
  severity: "error" | "warning";
  code:
    | "replay-failed"
    | "unknown-intent"
    | "invalid-trace"
    | "event-divergence"
    | "secret-projection-leak"
    | "dead-end"
    | "missing-source-map";
  message: string;
  eventId?: string;
  stateVersion?: number;
  source?: SourceMapEntry;
}

export interface StoryAuditReport {
  ok: boolean;
  initialStateVersion: number;
  finalState: GameState;
  turns: TurnExplanation[];
  issues: StoryAuditIssue[];
}

export interface StateDifference {
  path: string;
  before: unknown;
  after: unknown;
}

export interface CorrectionBranch {
  originalSessionId: string;
  branchSessionId: string;
  forkedAtVersion: number;
  retainedEventIds: string[];
  state: GameState;
}

export interface CorrectionSimulation {
  branch: CorrectionBranch;
  correction: ResolveTurnResult;
  originalFinalState: GameState;
  differences: StateDifference[];
}

export interface AuthoredTestFailure {
  assertion?: AuthoredTestAssertion;
  message: string;
}

export interface AuthoredTestResult {
  testId: string;
  passed: boolean;
  intentIds: string[];
  finalState: GameState;
  events: DomainEvent[];
  failures: AuthoredTestFailure[];
}

export interface AuthoredTestReport {
  ok: boolean;
  passed: number;
  failed: number;
  results: AuthoredTestResult[];
}

export interface BranchPath {
  intentIds: string[];
  frameId: string;
  status: GameState["status"];
}

export interface BranchRejection {
  intentId: string;
  path: string[];
  message: string;
}

export interface StoryCoverageReport {
  complete: boolean;
  exploredStates: number;
  maxDepth: number;
  reachedFrameIds: string[];
  unreachedFrameIds: string[];
  exercisedIntentIds: string[];
  unexercisedIntentIds: string[];
  firedRuleIds: string[];
  unfiredRuleIds: string[];
  terminalPaths: BranchPath[];
  deadEnds: BranchPath[];
  rejections: BranchRejection[];
  truncatedPaths: BranchPath[];
  coverage: {
    frames: number;
    intents: number;
    rules: number;
  };
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function sourceFor(world: WorldPack, kind: string, semanticId: string): SourceMapEntry | undefined {
  return world.sourceMap?.[`${kind}:${semanticId}`] ?? world.sourceMap?.[semanticId];
}

export function explainIntent(
  world: WorldPack,
  state: GameState,
  intentId: string,
): IntentExplanation {
  const intent = world.intents.find((candidate) => candidate.id === intentId);
  if (!intent) {
    return {
      intentId,
      exists: false,
      available: false,
      currentFrameId: state.frameId,
      message: `No intent named ${intentId} exists in world ${world.manifest.id}.`,
    };
  }

  const frameMatched = !intent.availableInFrames || intent.availableInFrames.includes(state.frameId);
  const conditionResult = intent.when ? evaluateCondition(intent.when, state) : true;
  const active = state.status === "active";
  const available = active && frameMatched && conditionResult;
  const reason = !active
    ? `the session is ${state.status}`
    : !frameMatched
      ? `frame ${state.frameId} is not one of ${intent.availableInFrames?.join(", ")}`
      : !conditionResult
        ? "its condition evaluated to false"
        : "its frame and condition both match";

  return {
    intentId,
    exists: true,
    available,
    frameMatched,
    conditionResult,
    currentFrameId: state.frameId,
    message: `${intentId} is ${available ? "available" : "unavailable"} because ${reason}.`,
    source: sourceFor(world, "intent", intentId),
  };
}

function describeOperation(operation: StateOperation): string {
  switch (operation.kind) {
    case "set-flag":
      return `Set flag ${operation.flagId} to ${operation.value}.`;
    case "set-resource":
      return `Set resource ${operation.resourceId} to ${operation.value}.`;
    case "set-clock":
      return `Set clock ${operation.clockId} to ${operation.value}.`;
    case "set-relationship":
      return `Set relationship ${operation.relationshipId} to ${operation.value}.`;
    case "set-inventory":
      return `Set inventory ${operation.itemId} to ${operation.quantity}.`;
    case "add-clue":
      return `Added clue ${operation.clueId}.`;
    case "add-knowledge":
      return `Added knowledge ${operation.knowledgeId}.`;
    case "reveal-canon":
      return `Revealed canon ${operation.canonId}.`;
    case "reveal-artifact":
      return `Revealed artifact ${operation.artifactId}.`;
    case "set-location":
      return `Moved to location ${operation.locationId}.`;
    case "transition":
      return `Transitioned to frame ${operation.frameId}.`;
    case "set-status":
      return `Set session status to ${operation.status}.`;
    case "set-rng-state":
      return "Advanced deterministic random state.";
    case "mark-rule-triggered":
      return `Marked one-shot rule ${operation.ruleId} as triggered.`;
    case "add-ledger-entry":
      return `Added ${operation.entry.kind} ${operation.entry.id} to ${operation.entry.subjectId}'s ledger.`;
  }
}

export function explainTurn(world: WorldPack, event: DomainEvent): TurnExplanation {
  return {
    eventId: event.id,
    stateVersionBefore: event.stateVersionBefore,
    stateVersionAfter: event.stateVersionAfter,
    intentId: event.intentId,
    intentSource: sourceFor(world, "intent", event.intentId),
    operations: event.operations.map((operation) => ({
      operation: copy(operation),
      summary: describeOperation(operation),
    })),
    rules: event.trace.rules.map((rule) => ({
      ruleId: rule.ruleId,
      outcome: rule.outcome,
      source: sourceFor(world, "rule", rule.ruleId),
    })),
    randomOutcomes: copy(event.randomOutcomes),
  };
}

function auditProjectionLeaks(
  world: WorldPack,
  state: GameState,
  event: DomainEvent,
): StoryAuditIssue[] {
  const playerJson = JSON.stringify(projectPlayerView(world, state));
  const modelJson = JSON.stringify(projectModelView(world, state));
  const canonIssues = world.canon
    .filter(
      (fact) =>
        (fact.classification === "secret" || fact.classification === "branch") &&
        !state.revealedCanonIds.includes(fact.id),
    )
    .flatMap((fact) => {
      if (!playerJson.includes(fact.statement) && !modelJson.includes(fact.statement)) return [];
      return [
        {
          severity: "error" as const,
          code: "secret-projection-leak" as const,
          message: `Unrevealed canon ${fact.id} appeared in a player or model projection.`,
          eventId: event.id,
          stateVersion: state.stateVersion,
          source: sourceFor(world, "canon", fact.id),
        },
      ];
    });
  const artifactIssues = (world.artifacts ?? [])
    .filter((artifact) => !state.revealedArtifactIds.includes(artifact.id))
    .flatMap((artifact) => {
      const protectedValues = [
        artifact.id,
        artifact.title,
        artifact.summary,
        artifact.altText,
        ...artifact.textFallback,
      ];
      if (!protectedValues.some((value) => playerJson.includes(value) || modelJson.includes(value))) {
        return [];
      }
      return [{
        severity: "error" as const,
        code: "secret-projection-leak" as const,
        message: `Unrevealed artifact ${artifact.id} appeared in a player or model projection.`,
        eventId: event.id,
        stateVersion: state.stateVersion,
        source: sourceFor(world, "artifact", artifact.id),
      }];
    });
  return [...canonIssues, ...artifactIssues];
}

export function auditStoryline(
  world: WorldPack,
  initialState: GameState,
  events: DomainEvent[],
): StoryAuditReport {
  const issues: StoryAuditIssue[] = [];
  const turns: TurnExplanation[] = [];
  let state = copy(initialState);

  for (const event of events) {
    const intent = world.intents.find((candidate) => candidate.id === event.intentId);
    if (!intent) {
      issues.push({
        severity: "error",
        code: "unknown-intent",
        message: `Event ${event.id} references missing intent ${event.intentId}.`,
        eventId: event.id,
        stateVersion: state.stateVersion,
      });
    }
    if (!event.trace.intent.frameMatched || !event.trace.intent.conditionResult) {
      issues.push({
        severity: "error",
        code: "invalid-trace",
        message: `Committed event ${event.id} records an unavailable intent.`,
        eventId: event.id,
        stateVersion: state.stateVersion,
        source: sourceFor(world, "intent", event.intentId),
      });
    }

    const expected = resolveTurn({
      world,
      state,
      command: { intentId: event.intentId },
      expectedStateVersion: state.stateVersion,
      mutationId: event.mutationId,
    });
    if (expected.status !== "committed") {
      issues.push({
        severity: "error",
        code: "invalid-trace",
        message: `Event ${event.id} cannot be resolved from state version ${state.stateVersion}: ${expected.status === "rejected" ? expected.message : "its mutation is already present"}.`,
        eventId: event.id,
        stateVersion: state.stateVersion,
        source: sourceFor(world, "intent", event.intentId),
      });
    } else {
      const expectedEvent = expected.events[0];
      const semanticRecord = (candidate: DomainEvent) => ({
        intentId: candidate.intentId,
        stateVersionBefore: candidate.stateVersionBefore,
        stateVersionAfter: candidate.stateVersionAfter,
        turnAfter: candidate.turnAfter,
        operations: candidate.operations,
        randomOutcomes: candidate.randomOutcomes,
        trace: candidate.trace,
      });
      if (JSON.stringify(semanticRecord(event)) !== JSON.stringify(semanticRecord(expectedEvent))) {
        issues.push({
          severity: "error",
          code: "event-divergence",
          message: `Event ${event.id} differs from the deterministic result produced by the pinned world.`,
          eventId: event.id,
          stateVersion: state.stateVersion,
          source: sourceFor(world, "intent", event.intentId),
        });
      }
    }
    if (!sourceFor(world, "intent", event.intentId)) {
      issues.push({
        severity: "warning",
        code: "missing-source-map",
        message: `Intent ${event.intentId} has no source-map entry.`,
        eventId: event.id,
        stateVersion: state.stateVersion,
      });
    }

    turns.push(explainTurn(world, event));
    try {
      state = applyCommittedEvent(world, state, event);
    } catch (error) {
      issues.push({
        severity: "error",
        code: "replay-failed",
        message: error instanceof Error ? error.message : "Unknown replay failure.",
        eventId: event.id,
        stateVersion: state.stateVersion,
      });
      break;
    }
    issues.push(...auditProjectionLeaks(world, state, event));
  }

  if (state.status === "active" && getAvailableIntents(world, state).length === 0) {
    issues.push({
      severity: "error",
      code: "dead-end",
      message: `Active session has no legal intents at frame ${state.frameId}.`,
      stateVersion: state.stateVersion,
      source: sourceFor(world, "frame", state.frameId),
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    initialStateVersion: initialState.stateVersion,
    finalState: state,
    turns,
    issues,
  };
}

function toComparableState(state: GameState): Record<string, unknown> {
  const comparable = copy(state) as unknown as Record<string, unknown>;
  delete comparable.sessionId;
  delete comparable.mutationReceipts;
  return comparable;
}

function diffValue(
  before: unknown,
  after: unknown,
  path: string,
  differences: StateDifference[],
): void {
  if (Object.is(before, after)) return;
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    for (const key of new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])) {
      diffValue(beforeRecord[key], afterRecord[key], path ? `${path}.${key}` : key, differences);
    }
    return;
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  differences.push({ path, before: copy(before), after: copy(after) });
}

export function diffStates(before: GameState, after: GameState): StateDifference[] {
  const differences: StateDifference[] = [];
  diffValue(toComparableState(before), toComparableState(after), "", differences);
  return differences;
}

export function forkSessionAtVersion(
  world: WorldPack,
  initialState: GameState,
  events: DomainEvent[],
  targetVersion: number,
  branchSessionId: string,
): CorrectionBranch {
  if (!branchSessionId.trim()) throw new Error("A branch session ID is required.");
  if (targetVersion < initialState.stateVersion) {
    throw new Error("Cannot fork before the supplied initial snapshot.");
  }
  const retainedEvents = events.filter((event) => event.stateVersionAfter <= targetVersion);
  const state = replay(world, initialState, retainedEvents);
  if (state.stateVersion !== targetVersion) {
    throw new Error(`No replay boundary exists at state version ${targetVersion}.`);
  }
  const originalSessionId = state.sessionId;
  state.sessionId = branchSessionId;
  return {
    originalSessionId,
    branchSessionId,
    forkedAtVersion: targetVersion,
    retainedEventIds: retainedEvents.map((event) => event.id),
    state,
  };
}

export function simulateCorrection(args: {
  world: WorldPack;
  initialState: GameState;
  events: DomainEvent[];
  forkAtVersion: number;
  branchSessionId: string;
  command: StoryCommand;
  mutationId: string;
}): CorrectionSimulation {
  const originalFinalState = replay(args.world, args.initialState, args.events);
  const branch = forkSessionAtVersion(
    args.world,
    args.initialState,
    args.events,
    args.forkAtVersion,
    args.branchSessionId,
  );
  const correction = resolveTurn({
    world: args.world,
    state: branch.state,
    command: args.command,
    expectedStateVersion: branch.state.stateVersion,
    mutationId: args.mutationId,
  });
  const correctedState = correction.state;
  return {
    branch,
    correction,
    originalFinalState,
    differences: diffStates(originalFinalState, correctedState),
  };
}

function assertionFailure(
  world: WorldPack,
  state: GameState,
  assertion: AuthoredTestAssertion,
): string | undefined {
  const player = projectPlayerView(world, state);
  const model = projectModelView(world, state);
  switch (assertion.kind) {
    case "hidden-canon":
      return player.canon.some((fact) => fact.id === assertion.canonId) ||
        model.canon.some((fact) => fact.id === assertion.canonId)
        ? `Canon ${assertion.canonId} is visible in a player or model projection.`
        : undefined;
    case "hidden-artifact":
      return player.artifacts.some((artifact) => artifact.id === assertion.artifactId) ||
        model.artifacts.some((artifact) => artifact.id === assertion.artifactId)
        ? `Artifact ${assertion.artifactId} is visible in a player or model projection.`
        : undefined;
    case "revealed-canon":
      return state.revealedCanonIds.includes(assertion.canonId) &&
        player.canon.some((fact) => fact.id === assertion.canonId) &&
        model.canon.some((fact) => fact.id === assertion.canonId)
        ? undefined
        : `Canon ${assertion.canonId} was not revealed to both player and model projections.`;
    case "revealed-artifact":
      return state.revealedArtifactIds.includes(assertion.artifactId) &&
        player.artifacts.some((artifact) => artifact.id === assertion.artifactId) &&
        model.artifacts.some((artifact) => artifact.id === assertion.artifactId)
        ? undefined
        : `Artifact ${assertion.artifactId} was not revealed to both player and model projections.`;
    case "frame":
      return state.frameId === assertion.frameId
        ? undefined
        : `Expected frame ${assertion.frameId}, received ${state.frameId}.`;
    case "status":
      return state.status === assertion.status
        ? undefined
        : `Expected status ${assertion.status}, received ${state.status}.`;
  }
}

export function runAuthoredWorldTests(world: WorldPack): AuthoredTestReport {
  const results = (world.tests ?? []).map((authoredTest): AuthoredTestResult => {
    let state = createSession(world, {
      sessionId: `authored-test:${world.manifest.id}:${authoredTest.id}`,
      ownerId: "storyframe-authored-test-runner",
      seed: authoredTest.seed,
    });
    const events: DomainEvent[] = [];
    const failures: AuthoredTestFailure[] = [];

    for (const [index, intentId] of authoredTest.intentIds.entries()) {
      const result = resolveTurn({
        world,
        state,
        command: { intentId },
        expectedStateVersion: state.stateVersion,
        mutationId: `authored-test:${authoredTest.id}:${index + 1}`,
      });
      if (result.status !== "committed") {
        failures.push({
          message: `Step ${index + 1} (${intentId}) did not commit: ${result.status === "rejected" ? result.message : "the mutation was already applied"}.`,
        });
        break;
      }
      state = result.state;
      events.push(...result.events);
    }

    if (failures.length === 0) {
      for (const assertion of authoredTest.assertions) {
        const message = assertionFailure(world, state, assertion);
        if (message) failures.push({ assertion: copy(assertion), message });
      }
    }

    return {
      testId: authoredTest.id,
      passed: failures.length === 0,
      intentIds: copy(authoredTest.intentIds),
      finalState: state,
      events,
      failures,
    };
  });

  const passed = results.filter((result) => result.passed).length;
  return {
    ok: passed === results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}

function mechanicalFingerprint(state: GameState): string {
  return JSON.stringify({
    status: state.status,
    frameId: state.frameId,
    locationId: state.locationId,
    flags: state.flags,
    resources: state.resources,
    clocks: state.clocks,
    relationships: state.relationships,
    inventory: state.inventory,
    clues: [...state.clues].sort(),
    knowledge: [...state.knowledge].sort(),
    revealedCanonIds: [...state.revealedCanonIds].sort(),
    revealedArtifactIds: [...state.revealedArtifactIds].sort(),
    triggeredRuleIds: [...state.triggeredRuleIds].sort(),
    characterLedger: state.characterLedger.map((entry) => ({
      subjectId: entry.subjectId,
      kind: entry.kind,
      id: entry.id,
      statement: entry.statement,
      truth: entry.truth,
      audiences: entry.audiences,
    })),
    rngState: state.rngState,
  });
}

function percentage(covered: number, declared: number): number {
  return declared === 0 ? 100 : Math.round((covered / declared) * 10_000) / 100;
}

export function exploreStoryBranches(
  world: WorldPack,
  options: { maxDepth?: number; maxStates?: number; seed?: number } = {},
): StoryCoverageReport {
  const maxDepth = options.maxDepth ?? 12;
  const maxStates = options.maxStates ?? 2_000;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0) {
    throw new Error("Branch exploration maxDepth must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(maxStates) || maxStates < 1) {
    throw new Error("Branch exploration maxStates must be a positive safe integer.");
  }

  const initialState = createSession(world, {
    sessionId: `coverage:${world.manifest.id}`,
    ownerId: "storyframe-branch-explorer",
    seed: options.seed ?? 42,
  });
  const queue: Array<{ state: GameState; path: string[] }> = [{ state: initialState, path: [] }];
  const seen = new Set<string>();
  const reachedFrames = new Set<string>();
  const exercisedIntents = new Set<string>();
  const firedRules = new Set<string>();
  const terminalPaths: BranchPath[] = [];
  const deadEnds: BranchPath[] = [];
  const rejections: BranchRejection[] = [];
  const truncatedPaths: BranchPath[] = [];
  let exhaustedStateBudget = false;

  while (queue.length > 0) {
    if (seen.size >= maxStates) {
      exhaustedStateBudget = true;
      break;
    }
    const node = queue.shift();
    if (!node) break;
    const fingerprint = mechanicalFingerprint(node.state);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    reachedFrames.add(node.state.frameId);

    const pathRecord = (): BranchPath => ({
      intentIds: copy(node.path),
      frameId: node.state.frameId,
      status: node.state.status,
    });
    if (node.state.status !== "active") {
      terminalPaths.push(pathRecord());
      continue;
    }
    const intents = getAvailableIntents(world, node.state);
    if (intents.length === 0) {
      deadEnds.push(pathRecord());
      continue;
    }
    if (node.path.length >= maxDepth) {
      truncatedPaths.push(pathRecord());
      continue;
    }

    for (const [index, intent] of intents.entries()) {
      const result = resolveTurn({
        world,
        state: node.state,
        command: { intentId: intent.id },
        expectedStateVersion: node.state.stateVersion,
        mutationId: `coverage:${seen.size}:${node.path.length}:${index}`,
      });
      if (result.status !== "committed") {
        rejections.push({
          intentId: intent.id,
          path: copy(node.path),
          message: result.status === "rejected" ? result.message : "Mutation was already applied.",
        });
        continue;
      }
      exercisedIntents.add(intent.id);
      for (const event of result.events) {
        for (const rule of event.trace.rules) {
          if (rule.outcome === "fired") firedRules.add(rule.ruleId);
        }
      }
      queue.push({ state: result.state, path: [...node.path, intent.id] });
    }
  }

  const declaredFrames = [
    ...(world.frames ?? []).map((frame) => frame.id),
    ...(world.spans ?? []).map((span) => span.spanId),
  ];
  const declaredIntents = world.intents.map((intent) => intent.id);
  const declaredRules = (world.rules ?? []).map((rule) => rule.id);
  const reachedFrameIds = declaredFrames.filter((id) => reachedFrames.has(id));
  const exercisedIntentIds = declaredIntents.filter((id) => exercisedIntents.has(id));
  const firedRuleIds = declaredRules.filter((id) => firedRules.has(id));

  return {
    complete: !exhaustedStateBudget && truncatedPaths.length === 0,
    exploredStates: seen.size,
    maxDepth,
    reachedFrameIds,
    unreachedFrameIds: declaredFrames.filter((id) => !reachedFrames.has(id)),
    exercisedIntentIds,
    unexercisedIntentIds: declaredIntents.filter((id) => !exercisedIntents.has(id)),
    firedRuleIds,
    unfiredRuleIds: declaredRules.filter((id) => !firedRules.has(id)),
    terminalPaths,
    deadEnds,
    rejections,
    truncatedPaths,
    coverage: {
      frames: percentage(reachedFrameIds.length, declaredFrames.length),
      intents: percentage(exercisedIntentIds.length, declaredIntents.length),
      rules: percentage(firedRuleIds.length, declaredRules.length),
    },
  };
}

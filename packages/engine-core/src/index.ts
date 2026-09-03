import type {
  ComparisonOperator,
  Condition,
  DomainEvent,
  Effect,
  GameState,
  IntentDefinition,
  MutationReceipt,
  RandomOutcome,
  ReactiveRule,
  RejectionCode,
  ResolveTurnInput,
  ResolveTurnResult,
  SessionOptions,
  StateOperation,
  TurnCommittedEvent,
  TurnTrace,
  WorldPack,
} from "@storyframe/world-schema";

class EngineRejection extends Error {
  constructor(
    readonly code: RejectionCode,
    message: string,
  ) {
    super(message);
  }
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function mutationIdIsValid(mutationId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(mutationId);
}

function normalizeSeed(seed: number): number {
  if (!Number.isSafeInteger(seed)) {
    throw new Error("Session seed must be a safe integer.");
  }
  const normalized = seed >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

function compare(actual: number, operator: ComparisonOperator, expected: number): boolean {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
  }
}

export function evaluateCondition(condition: Condition, state: GameState): boolean {
  switch (condition.kind) {
    case "always":
      return true;
    case "all":
      return condition.conditions.every((item) => evaluateCondition(item, state));
    case "any":
      return condition.conditions.some((item) => evaluateCondition(item, state));
    case "not":
      return !evaluateCondition(condition.condition, state);
    case "flag":
      return state.flags[condition.flagId] === condition.equals;
    case "resource":
      return compare(state.resources[condition.resourceId] ?? 0, condition.operator, condition.value);
    case "clock":
      return compare(state.clocks[condition.clockId] ?? 0, condition.operator, condition.value);
    case "relationship":
      return compare(
        state.relationships[condition.relationshipId] ?? 0,
        condition.operator,
        condition.value,
      );
    case "inventory":
      return (state.inventory[condition.itemId] ?? 0) >= condition.atLeast;
    case "clue":
      return state.clues.includes(condition.clueId) === condition.present;
    case "clue-count":
      return compare(state.clues.length, condition.operator, condition.value);
    case "knowledge":
      return state.knowledge.includes(condition.knowledgeId) === condition.present;
    case "location":
      return state.locationId === condition.locationId;
    case "frame":
      return state.frameId === condition.frameId;
    case "canon-revealed":
      return state.revealedCanonIds.includes(condition.canonId);
    case "status":
      return state.status === condition.status;
  }
}

function initialNumbers(
  definitions: Record<string, { initial: number }> | undefined,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(definitions ?? {}).map(([id, definition]) => [id, definition.initial]),
  );
}

export function createSession(world: WorldPack, options: SessionOptions): GameState {
  if (!options.sessionId.trim() || !options.ownerId.trim()) {
    throw new Error("Session and owner IDs are required.");
  }

  const seed = normalizeSeed(options.seed);
  const initial = world.initialState;

  const state: GameState = {
    sessionId: options.sessionId,
    ownerId: options.ownerId,
    worldId: world.manifest.id,
    worldVersion: world.manifest.version,
    engineVersion: world.manifest.engineVersion,
    seed,
    rngState: seed,
    stateVersion: 0,
    turn: 0,
    status: "active",
    frameId: initial.frameId,
    locationId: initial.locationId,
    flags: Object.fromEntries(
      Object.entries(initial.flags ?? {}).map(([id, definition]) => [id, definition.initial]),
    ),
    resources: initialNumbers(initial.resources),
    clocks: initialNumbers(initial.clocks),
    relationships: initialNumbers(initial.relationships),
    inventory: initialNumbers(initial.inventory),
    clues: Object.entries(initial.clues ?? {})
      .filter(([, definition]) => definition.initial)
      .map(([id]) => id),
    knowledge: Object.entries(initial.knowledge ?? {})
      .filter(([, definition]) => definition.initial)
      .map(([id]) => id),
    revealedCanonIds: unique(initial.revealedCanonIds ?? []),
    revealedArtifactIds: unique(initial.revealedArtifactIds ?? []),
    triggeredRuleIds: [],
    characterLedger: [],
    mutationReceipts: {},
  };

  validateState(world, state);
  return state;
}

function intentIsAvailable(intent: IntentDefinition, state: GameState): boolean {
  if (intent.availableInFrames && !intent.availableInFrames.includes(state.frameId)) return false;
  return intent.when ? evaluateCondition(intent.when, state) : true;
}

export function getAvailableIntents(world: WorldPack, state: GameState): IntentDefinition[] {
  if (state.status !== "active") return [];
  return world.intents.filter((intent) => intentIsAvailable(intent, state)).map(copy);
}

function nextRandom(rngState: number): { rngState: number; basisPoints: number } {
  let next = rngState >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return {
    rngState: next,
    basisPoints: Math.floor((next / 0x1_0000_0000) * 10_000),
  };
}

function requireFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new EngineRejection("invalid-effect", `${label} must resolve to a finite number.`);
  }
}

function addUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

function applyOperation(state: GameState, operation: StateOperation): void {
  switch (operation.kind) {
    case "set-flag":
      state.flags[operation.flagId] = operation.value;
      break;
    case "set-resource":
      state.resources[operation.resourceId] = operation.value;
      break;
    case "set-clock":
      state.clocks[operation.clockId] = operation.value;
      break;
    case "set-relationship":
      state.relationships[operation.relationshipId] = operation.value;
      break;
    case "set-inventory":
      state.inventory[operation.itemId] = operation.quantity;
      break;
    case "add-clue":
      addUnique(state.clues, operation.clueId);
      break;
    case "add-knowledge":
      addUnique(state.knowledge, operation.knowledgeId);
      break;
    case "reveal-canon":
      addUnique(state.revealedCanonIds, operation.canonId);
      break;
    case "reveal-artifact":
      addUnique(state.revealedArtifactIds, operation.artifactId);
      break;
    case "set-location":
      state.locationId = operation.locationId;
      break;
    case "transition":
      state.frameId = operation.frameId;
      break;
    case "set-status":
      state.status = operation.status;
      break;
    case "set-rng-state":
      state.rngState = operation.rngState;
      break;
    case "mark-rule-triggered":
      addUnique(state.triggeredRuleIds, operation.ruleId);
      break;
    case "add-ledger-entry": {
      const existing = state.characterLedger.find((entry) => entry.id === operation.entry.id);
      if (!existing) state.characterLedger.push(copy(operation.entry));
      break;
    }
  }
}

interface EffectContext {
  world: WorldPack;
  state: GameState;
  eventId: string;
  targetVersion: number;
  operations: StateOperation[];
  randomOutcomes: RandomOutcome[];
  trace: TurnTrace;
}

function commitOperation(context: EffectContext, operation: StateOperation): void {
  applyOperation(context.state, operation);
  context.operations.push(operation);
}

function resolveEffects(effects: Effect[], context: EffectContext): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case "set-flag":
        if (!(effect.flagId in context.state.flags)) {
          throw new EngineRejection("invalid-effect", `Unknown flag: ${effect.flagId}.`);
        }
        commitOperation(context, effect);
        break;
      case "adjust-resource": {
        if (!(effect.resourceId in context.state.resources)) {
          throw new EngineRejection("invalid-effect", `Unknown resource: ${effect.resourceId}.`);
        }
        const value = context.state.resources[effect.resourceId] + effect.amount;
        requireFinite(value, `Resource ${effect.resourceId}`);
        commitOperation(context, { kind: "set-resource", resourceId: effect.resourceId, value });
        break;
      }
      case "advance-clock": {
        if (!(effect.clockId in context.state.clocks)) {
          throw new EngineRejection("invalid-effect", `Unknown clock: ${effect.clockId}.`);
        }
        const value = context.state.clocks[effect.clockId] + effect.amount;
        requireFinite(value, `Clock ${effect.clockId}`);
        commitOperation(context, { kind: "set-clock", clockId: effect.clockId, value });
        break;
      }
      case "adjust-relationship": {
        if (!(effect.relationshipId in context.state.relationships)) {
          throw new EngineRejection(
            "invalid-effect",
            `Unknown relationship: ${effect.relationshipId}.`,
          );
        }
        const value = context.state.relationships[effect.relationshipId] + effect.amount;
        requireFinite(value, `Relationship ${effect.relationshipId}`);
        commitOperation(context, {
          kind: "set-relationship",
          relationshipId: effect.relationshipId,
          value,
        });
        break;
      }
      case "add-inventory": {
        if (effect.quantity <= 0 || !Number.isSafeInteger(effect.quantity)) {
          throw new EngineRejection("invalid-effect", "Inventory additions require a positive integer.");
        }
        if (!(effect.itemId in (context.world.initialState.inventory ?? {}))) {
          throw new EngineRejection("invalid-effect", `Unknown inventory item: ${effect.itemId}.`);
        }
        const quantity = (context.state.inventory[effect.itemId] ?? 0) + effect.quantity;
        commitOperation(context, { kind: "set-inventory", itemId: effect.itemId, quantity });
        break;
      }
      case "remove-inventory": {
        if (effect.quantity <= 0 || !Number.isSafeInteger(effect.quantity)) {
          throw new EngineRejection("invalid-effect", "Inventory removals require a positive integer.");
        }
        const quantity = (context.state.inventory[effect.itemId] ?? 0) - effect.quantity;
        if (quantity < 0) {
          throw new EngineRejection("state-invariant", `Inventory ${effect.itemId} cannot be negative.`);
        }
        commitOperation(context, { kind: "set-inventory", itemId: effect.itemId, quantity });
        break;
      }
      case "add-clue":
        if (!(effect.clueId in (context.world.initialState.clues ?? {}))) {
          throw new EngineRejection("invalid-effect", `Unknown clue: ${effect.clueId}.`);
        }
        commitOperation(context, effect);
        break;
      case "add-knowledge":
        if (!(effect.knowledgeId in (context.world.initialState.knowledge ?? {}))) {
          throw new EngineRejection("invalid-effect", `Unknown knowledge: ${effect.knowledgeId}.`);
        }
        commitOperation(context, effect);
        break;
      case "set-location":
      case "transition":
        commitOperation(context, effect);
        break;
      case "reveal-canon":
        if (!context.world.canon.some((fact) => fact.id === effect.canonId)) {
          throw new EngineRejection("invalid-effect", `Unknown canon fact: ${effect.canonId}.`);
        }
        commitOperation(context, effect);
        break;
      case "reveal-artifact":
        if (!context.world.artifacts?.some((artifact) => artifact.id === effect.artifactId)) {
          throw new EngineRejection("invalid-effect", `Unknown artifact: ${effect.artifactId}.`);
        }
        commitOperation(context, effect);
        break;
      case "complete-session":
        commitOperation(context, { kind: "set-status", status: "complete" });
        break;
      case "fail-session":
        commitOperation(context, { kind: "set-status", status: "failed" });
        break;
      case "add-ledger-entry":
        if (!context.world.characters.some((character) => character.id === effect.entry.subjectId)) {
          throw new EngineRejection(
            "invalid-effect",
            `Unknown ledger subject: ${effect.entry.subjectId}.`,
          );
        }
        commitOperation(context, {
          kind: "add-ledger-entry",
          entry: {
            ...copy(effect.entry),
            establishedAtVersion: context.targetVersion,
            sourceEventId: context.eventId,
          },
        });
        break;
      case "seeded-check": {
        if (
          !Number.isSafeInteger(effect.chanceBasisPoints) ||
          effect.chanceBasisPoints < 0 ||
          effect.chanceBasisPoints > 10_000
        ) {
          throw new EngineRejection(
            "invalid-effect",
            `Seeded check ${effect.checkId} must use 0..10000 basis points.`,
          );
        }
        const random = nextRandom(context.state.rngState);
        commitOperation(context, { kind: "set-rng-state", rngState: random.rngState });
        const succeeded = random.basisPoints < effect.chanceBasisPoints;
        context.randomOutcomes.push({
          checkId: effect.checkId,
          rollBasisPoints: random.basisPoints,
          chanceBasisPoints: effect.chanceBasisPoints,
          succeeded,
        });
        resolveEffects(succeeded ? effect.onSuccess : effect.onFailure, context);
        break;
      }
    }
  }
}

function resolveRules(rules: ReactiveRule[], context: EffectContext): void {
  for (const rule of rules) {
    if (rule.once && context.state.triggeredRuleIds.includes(rule.id)) {
      context.trace.rules.push({
        ruleId: rule.id,
        condition: copy(rule.when),
        conditionResult: false,
        outcome: "already-triggered",
      });
      continue;
    }
    const conditionResult = evaluateCondition(rule.when, context.state);
    if (!conditionResult) {
      context.trace.rules.push({
        ruleId: rule.id,
        condition: copy(rule.when),
        conditionResult,
        outcome: "condition-false",
      });
      continue;
    }
    context.trace.rules.push({
      ruleId: rule.id,
      condition: copy(rule.when),
      conditionResult,
      outcome: "fired",
    });
    if (rule.once) {
      commitOperation(context, { kind: "mark-rule-triggered", ruleId: rule.id });
    }
    resolveEffects(rule.effects, context);
  }
}

function validateBoundedValues(
  values: Record<string, number>,
  definitions: Record<string, { min: number; max: number }> | undefined,
  label: string,
): void {
  for (const [id, value] of Object.entries(values)) {
    const definition = definitions?.[id];
    if (!definition) {
      throw new EngineRejection("state-invariant", `${label} ${id} has no world definition.`);
    }
    if (!Number.isFinite(value) || value < definition.min || value > definition.max) {
      throw new EngineRejection(
        "state-invariant",
        `${label} ${id} must stay within ${definition.min}..${definition.max}.`,
      );
    }
  }
}

export function validateState(world: WorldPack, state: GameState): void {
  if (state.worldId !== world.manifest.id || state.worldVersion !== world.manifest.version) {
    throw new EngineRejection("world-mismatch", "State is pinned to a different world release.");
  }
  if (!Number.isSafeInteger(state.stateVersion) || state.stateVersion < 0) {
    throw new EngineRejection("state-invariant", "State version must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(state.turn) || state.turn < 0) {
    throw new EngineRejection("state-invariant", "Turn must be a non-negative integer.");
  }
  validateBoundedValues(state.resources, world.initialState.resources, "Resource");
  validateBoundedValues(state.clocks, world.initialState.clocks, "Clock");
  validateBoundedValues(state.relationships, world.initialState.relationships, "Relationship");
  for (const flagId of Object.keys(state.flags)) {
    if (!(flagId in (world.initialState.flags ?? {}))) {
      throw new EngineRejection("state-invariant", `Flag ${flagId} has no world definition.`);
    }
  }
  for (const [itemId, quantity] of Object.entries(state.inventory)) {
    if (!(itemId in (world.initialState.inventory ?? {}))) {
      throw new EngineRejection("state-invariant", `Inventory ${itemId} has no world definition.`);
    }
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new EngineRejection("state-invariant", `Inventory ${itemId} must be non-negative.`);
    }
  }
  for (const clueId of state.clues) {
    if (!(clueId in (world.initialState.clues ?? {}))) {
      throw new EngineRejection("state-invariant", `Clue ${clueId} has no world definition.`);
    }
  }
  for (const knowledgeId of state.knowledge) {
    if (!(knowledgeId in (world.initialState.knowledge ?? {}))) {
      throw new EngineRejection("state-invariant", `Knowledge ${knowledgeId} has no world definition.`);
    }
  }
  for (const canonId of state.revealedCanonIds) {
    if (!world.canon.some((fact) => fact.id === canonId)) {
      throw new EngineRejection("state-invariant", `Revealed canon ${canonId} is not defined.`);
    }
  }
  for (const artifactId of state.revealedArtifactIds) {
    if (!world.artifacts?.some((artifact) => artifact.id === artifactId)) {
      throw new EngineRejection("state-invariant", `Revealed artifact ${artifactId} is not defined.`);
    }
  }
}

function reject(state: GameState, code: RejectionCode, message: string): ResolveTurnResult {
  return { status: "rejected", state: copy(state), code, message, stateVersion: state.stateVersion };
}

export function applyCommittedEvent(
  world: WorldPack,
  state: GameState,
  event: TurnCommittedEvent,
): GameState {
  if (event.stateVersionBefore !== state.stateVersion) {
    throw new Error(
      `Replay version mismatch: event expects ${event.stateVersionBefore}, state is ${state.stateVersion}.`,
    );
  }
  if (
    event.stateVersionAfter !== event.stateVersionBefore + 1 ||
    event.turnAfter !== state.turn + 1
  ) {
    throw new Error("Committed events must advance stateVersion and turn exactly once.");
  }
  if (state.mutationReceipts[event.mutationId]) {
    throw new Error(`Mutation ${event.mutationId} is already present during replay.`);
  }
  const next = copy(state);
  for (const operation of event.operations) applyOperation(next, operation);
  next.turn = event.turnAfter;
  next.stateVersion = event.stateVersionAfter;
  next.mutationReceipts[event.mutationId] = {
    mutationId: event.mutationId,
    eventId: event.id,
    stateVersion: event.stateVersionAfter,
  };
  validateState(world, next);
  return next;
}

export function resolveTurn(input: ResolveTurnInput): ResolveTurnResult {
  const { world, state, command, expectedStateVersion, mutationId } = input;
  if (state.worldId !== world.manifest.id || state.worldVersion !== world.manifest.version) {
    return reject(state, "world-mismatch", "State is pinned to a different world release.");
  }
  if (!mutationIdIsValid(mutationId)) {
    return reject(
      state,
      "invalid-effect",
      "Mutation ID must be 1-128 safe identifier characters.",
    );
  }
  const existingReceipt: MutationReceipt | undefined = state.mutationReceipts[mutationId];
  if (existingReceipt) {
    return {
      status: "duplicate",
      state: copy(state),
      receipt: copy(existingReceipt),
      stateVersion: state.stateVersion,
    };
  }
  if (expectedStateVersion !== state.stateVersion) {
    return reject(
      state,
      "version-conflict",
      `Expected state version ${expectedStateVersion}; current version is ${state.stateVersion}.`,
    );
  }
  if (state.status !== "active") {
    return reject(state, "session-complete", "This story session is no longer active.");
  }

  const intent = world.intents.find((candidate) => candidate.id === command.intentId);
  if (!intent) return reject(state, "unknown-intent", `Unknown intent: ${command.intentId}.`);
  const frameMatched = !intent.availableInFrames || intent.availableInFrames.includes(state.frameId);
  const conditionResult = intent.when ? evaluateCondition(intent.when, state) : true;
  if (!frameMatched || !conditionResult) {
    return reject(state, "intent-unavailable", `Intent ${command.intentId} is not currently legal.`);
  }

  const targetVersion = state.stateVersion + 1;
  const eventId = `${state.sessionId}:v${targetVersion}:${mutationId}`;
  const draft = copy(state);
  const context: EffectContext = {
    world,
    state: draft,
    eventId,
    targetVersion,
    operations: [],
    randomOutcomes: [],
    trace: {
      intent: {
        intentId: intent.id,
        frameMatched,
        condition: intent.when ? copy(intent.when) : undefined,
        conditionResult,
      },
      rules: [],
    },
  };

  try {
    resolveEffects(intent.effects, context);
    resolveRules(world.rules ?? [], context);
    validateState(world, draft);
  } catch (error) {
    if (error instanceof EngineRejection) return reject(state, error.code, error.message);
    throw error;
  }

  const event: DomainEvent = {
    id: eventId,
    type: "turn.committed",
    mutationId,
    intentId: intent.id,
    stateVersionBefore: state.stateVersion,
    stateVersionAfter: targetVersion,
    turnAfter: state.turn + 1,
    operations: context.operations,
    randomOutcomes: context.randomOutcomes,
    trace: context.trace,
  };
  const committed = applyCommittedEvent(world, state, event);
  return {
    status: "committed",
    state: committed,
    events: [event],
    stateVersion: committed.stateVersion,
  };
}

export function replay(world: WorldPack, initialState: GameState, events: DomainEvent[]): GameState {
  return events.reduce((state, event) => applyCommittedEvent(world, state, event), copy(initialState));
}

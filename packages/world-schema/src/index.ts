export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type Audience = "player" | "model" | "creator" | "debug";
export type SessionStatus = "active" | "complete" | "failed";
export type CanonClass = "locked" | "secret" | "branch" | "open" | "unsaid" | "never";

export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface SourceRange {
  sourceId: string;
  start: SourcePosition;
  end: SourcePosition;
}

export interface SourceMapEntry {
  semanticId: string;
  kind: "world" | "state" | "canon" | "character" | "artifact" | "frame" | "span" | "thread" | "choice" | "intent" | "rule" | "ending" | "test";
  range: SourceRange;
}

export interface WorldManifest {
  id: string;
  version: string;
  title: string;
  engineVersion: string;
  rights: {
    classification: "original" | "public-domain" | "licensed" | "user-supplied-private";
    owner: string;
    source?: string;
    license?: string;
  };
}

export type ComparisonOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

export type Condition =
  | { kind: "always" }
  | { kind: "all"; conditions: Condition[] }
  | { kind: "any"; conditions: Condition[] }
  | { kind: "not"; condition: Condition }
  | { kind: "flag"; flagId: string; equals: boolean }
  | { kind: "resource"; resourceId: string; operator: ComparisonOperator; value: number }
  | { kind: "clock"; clockId: string; operator: ComparisonOperator; value: number }
  | { kind: "relationship"; relationshipId: string; operator: ComparisonOperator; value: number }
  | { kind: "inventory"; itemId: string; atLeast: number }
  | { kind: "clue"; clueId: string; present: boolean }
  | { kind: "clue-count"; operator: ComparisonOperator; value: number }
  | { kind: "knowledge"; knowledgeId: string; present: boolean }
  | { kind: "location"; locationId: string }
  | { kind: "frame"; frameId: string }
  | { kind: "canon-revealed"; canonId: string }
  | { kind: "status"; status: SessionStatus };

export interface LedgerEntryTemplate {
  id: string;
  subjectId: string;
  kind: "fact" | "belief" | "suspicion" | "lie" | "relationship" | "session-detail";
  statement: string;
  truth: "true" | "false" | "uncertain" | "subjective";
  audiences: Audience[];
}

export type Effect =
  | { kind: "set-flag"; flagId: string; value: boolean }
  | { kind: "adjust-resource"; resourceId: string; amount: number }
  | { kind: "advance-clock"; clockId: string; amount: number }
  | { kind: "adjust-relationship"; relationshipId: string; amount: number }
  | { kind: "add-inventory"; itemId: string; quantity: number }
  | { kind: "remove-inventory"; itemId: string; quantity: number }
  | { kind: "add-clue"; clueId: string }
  | { kind: "add-knowledge"; knowledgeId: string }
  | { kind: "reveal-canon"; canonId: string }
  | { kind: "reveal-artifact"; artifactId: string }
  | { kind: "set-location"; locationId: string }
  | { kind: "transition"; frameId: string }
  | { kind: "complete-session" }
  | { kind: "fail-session" }
  | { kind: "add-ledger-entry"; entry: LedgerEntryTemplate }
  | {
      kind: "seeded-check";
      checkId: string;
      chanceBasisPoints: number;
      onSuccess: Effect[];
      onFailure: Effect[];
    };

export interface ResourceDefinition {
  initial: number;
  min: number;
  max: number;
  audiences: Audience[];
}

export interface NumericStateDefinition {
  initial: number;
  min: number;
  max: number;
  audiences: Audience[];
}

export interface InitialStateDefinition {
  frameId: string;
  locationId?: string;
  flags?: Record<string, { initial: boolean; audiences: Audience[] }>;
  resources?: Record<string, ResourceDefinition>;
  clocks?: Record<string, NumericStateDefinition>;
  relationships?: Record<string, NumericStateDefinition>;
  inventory?: Record<string, { initial: number; audiences: Audience[] }>;
  clues?: Record<string, { initial: boolean; audiences: Audience[] }>;
  knowledge?: Record<string, { initial: boolean; audiences: Audience[] }>;
  revealedCanonIds?: string[];
  revealedArtifactIds?: string[];
}

export interface CanonFact {
  id: string;
  classification: CanonClass;
  statement: string;
  audiences: Audience[];
  modelDirective?: string;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  role?: string;
}

export type NarrativeAuthority = "exact" | "establish" | "suggest";

export interface NarrativeBeatDefinition {
  id: string;
  authority: NarrativeAuthority;
  text: string;
}

export interface FramePerformanceContract {
  beats: NarrativeBeatDefinition[];
  forbiddenClaims: string[];
  fallback: string[];
}

export interface FrameDefinition {
  id: string;
  title?: string;
  text?: string;
  performance?: FramePerformanceContract;
  terminal?: boolean;
}

export type ArtifactKind = "document" | "image" | "diagram" | "map";
export type ArtifactPresentation = "inline" | "inspect";

export interface ArtifactDefinition {
  id: string;
  kind: ArtifactKind;
  title: string;
  summary: string;
  caption?: string;
  altText: string;
  textFallback: string[];
  presentation: ArtifactPresentation;
  audiences: Audience[];
  clueId?: string;
  asset?: {
    key: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
    width?: number;
    height?: number;
  };
}

export interface IntentDefinition {
  id: string;
  title: string;
  description: string;
  availableInFrames?: string[];
  when?: Condition;
  effects: Effect[];
}

export interface ReactiveRule {
  id: string;
  when: Condition;
  effects: Effect[];
  once?: boolean;
}

export interface NarrativeBeat {
  id: string;
  text: string;
}

export interface NarrativeCurve {
  dimension: string;
  start: number;
  end: number;
}

export type InventionPersistence = "turn" | "scene" | "session" | "proposal";

export interface TweenContract {
  spanId: string;
  targetFrameId: string;
  purpose: string;
  turnRange: { min: number; max: number };
  requiredBeats: NarrativeBeat[];
  curves: NarrativeCurve[];
  mayInvent: string[];
  mayNotInvent: string[];
  inventionPersistence: InventionPersistence;
  hiddenCanonIds: string[];
  hiddenArtifactIds: string[];
  availableIntentIds: string[];
  exit: {
    requiredBeatsComplete: boolean;
    condition?: Condition;
  };
  fallback: string[];
}

export interface ThreadDefinition {
  id: string;
  plantFrameId: string;
  echoIds: string[];
  revealFrameId?: string;
  payoffFrameId?: string;
  neverResolveIds: string[];
  optional: boolean;
}

export interface ChoiceDefinition {
  id: string;
  availableInFrames: string[];
  intentIds: string[];
}

export type AuthoredTestAssertion =
  | { kind: "hidden-canon"; canonId: string }
  | { kind: "hidden-artifact"; artifactId: string }
  | { kind: "revealed-canon"; canonId: string }
  | { kind: "revealed-artifact"; artifactId: string }
  | { kind: "frame"; frameId: string }
  | { kind: "status"; status: SessionStatus };

export interface AuthoredWorldTest {
  id: string;
  seed: number;
  intentIds: string[];
  assertions: AuthoredTestAssertion[];
}

export interface PresentationDefinition {
  themeId?: string;
  tokens?: Record<string, JsonPrimitive>;
  playerFrame?: PlayerFrameDefinition;
}

export interface PlayerFrameDefinition {
  kind: "default-crt" | "authored";
  preset?: "institutional" | "ornate" | "industrial" | "minimal";
  label?: string;
  mark?: string;
  colors?: {
    surround: `#${string}`;
    surface: `#${string}`;
    edge: `#${string}`;
    accent: `#${string}`;
  };
}

export interface WorldPack {
  manifest: WorldManifest;
  initialState: InitialStateDefinition;
  canon: CanonFact[];
  characters: CharacterDefinition[];
  frames?: FrameDefinition[];
  artifacts?: ArtifactDefinition[];
  intents: IntentDefinition[];
  rules?: ReactiveRule[];
  spans?: TweenContract[];
  threads?: ThreadDefinition[];
  choices?: ChoiceDefinition[];
  tests?: AuthoredWorldTest[];
  presentation?: PresentationDefinition;
  sourceMap?: Record<string, SourceMapEntry>;
}

export interface StoryCommand {
  intentId: string;
  parameters?: Record<string, JsonValue>;
}

export interface CharacterLedgerEntry extends LedgerEntryTemplate {
  establishedAtVersion: number;
  sourceEventId: string;
}

export interface MutationReceipt {
  mutationId: string;
  eventId: string;
  stateVersion: number;
}

export interface GameState {
  sessionId: string;
  ownerId: string;
  worldId: string;
  worldVersion: string;
  engineVersion: string;
  seed: number;
  rngState: number;
  stateVersion: number;
  turn: number;
  status: SessionStatus;
  frameId: string;
  locationId?: string;
  flags: Record<string, boolean>;
  resources: Record<string, number>;
  clocks: Record<string, number>;
  relationships: Record<string, number>;
  inventory: Record<string, number>;
  clues: string[];
  knowledge: string[];
  revealedCanonIds: string[];
  revealedArtifactIds: string[];
  triggeredRuleIds: string[];
  characterLedger: CharacterLedgerEntry[];
  mutationReceipts: Record<string, MutationReceipt>;
}

export type StateOperation =
  | { kind: "set-flag"; flagId: string; value: boolean }
  | { kind: "set-resource"; resourceId: string; value: number }
  | { kind: "set-clock"; clockId: string; value: number }
  | { kind: "set-relationship"; relationshipId: string; value: number }
  | { kind: "set-inventory"; itemId: string; quantity: number }
  | { kind: "add-clue"; clueId: string }
  | { kind: "add-knowledge"; knowledgeId: string }
  | { kind: "reveal-canon"; canonId: string }
  | { kind: "reveal-artifact"; artifactId: string }
  | { kind: "set-location"; locationId: string }
  | { kind: "transition"; frameId: string }
  | { kind: "set-status"; status: SessionStatus }
  | { kind: "set-rng-state"; rngState: number }
  | { kind: "mark-rule-triggered"; ruleId: string }
  | { kind: "add-ledger-entry"; entry: CharacterLedgerEntry };

export interface RandomOutcome {
  checkId: string;
  rollBasisPoints: number;
  chanceBasisPoints: number;
  succeeded: boolean;
}

export interface IntentTrace {
  intentId: string;
  frameMatched: boolean;
  condition?: Condition;
  conditionResult: boolean;
}

export interface RuleTrace {
  ruleId: string;
  condition: Condition;
  conditionResult: boolean;
  outcome: "fired" | "condition-false" | "already-triggered";
}

export interface TurnTrace {
  intent: IntentTrace;
  rules: RuleTrace[];
}

export interface TurnCommittedEvent {
  id: string;
  type: "turn.committed";
  mutationId: string;
  intentId: string;
  stateVersionBefore: number;
  stateVersionAfter: number;
  turnAfter: number;
  operations: StateOperation[];
  randomOutcomes: RandomOutcome[];
  trace: TurnTrace;
}

export type DomainEvent = TurnCommittedEvent;

export interface SessionOptions {
  sessionId: string;
  ownerId: string;
  seed: number;
}

export interface ResolveTurnInput {
  world: WorldPack;
  state: GameState;
  command: StoryCommand;
  expectedStateVersion: number;
  mutationId: string;
}

export type RejectionCode =
  | "world-mismatch"
  | "version-conflict"
  | "session-complete"
  | "unknown-intent"
  | "intent-unavailable"
  | "invalid-effect"
  | "state-invariant";

export type ResolveTurnResult =
  | {
      status: "committed";
      state: GameState;
      events: DomainEvent[];
      stateVersion: number;
    }
  | {
      status: "duplicate";
      state: GameState;
      receipt: MutationReceipt;
      stateVersion: number;
    }
  | {
      status: "rejected";
      state: GameState;
      code: RejectionCode;
      message: string;
      stateVersion: number;
    };

export interface StorySave {
  worldId: string;
  worldVersion: string;
  engineVersion: string;
  seed: number;
  snapshot: GameState;
  events: DomainEvent[];
}

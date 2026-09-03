export interface WorldSummary {
  id: string;
  version: string;
  title: string;
  compileStatus: "ready" | "error";
  diagnostics: Array<{ severity: string; code: string; message: string; guidance: string }>;
  intents: number;
  frames: number;
  artifacts: number;
  spans: number;
  authoredTests: {
    ok: boolean;
    passed: number;
    failed: number;
  };
  branchCoverage?: {
    complete: boolean;
    exploredStates: number;
    coverage: { frames: number; intents: number; rules: number };
    deadEnds: number;
    unreachedFrameIds: string[];
    unexercisedIntentIds: string[];
  };
  sourceId: string;
  opening?: string;
}

export interface SessionSummary {
  sessionId: string;
  worldId: string;
  worldVersion: string;
  stateVersion: number;
  status: string;
  frameId?: string;
  startedAt: string;
  kind: "legacy" | "playtest";
  issueCount?: number;
}

export interface Scenario {
  id: string;
  label: string;
  response: string;
}

export interface Overview {
  generatedAt: string;
  worlds: WorldSummary[];
  sessions: SessionSummary[];
  correctionProposalCount: number;
  draftCount: number;
  scenarios: Scenario[];
}

export interface ArtifactRecord {
  worldId: string;
  id: string;
  kind: string;
  title: string;
  summary: string;
  caption?: string;
  altText: string;
  textFallback: string[];
  presentation: string;
  clueId?: string;
  asset?: { key: string; mimeType: string };
}

export interface SessionDetail {
  kind: "legacy" | "playtest";
  state: Record<string, unknown> & {
    sessionId?: string;
    stateVersion?: number;
    frameId?: string;
    status?: string;
  };
  events: Array<Record<string, unknown> & { id?: string; intentId?: string; stateVersionAfter?: number }>;
  audit: {
    ok: boolean;
    issues: Array<{ severity: string; code: string; message: string; stateVersion?: number; source?: { range?: { sourceId: string; start: { line: number; column: number } } } }>;
  };
  availableIntents: Array<{ id: string; title: string; description?: string }>;
  creatorView?: { artifacts?: ArtifactRecord[] };
  playerView?: {
    state: { clues: string[]; status: string };
    artifacts: Array<Omit<ArtifactRecord, "worldId">>;
  };
  scene?: { id: string; title: string; text: string };
  history?: Array<{ id: string; intentId: string; title: string; description?: string; step: number }>;
}

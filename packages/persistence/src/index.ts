import type { DomainEvent, GameState, JsonValue, WorldPack } from "@storyframe/world-schema";

export type RepositoryWriteResult = "created" | "existing" | "conflict" | "not-found";

export interface StoredStorySession {
  sessionId: string;
  ownerId: string;
  worldId: string;
  worldVersion: string;
  engineVersion: string;
  initialState: GameState;
  state: GameState;
  events: DomainEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface CommitStoryTurnInput {
  ownerId: string;
  sessionId: string;
  expectedStateVersion: number;
  state: GameState;
  events: DomainEvent[];
  committedAt: string;
}

export interface StorySessionRepository {
  create(session: StoredStorySession): Promise<RepositoryWriteResult>;
  getOwned(ownerId: string, sessionId: string): Promise<StoredStorySession | undefined>;
  commitTurn(input: CommitStoryTurnInput): Promise<RepositoryWriteResult>;
}

export interface StoredWorldRelease {
  worldId: string;
  worldVersion: string;
  contentHash: string;
  world: WorldPack;
  createdAt: string;
  createdBy: string;
}

export interface WorldReleaseRepository {
  publish(release: StoredWorldRelease): Promise<RepositoryWriteResult>;
  getRelease(worldId: string, worldVersion: string): Promise<StoredWorldRelease | undefined>;
}

export interface StoredDirectorPerformance {
  ownerId: string;
  sessionId: string;
  stateVersion: number;
  frameId: string;
  contractHash: string;
  status: "generated" | "fallback";
  provider: string;
  model: string;
  attemptCount: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  performance: JsonValue;
  createdAt: string;
}

export interface DirectorPerformanceRepository {
  putOnce(record: StoredDirectorPerformance): Promise<RepositoryWriteResult>;
  getPerformance(
    ownerId: string,
    sessionId: string,
    stateVersion: number,
    contractHash: string,
  ): Promise<StoredDirectorPerformance | undefined>;
}

export interface OperatorAuditRecord {
  id: string;
  occurredAt: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: "allowed" | "denied" | "failed";
  traceId?: string;
  details: Record<string, JsonValue>;
}

export interface OperatorAuditRepository {
  append(record: OperatorAuditRecord): Promise<void>;
  listForTarget(targetType: string, targetId: string): Promise<OperatorAuditRecord[]>;
}

export interface OwnerStoryDataExport {
  schemaVersion: 1;
  ownerId: string;
  exportedAt: string;
  sessions: StoredStorySession[];
  directorPerformances: StoredDirectorPerformance[];
}

export interface OwnerStoryDataDeletion {
  ownerId: string;
  deletedSessions: number;
  deletedEvents: number;
  deletedDirectorPerformances: number;
}

export interface StoryDataLifecycleRepository {
  exportOwnerStoryData(ownerId: string, exportedAt: string): Promise<OwnerStoryDataExport>;
  deleteOwnerStoryData(ownerId: string): Promise<OwnerStoryDataDeletion>;
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function releaseKey(worldId: string, worldVersion: string): string {
  return `${worldId}\u0000${worldVersion}`;
}

function performanceKey(record: {
  ownerId: string;
  sessionId: string;
  stateVersion: number;
  contractHash: string;
}): string {
  return `${record.ownerId}\u0000${record.sessionId}\u0000${record.stateVersion}\u0000${record.contractHash}`;
}

function validateRelease(release: StoredWorldRelease): void {
  if (release.world.manifest.id !== release.worldId || release.world.manifest.version !== release.worldVersion) {
    throw new Error("World release identity must match the compiled WorldPack manifest.");
  }
  if (!/^[a-f0-9]{64}$/.test(release.contentHash)) {
    throw new Error("World release contentHash must be a lowercase SHA-256 digest.");
  }
}

export class MemoryStoryframeRepository
  implements StorySessionRepository, WorldReleaseRepository, DirectorPerformanceRepository, OperatorAuditRepository, StoryDataLifecycleRepository {
  private readonly sessions = new Map<string, StoredStorySession>();
  private readonly releases = new Map<string, StoredWorldRelease>();
  private readonly performances = new Map<string, StoredDirectorPerformance>();
  private readonly audit: OperatorAuditRecord[] = [];

  async create(session: StoredStorySession): Promise<RepositoryWriteResult> {
    if (this.sessions.has(session.sessionId)) return "existing";
    if (session.state.sessionId !== session.sessionId || session.state.ownerId !== session.ownerId) {
      throw new Error("Stored session identity must match its current state.");
    }
    this.sessions.set(session.sessionId, {
      ...copy(session),
      initialState: copy(session.initialState),
      state: copy(session.state),
      events: copy(session.events),
    });
    return "created";
  }

  async getOwned(ownerId: string, sessionId: string): Promise<StoredStorySession | undefined> {
    const session = this.sessions.get(sessionId);
    return session?.ownerId === ownerId
      ? {
          ...copy(session),
          initialState: copy(session.initialState),
          state: copy(session.state),
          events: copy(session.events),
        }
      : undefined;
  }

  async commitTurn(input: CommitStoryTurnInput): Promise<RepositoryWriteResult> {
    const current = this.sessions.get(input.sessionId);
    if (!current || current.ownerId !== input.ownerId) return "not-found";
    if (current.state.stateVersion !== input.expectedStateVersion) return "conflict";
    if (input.state.ownerId !== input.ownerId || input.state.sessionId !== input.sessionId) {
      throw new Error("Committed state cannot change session ownership or identity.");
    }
    if (input.state.stateVersion !== input.expectedStateVersion + 1 || input.events.length !== 1) {
      throw new Error("A committed turn must append one event and advance stateVersion exactly once.");
    }
    const event = input.events[0];
    if (
      event.stateVersionBefore !== input.expectedStateVersion ||
      event.stateVersionAfter !== input.state.stateVersion
    ) {
      throw new Error("Committed event version does not match the session transition.");
    }
    this.sessions.set(input.sessionId, {
      ...copy(current),
      state: copy(input.state),
      events: [...copy(current.events), ...copy(input.events)],
      updatedAt: input.committedAt,
    });
    return "created";
  }

  async publish(release: StoredWorldRelease): Promise<RepositoryWriteResult> {
    validateRelease(release);
    const key = releaseKey(release.worldId, release.worldVersion);
    const current = this.releases.get(key);
    if (current) return current.contentHash === release.contentHash ? "existing" : "conflict";
    this.releases.set(key, copy(release));
    return "created";
  }

  async getRelease(worldId: string, worldVersion: string): Promise<StoredWorldRelease | undefined> {
    const release = this.releases.get(releaseKey(worldId, worldVersion));
    return release ? copy(release) : undefined;
  }

  async putOnce(record: StoredDirectorPerformance): Promise<RepositoryWriteResult> {
    const key = performanceKey(record);
    if (this.performances.has(key)) return "existing";
    this.performances.set(key, copy(record));
    return "created";
  }

  async getPerformance(
    ownerId: string,
    sessionId: string,
    stateVersion: number,
    contractHash: string,
  ): Promise<StoredDirectorPerformance | undefined> {
    const record = this.performances.get(
      performanceKey({ ownerId, sessionId, stateVersion, contractHash }),
    );
    return record ? copy(record) : undefined;
  }

  async append(record: OperatorAuditRecord): Promise<void> {
    if (this.audit.some((item) => item.id === record.id)) {
      throw new Error(`Audit record ${record.id} already exists.`);
    }
    this.audit.push(copy(record));
  }

  async listForTarget(targetType: string, targetId: string): Promise<OperatorAuditRecord[]> {
    return this.audit
      .filter((record) => record.targetType === targetType && record.targetId === targetId)
      .map(copy);
  }

  async exportOwnerStoryData(ownerId: string, exportedAt: string): Promise<OwnerStoryDataExport> {
    const sessions = [...this.sessions.values()]
      .filter((session) => session.ownerId === ownerId)
      .sort((left, right) => left.sessionId.localeCompare(right.sessionId))
      .map(copy);
    const directorPerformances = [...this.performances.values()]
      .filter((record) => record.ownerId === ownerId)
      .sort((left, right) => performanceKey(left).localeCompare(performanceKey(right)))
      .map(copy);
    return { schemaVersion: 1, ownerId, exportedAt, sessions, directorPerformances };
  }

  async deleteOwnerStoryData(ownerId: string): Promise<OwnerStoryDataDeletion> {
    let deletedSessions = 0;
    let deletedEvents = 0;
    let deletedDirectorPerformances = 0;
    for (const [sessionId, session] of this.sessions) {
      if (session.ownerId !== ownerId) continue;
      deletedSessions += 1;
      deletedEvents += session.events.length;
      this.sessions.delete(sessionId);
    }
    for (const [key, record] of this.performances) {
      if (record.ownerId !== ownerId) continue;
      deletedDirectorPerformances += 1;
      this.performances.delete(key);
    }
    return { ownerId, deletedSessions, deletedEvents, deletedDirectorPerformances };
  }
}

export * from "./postgres.js";

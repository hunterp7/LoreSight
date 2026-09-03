import type { DomainEvent, GameState, WorldPack } from "@storyframe/world-schema";
import type {
  CommitStoryTurnInput,
  DirectorPerformanceRepository,
  OperatorAuditRecord,
  OperatorAuditRepository,
  OwnerStoryDataDeletion,
  OwnerStoryDataExport,
  RepositoryWriteResult,
  StoredDirectorPerformance,
  StoredStorySession,
  StoredWorldRelease,
  StorySessionRepository,
  StoryDataLifecycleRepository,
  WorldReleaseRepository,
} from "./index.js";

export interface SqlQueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  rows: Row[];
  rowCount: number;
}

export interface SqlConnection {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>>;
}

export interface SqlDatabase {
  transaction<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T>;
}

export const POSTGRES_SQL = {
  setSubject: "SELECT set_config('storyframe.subject_id', $1, true)",
  insertSession: `
    INSERT INTO storyframe_sessions (
      session_id, owner_id, world_id, world_version, engine_version, seed,
      initial_state, latest_state, state_version, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
    ON CONFLICT (session_id) DO NOTHING
  `,
  selectOwnedSession: `
    SELECT session_id, owner_id, world_id, world_version, engine_version, seed,
      initial_state, latest_state, state_version, created_at, updated_at
    FROM storyframe_sessions
    WHERE session_id = $1 AND owner_id = $2
  `,
  selectEvents: `
    SELECT event FROM storyframe_events
    WHERE session_id = $1
    ORDER BY state_version ASC
  `,
  selectOwnerSessions: `
    SELECT session_id, owner_id, world_id, world_version, engine_version, seed,
      initial_state, latest_state, state_version, created_at, updated_at
    FROM storyframe_sessions
    WHERE owner_id = $1
    ORDER BY session_id ASC
  `,
  selectOwnerEvents: `
    SELECT event.session_id, event.event
    FROM storyframe_events event
    JOIN storyframe_sessions session ON session.session_id = event.session_id
    WHERE session.owner_id = $1
    ORDER BY event.session_id ASC, event.state_version ASC
  `,
  selectOwnerPerformances: `
    SELECT owner_id, session_id, state_version, frame_id, contract_hash, status,
      provider, model, attempt_count, input_tokens, output_tokens, duration_ms,
      performance, created_at
    FROM storyframe_director_performances
    WHERE owner_id = $1
    ORDER BY session_id ASC, state_version ASC, contract_hash ASC
  `,
  deleteOwnerPerformances: `
    DELETE FROM storyframe_director_performances WHERE owner_id = $1
  `,
  deleteOwnerEvents: `
    DELETE FROM storyframe_events event
    USING storyframe_sessions session
    WHERE event.session_id = session.session_id AND session.owner_id = $1
  `,
  deleteOwnerSessions: `
    DELETE FROM storyframe_sessions WHERE owner_id = $1
  `,
  updateSession: `
    UPDATE storyframe_sessions
    SET latest_state = $4::jsonb, state_version = $5, updated_at = $6
    WHERE session_id = $1 AND owner_id = $2 AND state_version = $3
  `,
  insertEvent: `
    INSERT INTO storyframe_events (
      session_id, state_version, event_id, mutation_id, event, committed_at
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
  `,
  insertRelease: `
    INSERT INTO storyframe_world_releases (
      world_id, world_version, content_hash, world_pack, created_at, created_by
    ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    ON CONFLICT (world_id, world_version) DO NOTHING
  `,
  selectRelease: `
    SELECT world_id, world_version, content_hash, world_pack, created_at, created_by
    FROM storyframe_world_releases
    WHERE world_id = $1 AND world_version = $2
  `,
  insertPerformance: `
    INSERT INTO storyframe_director_performances (
      owner_id, session_id, state_version, frame_id, contract_hash, status,
      provider, model, attempt_count, input_tokens, output_tokens, duration_ms,
      performance, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
    ON CONFLICT (owner_id, session_id, state_version, contract_hash) DO NOTHING
  `,
  selectPerformance: `
    SELECT owner_id, session_id, state_version, frame_id, contract_hash, status,
      provider, model, attempt_count, input_tokens, output_tokens, duration_ms,
      performance, created_at
    FROM storyframe_director_performances
    WHERE owner_id = $1 AND session_id = $2 AND state_version = $3 AND contract_hash = $4
  `,
  insertAudit: `
    INSERT INTO storyframe_operator_audit (
      id, occurred_at, actor_id, action, target_type, target_id, outcome, trace_id, details
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
  `,
  selectAudit: `
    SELECT id, occurred_at, actor_id, action, target_type, target_id, outcome, trace_id, details
    FROM storyframe_operator_audit
    WHERE target_type = $1 AND target_id = $2
    ORDER BY occurred_at ASC, id ASC
  `,
} as const;

interface SessionRow extends Record<string, unknown> {
  session_id: string;
  owner_id: string;
  world_id: string;
  world_version: string;
  engine_version: string;
  seed: string | number;
  initial_state: GameState;
  latest_state: GameState;
  state_version: string | number;
  created_at: string | Date;
  updated_at: string | Date;
}

interface EventRow extends Record<string, unknown> { session_id?: string; event: DomainEvent }
interface ReleaseRow extends Record<string, unknown> {
  world_id: string;
  world_version: string;
  content_hash: string;
  world_pack: WorldPack;
  created_at: string | Date;
  created_by: string;
}

interface PerformanceRow extends Record<string, unknown> {
  owner_id: string;
  session_id: string;
  state_version: string | number;
  frame_id: string;
  contract_hash: string;
  status: "generated" | "fallback";
  provider: string;
  model: string;
  attempt_count: number;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number;
  performance: StoredDirectorPerformance["performance"];
  created_at: string | Date;
}

interface AuditRow extends Record<string, unknown> {
  id: string;
  occurred_at: string | Date;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  outcome: OperatorAuditRecord["outcome"];
  trace_id: string | null;
  details: OperatorAuditRecord["details"];
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

async function setSubject(connection: SqlConnection, subjectId: string): Promise<void> {
  if (!subjectId.trim()) throw new Error("A non-empty authenticated subject is required.");
  await connection.query(POSTGRES_SQL.setSubject, [subjectId]);
}

export class PostgresStoryframeRepository
  implements StorySessionRepository, WorldReleaseRepository, DirectorPerformanceRepository, OperatorAuditRepository, StoryDataLifecycleRepository {
  constructor(private readonly database: SqlDatabase) {}

  async create(session: StoredStorySession): Promise<RepositoryWriteResult> {
    return this.database.transaction(async (connection) => {
      await setSubject(connection, session.ownerId);
      const result = await connection.query(POSTGRES_SQL.insertSession, [
        session.sessionId, session.ownerId, session.worldId, session.worldVersion,
        session.engineVersion, session.state.seed, json(session.initialState), json(session.state),
        session.state.stateVersion, session.createdAt, session.updatedAt,
      ]);
      return result.rowCount === 1 ? "created" : "existing";
    });
  }

  async getOwned(ownerId: string, sessionId: string): Promise<StoredStorySession | undefined> {
    return this.database.transaction(async (connection) => {
      await setSubject(connection, ownerId);
      const selected = await connection.query<SessionRow>(POSTGRES_SQL.selectOwnedSession, [sessionId, ownerId]);
      const row = selected.rows[0];
      if (!row) return undefined;
      const eventRows = await connection.query<EventRow>(POSTGRES_SQL.selectEvents, [sessionId]);
      return {
        sessionId: row.session_id,
        ownerId: row.owner_id,
        worldId: row.world_id,
        worldVersion: row.world_version,
        engineVersion: row.engine_version,
        initialState: structuredClone(row.initial_state),
        state: structuredClone(row.latest_state),
        events: eventRows.rows.map(({ event }) => structuredClone(event)),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      };
    });
  }

  async commitTurn(input: CommitStoryTurnInput): Promise<RepositoryWriteResult> {
    if (input.events.length !== 1 || input.state.stateVersion !== input.expectedStateVersion + 1) {
      throw new Error("A persisted turn must append exactly one state version and one event.");
    }
    return this.database.transaction(async (connection) => {
      await setSubject(connection, input.ownerId);
      const updated = await connection.query(POSTGRES_SQL.updateSession, [
        input.sessionId, input.ownerId, input.expectedStateVersion, json(input.state),
        input.state.stateVersion, input.committedAt,
      ]);
      if (updated.rowCount !== 1) {
        const current = await connection.query<SessionRow>(POSTGRES_SQL.selectOwnedSession, [
          input.sessionId, input.ownerId,
        ]);
        return current.rowCount === 0 ? "not-found" : "conflict";
      }
      const event = input.events[0];
      await connection.query(POSTGRES_SQL.insertEvent, [
        input.sessionId, event.stateVersionAfter, event.id, event.mutationId,
        json(event), input.committedAt,
      ]);
      return "created";
    });
  }

  async publish(release: StoredWorldRelease): Promise<RepositoryWriteResult> {
    return this.database.transaction(async (connection) => {
      const inserted = await connection.query(POSTGRES_SQL.insertRelease, [
        release.worldId, release.worldVersion, release.contentHash, json(release.world),
        release.createdAt, release.createdBy,
      ]);
      if (inserted.rowCount === 1) return "created";
      const existing = await connection.query<ReleaseRow>(POSTGRES_SQL.selectRelease, [
        release.worldId, release.worldVersion,
      ]);
      return existing.rows[0]?.content_hash === release.contentHash ? "existing" : "conflict";
    });
  }

  async getRelease(worldId: string, worldVersion: string): Promise<StoredWorldRelease | undefined> {
    return this.database.transaction(async (connection) => {
      const result = await connection.query<ReleaseRow>(POSTGRES_SQL.selectRelease, [worldId, worldVersion]);
      const row = result.rows[0];
      return row ? {
        worldId: row.world_id,
        worldVersion: row.world_version,
        contentHash: row.content_hash,
        world: structuredClone(row.world_pack),
        createdAt: iso(row.created_at),
        createdBy: row.created_by,
      } : undefined;
    });
  }

  async putOnce(record: StoredDirectorPerformance): Promise<RepositoryWriteResult> {
    return this.database.transaction(async (connection) => {
      await setSubject(connection, record.ownerId);
      const result = await connection.query(POSTGRES_SQL.insertPerformance, [
        record.ownerId, record.sessionId, record.stateVersion, record.frameId,
        record.contractHash, record.status, record.provider, record.model,
        record.attemptCount, record.inputTokens ?? null, record.outputTokens ?? null,
        record.durationMs, json(record.performance), record.createdAt,
      ]);
      return result.rowCount === 1 ? "created" : "existing";
    });
  }

  async getPerformance(
    ownerId: string,
    sessionId: string,
    stateVersion: number,
    contractHash: string,
  ): Promise<StoredDirectorPerformance | undefined> {
    return this.database.transaction(async (connection) => {
      await setSubject(connection, ownerId);
      const result = await connection.query<PerformanceRow>(POSTGRES_SQL.selectPerformance, [
        ownerId, sessionId, stateVersion, contractHash,
      ]);
      const row = result.rows[0];
      return row ? {
        ownerId: row.owner_id,
        sessionId: row.session_id,
        stateVersion: Number(row.state_version),
        frameId: row.frame_id,
        contractHash: row.contract_hash,
        status: row.status,
        provider: row.provider,
        model: row.model,
        attemptCount: row.attempt_count,
        inputTokens: row.input_tokens ?? undefined,
        outputTokens: row.output_tokens ?? undefined,
        durationMs: row.duration_ms,
        performance: structuredClone(row.performance),
        createdAt: iso(row.created_at),
      } : undefined;
    });
  }

  async append(record: OperatorAuditRecord): Promise<void> {
    await this.database.transaction(async (connection) => {
      await connection.query(POSTGRES_SQL.insertAudit, [
        record.id, record.occurredAt, record.actorId, record.action, record.targetType,
        record.targetId, record.outcome, record.traceId ?? null, json(record.details),
      ]);
    });
  }

  async listForTarget(targetType: string, targetId: string): Promise<OperatorAuditRecord[]> {
    return this.database.transaction(async (connection) => {
      const result = await connection.query<AuditRow>(POSTGRES_SQL.selectAudit, [targetType, targetId]);
      return result.rows.map((row) => ({
        id: row.id,
        occurredAt: iso(row.occurred_at),
        actorId: row.actor_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        outcome: row.outcome,
        traceId: row.trace_id ?? undefined,
        details: structuredClone(row.details),
      }));
    });
  }

  async exportOwnerStoryData(ownerId: string, exportedAt: string): Promise<OwnerStoryDataExport> {
    return this.database.transaction(async (connection) => {
      await setSubject(connection, ownerId);
      const [sessionRows, eventRows, performanceRows] = await Promise.all([
        connection.query<SessionRow>(POSTGRES_SQL.selectOwnerSessions, [ownerId]),
        connection.query<EventRow>(POSTGRES_SQL.selectOwnerEvents, [ownerId]),
        connection.query<PerformanceRow>(POSTGRES_SQL.selectOwnerPerformances, [ownerId]),
      ]);
      const eventsBySession = new Map<string, DomainEvent[]>();
      for (const row of eventRows.rows) {
        if (!row.session_id) continue;
        const events = eventsBySession.get(row.session_id) ?? [];
        events.push(structuredClone(row.event));
        eventsBySession.set(row.session_id, events);
      }
      return {
        schemaVersion: 1,
        ownerId,
        exportedAt,
        sessions: sessionRows.rows.map((row) => ({
          sessionId: row.session_id,
          ownerId: row.owner_id,
          worldId: row.world_id,
          worldVersion: row.world_version,
          engineVersion: row.engine_version,
          initialState: structuredClone(row.initial_state),
          state: structuredClone(row.latest_state),
          events: eventsBySession.get(row.session_id) ?? [],
          createdAt: iso(row.created_at),
          updatedAt: iso(row.updated_at),
        })),
        directorPerformances: performanceRows.rows.map(performanceFromRow),
      };
    });
  }

  async deleteOwnerStoryData(ownerId: string): Promise<OwnerStoryDataDeletion> {
    return this.database.transaction(async (connection) => {
      await setSubject(connection, ownerId);
      const performances = await connection.query(POSTGRES_SQL.deleteOwnerPerformances, [ownerId]);
      const events = await connection.query(POSTGRES_SQL.deleteOwnerEvents, [ownerId]);
      const sessions = await connection.query(POSTGRES_SQL.deleteOwnerSessions, [ownerId]);
      return {
        ownerId,
        deletedSessions: sessions.rowCount,
        deletedEvents: events.rowCount,
        deletedDirectorPerformances: performances.rowCount,
      };
    });
  }
}

function performanceFromRow(row: PerformanceRow): StoredDirectorPerformance {
  return {
    ownerId: row.owner_id,
    sessionId: row.session_id,
    stateVersion: Number(row.state_version),
    frameId: row.frame_id,
    contractHash: row.contract_hash,
    status: row.status,
    provider: row.provider,
    model: row.model,
    attemptCount: row.attempt_count,
    inputTokens: row.input_tokens ?? undefined,
    outputTokens: row.output_tokens ?? undefined,
    durationMs: row.duration_ms,
    performance: structuredClone(row.performance),
    createdAt: iso(row.created_at),
  };
}

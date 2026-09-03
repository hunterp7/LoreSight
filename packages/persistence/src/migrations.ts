import { createHash } from "node:crypto";
import type { SqlConnection, SqlDatabase } from "./postgres.js";

export interface StoryframeMigration {
  id: string;
  sql: string;
  checksum?: string;
}

export interface AppliedMigration {
  id: string;
  checksum: string;
  appliedAt: string;
}

export interface MigrationRunResult {
  applied: AppliedMigration[];
  alreadyCurrent: string[];
}

interface MigrationRow extends Record<string, unknown> {
  migration_id: string;
  checksum: string;
  applied_at: string | Date;
}

export const MIGRATION_SQL = {
  lock: "SELECT pg_advisory_xact_lock(hashtext('storyframe:schema-migrations'))",
  createLedger: `
    CREATE TABLE IF NOT EXISTS storyframe_schema_migrations (
      migration_id text PRIMARY KEY,
      checksum char(64) NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
      applied_at timestamptz NOT NULL
    )
  `,
  selectLedger: `
    SELECT migration_id, checksum, applied_at
    FROM storyframe_schema_migrations
    ORDER BY migration_id ASC
  `,
  insertLedger: `
    INSERT INTO storyframe_schema_migrations (migration_id, checksum, applied_at)
    VALUES ($1, $2, $3)
  `,
} as const;

export function migrationChecksum(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

function validateMigrations(migrations: readonly StoryframeMigration[]): StoryframeMigration[] {
  const ordered = [...migrations].sort((left, right) => left.id.localeCompare(right.id));
  const seen = new Set<string>();
  for (const migration of ordered) {
    if (!/^\d{4}_[a-z0-9_]+$/.test(migration.id)) {
      throw new Error(`Invalid migration id ${JSON.stringify(migration.id)}. Use NNNN_lower_snake_case.`);
    }
    if (seen.has(migration.id)) throw new Error(`Duplicate migration id: ${migration.id}.`);
    if (!migration.sql.trim()) throw new Error(`Migration ${migration.id} is empty.`);
    seen.add(migration.id);
  }
  return ordered;
}

async function applyWithinLock(
  connection: SqlConnection,
  migrations: readonly StoryframeMigration[],
  now: () => string,
): Promise<MigrationRunResult> {
  await connection.query(MIGRATION_SQL.lock);
  await connection.query(MIGRATION_SQL.createLedger);
  const ledger = await connection.query<MigrationRow>(MIGRATION_SQL.selectLedger);
  const recorded = new Map(ledger.rows.map((row) => [row.migration_id, row]));
  const applied: AppliedMigration[] = [];
  const alreadyCurrent: string[] = [];

  for (const migration of validateMigrations(migrations)) {
    const checksum = migration.checksum ?? migrationChecksum(migration.sql);
    const existing = recorded.get(migration.id);
    if (existing) {
      if (existing.checksum !== checksum) {
        throw new Error(
          `Migration ${migration.id} changed after it was applied. ` +
          `Recorded ${existing.checksum}; current ${checksum}. Create a new migration instead.`,
        );
      }
      alreadyCurrent.push(migration.id);
      continue;
    }

    await connection.query(migration.sql);
    const appliedAt = now();
    await connection.query(MIGRATION_SQL.insertLedger, [migration.id, checksum, appliedAt]);
    applied.push({ id: migration.id, checksum, appliedAt });
  }

  return { applied, alreadyCurrent };
}

/**
 * Applies an ordered, immutable migration set inside one database transaction.
 * The transaction-scoped advisory lock serializes deploys, and any SQL or ledger
 * failure rolls the entire pending set back.
 */
export async function runStoryframeMigrations(
  database: SqlDatabase,
  migrations: readonly StoryframeMigration[],
  options: { now?: () => string } = {},
): Promise<MigrationRunResult> {
  const now = options.now ?? (() => new Date().toISOString());
  return database.transaction((connection) => applyWithinLock(connection, migrations, now));
}

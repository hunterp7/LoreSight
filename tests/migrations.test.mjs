import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadStoryframeMigrations } from "@storyframe/persistence/migration-files";
import {
  MIGRATION_SQL,
  migrationChecksum,
  runStoryframeMigrations,
} from "@storyframe/persistence/migrations";

function databaseWithLedger(initialRows = []) {
  const calls = [];
  const rows = structuredClone(initialRows);
  const database = {
    async transaction(work) {
      calls.push({ sql: "BEGIN" });
      try {
        const result = await work({
          async query(sql, values = []) {
            calls.push({ sql, values });
            if (sql === MIGRATION_SQL.selectLedger) return { rows: structuredClone(rows), rowCount: rows.length };
            if (sql === MIGRATION_SQL.insertLedger) {
              rows.push({ migration_id: values[0], checksum: values[1], applied_at: values[2] });
              return { rows: [], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
          },
        });
        calls.push({ sql: "COMMIT" });
        return result;
      } catch (error) {
        calls.push({ sql: "ROLLBACK" });
        throw error;
      }
    },
  };
  return { database, calls, rows };
}

test("migration runner serializes, orders, records, and skips immutable migrations", async () => {
  const firstSql = "CREATE TABLE first_table (id text);";
  const secondSql = "CREATE TABLE second_table (id text);";
  const existing = [{
    migration_id: "0001_first",
    checksum: migrationChecksum(firstSql),
    applied_at: "2026-08-01T00:00:00.000Z",
  }];
  const { database, calls } = databaseWithLedger(existing);
  const result = await runStoryframeMigrations(database, [
    { id: "0002_second", sql: secondSql },
    { id: "0001_first", sql: firstSql },
  ], { now: () => "2026-08-03T12:00:00.000Z" });

  assert.deepEqual(result.alreadyCurrent, ["0001_first"]);
  assert.deepEqual(result.applied, [{
    id: "0002_second",
    checksum: migrationChecksum(secondSql),
    appliedAt: "2026-08-03T12:00:00.000Z",
  }]);
  assert.equal(calls[1].sql, MIGRATION_SQL.lock);
  assert.ok(calls.find((call) => call.sql === secondSql));
  assert.equal(calls.at(-1).sql, "COMMIT");
});

test("migration runner rejects edited history before executing pending SQL", async () => {
  const { database, calls } = databaseWithLedger([{
    migration_id: "0001_first",
    checksum: "0".repeat(64),
    applied_at: "2026-08-01T00:00:00.000Z",
  }]);

  await assert.rejects(
    runStoryframeMigrations(database, [{ id: "0001_first", sql: "SELECT 1" }]),
    /changed after it was applied/,
  );
  assert.equal(calls.at(-1).sql, "ROLLBACK");
  assert.equal(calls.some((call) => call.sql === "SELECT 1"), false);
});

test("migration runner rejects ambiguous ids and duplicates", async () => {
  const { database } = databaseWithLedger();
  await assert.rejects(
    runStoryframeMigrations(database, [{ id: "first", sql: "SELECT 1" }]),
    /Invalid migration id/,
  );
  await assert.rejects(
    runStoryframeMigrations(database, [
      { id: "0001_first", sql: "SELECT 1" },
      { id: "0001_first", sql: "SELECT 2" },
    ]),
    /Duplicate migration id/,
  );
});

test("migration file loader ignores noncanonical files and returns lexical order", async () => {
  const directory = await mkdtemp(join(tmpdir(), "storyframe-migrations-"));
  try {
    await writeFile(join(directory, "0002_second.sql"), "SELECT 2;\n");
    await writeFile(join(directory, "README.md"), "ignored");
    await writeFile(join(directory, "0001_first.sql"), "SELECT 1;\n");
    const loaded = await loadStoryframeMigrations(directory);
    assert.deepEqual(loaded, [
      { id: "0001_first", sql: "SELECT 1;\n" },
      { id: "0002_second", sql: "SELECT 2;\n" },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

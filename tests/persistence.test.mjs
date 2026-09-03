import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSession, resolveTurn } from "../packages/engine-core/dist/index.js";
import { MemoryStoryframeRepository, POSTGRES_SQL } from "../packages/persistence/dist/index.js";
import { investigationWorld } from "../packages/test-fixtures/dist/index.js";

const now = "2026-08-03T12:00:00.000Z";

function storedSession(ownerId = "owner-a", sessionId = "session-a") {
  const state = createSession(investigationWorld, { ownerId, sessionId, seed: 42 });
  return {
    sessionId,
    ownerId,
    worldId: state.worldId,
    worldVersion: state.worldVersion,
    engineVersion: state.engineVersion,
    initialState: state,
    state,
    events: [],
    createdAt: now,
    updatedAt: now,
  };
}

test("session repository enforces owner scope and optimistic turn commits", async () => {
  const repository = new MemoryStoryframeRepository();
  const session = storedSession();
  assert.equal(await repository.create(session), "created");
  assert.equal(await repository.create(session), "existing");
  assert.equal(await repository.getOwned("owner-b", session.sessionId), undefined);

  const turn = resolveTurn({
    world: investigationWorld,
    state: session.state,
    command: { intentId: "inspect_red_thread" },
    expectedStateVersion: 0,
    mutationId: "turn-1",
  });
  assert.equal(turn.status, "committed");
  if (turn.status !== "committed") return;

  assert.equal(await repository.commitTurn({
    ownerId: session.ownerId,
    sessionId: session.sessionId,
    expectedStateVersion: 0,
    state: turn.state,
    events: turn.events,
    committedAt: now,
  }), "created");
  assert.equal(await repository.commitTurn({
    ownerId: session.ownerId,
    sessionId: session.sessionId,
    expectedStateVersion: 0,
    state: turn.state,
    events: turn.events,
    committedAt: now,
  }), "conflict");
  assert.equal((await repository.getOwned(session.ownerId, session.sessionId)).events.length, 1);
});

test("published releases and Director performances are immutable by key", async () => {
  const repository = new MemoryStoryframeRepository();
  const hashA = "a".repeat(64);
  const release = {
    worldId: investigationWorld.manifest.id,
    worldVersion: investigationWorld.manifest.version,
    contentHash: hashA,
    world: investigationWorld,
    createdAt: now,
    createdBy: "creator-a",
  };
  assert.equal(await repository.publish(release), "created");
  assert.equal(await repository.publish(release), "existing");
  assert.equal(await repository.publish({ ...release, contentHash: "b".repeat(64) }), "conflict");

  const performance = {
    ownerId: "owner-a",
    sessionId: "session-a",
    stateVersion: 0,
    frameId: "investigate",
    contractHash: hashA,
    status: "fallback",
    provider: "authored",
    model: "none",
    attemptCount: 0,
    durationMs: 0,
    performance: { narration: ["The archive waits."] },
    createdAt: now,
  };
  assert.equal(await repository.putOnce(performance), "created");
  assert.equal(await repository.putOnce({ ...performance, durationMs: 99 }), "existing");
});

test("production migration encodes immutable releases, owner isolation, and append-only events", async () => {
  const sql = await readFile(
    new URL("../packages/persistence/migrations/0001_storyframe_production.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /BEFORE UPDATE OR DELETE ON storyframe_world_releases/);
  assert.match(sql, /UNIQUE \(session_id, mutation_id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /current_setting\('storyframe\.subject_id', true\)/);
  assert.doesNotMatch(sql, /UPDATE storyframe_events|DELETE FROM storyframe_events/);
  assert.match(POSTGRES_SQL.setSubject, /set_config\('storyframe\.subject_id'/);
  assert.match(POSTGRES_SQL.updateSession, /state_version = \$3/);
  assert.match(POSTGRES_SQL.insertEvent, /INSERT INTO storyframe_events/);
});

test("owner data export and deletion are scoped, deterministic, and leave shared releases intact", async () => {
  const repository = new MemoryStoryframeRepository();
  const ownerA = storedSession("owner-a", "session-a");
  const ownerB = storedSession("owner-b", "session-b");
  await repository.create(ownerB);
  await repository.create(ownerA);
  await repository.publish({
    worldId: investigationWorld.manifest.id,
    worldVersion: investigationWorld.manifest.version,
    contentHash: "c".repeat(64),
    world: investigationWorld,
    createdAt: now,
    createdBy: "creator-a",
  });
  await repository.putOnce({
    ownerId: "owner-a",
    sessionId: "session-a",
    stateVersion: 0,
    frameId: "investigate",
    contractHash: "d".repeat(64),
    status: "fallback",
    provider: "authored",
    model: "none",
    attemptCount: 0,
    durationMs: 0,
    performance: { narration: "The archive waits." },
    createdAt: now,
  });

  const exported = await repository.exportOwnerStoryData("owner-a", "2026-08-03T13:00:00.000Z");
  assert.equal(exported.schemaVersion, 1);
  assert.deepEqual(exported.sessions.map((session) => session.sessionId), ["session-a"]);
  assert.equal(exported.directorPerformances.length, 1);
  assert.equal(JSON.stringify(exported).includes("owner-b"), false);

  const deleted = await repository.deleteOwnerStoryData("owner-a");
  assert.deepEqual(deleted, {
    ownerId: "owner-a",
    deletedSessions: 1,
    deletedEvents: 0,
    deletedDirectorPerformances: 1,
  });
  assert.equal(await repository.getOwned("owner-a", "session-a"), undefined);
  assert.equal((await repository.getOwned("owner-b", "session-b")).sessionId, "session-b");
  assert.ok(await repository.getRelease(investigationWorld.manifest.id, investigationWorld.manifest.version));
});

test("Postgres lifecycle SQL deletes performances and events before owner sessions", () => {
  assert.match(POSTGRES_SQL.selectOwnerSessions, /WHERE owner_id = \$1/);
  assert.match(POSTGRES_SQL.selectOwnerEvents, /session\.owner_id = \$1/);
  assert.match(POSTGRES_SQL.selectOwnerPerformances, /WHERE owner_id = \$1/);
  assert.match(POSTGRES_SQL.deleteOwnerPerformances, /DELETE FROM storyframe_director_performances/);
  assert.match(POSTGRES_SQL.deleteOwnerEvents, /USING storyframe_sessions/);
  assert.match(POSTGRES_SQL.deleteOwnerSessions, /DELETE FROM storyframe_sessions/);
});

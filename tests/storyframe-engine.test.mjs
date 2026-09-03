import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createSession,
  getAvailableIntents,
  replay,
  resolveTurn,
} from "@storyframe/engine-core";
import {
  projectCreatorView,
  projectDebugView,
  projectModelView,
  projectPlayerView,
} from "@storyframe/projections";
import {
  investigationWorld,
  survivalWorld,
  tradingWorld,
} from "@storyframe/test-fixtures";

function newSession(world, suffix = "one", seed = 42) {
  return createSession(world, {
    sessionId: `session-${suffix}`,
    ownerId: "owner-one",
    seed,
  });
}

function commit(world, state, intentId, mutationId) {
  const result = resolveTurn({
    world,
    state,
    command: { intentId },
    expectedStateVersion: state.stateVersion,
    mutationId,
  });
  assert.equal(result.status, "committed", JSON.stringify(result));
  return result;
}

test("investigation, survival, and trading worlds share one runtime API", () => {
  let investigation = newSession(investigationWorld, "investigation");
  investigation = commit(
    investigationWorld,
    investigation,
    "inspect_red_thread",
    "investigate-1",
  ).state;
  assert.deepEqual(investigation.clues, ["red_thread"]);

  let survival = newSession(survivalWorld, "survival");
  survival = commit(survivalWorld, survival, "travel_to_outpost", "travel-1").state;
  assert.equal(survival.resources.supplies, 2);
  assert.equal(survival.clocks.day, 1);
  assert.equal(survival.locationId, "outpost");

  let trading = newSession(tradingWorld, "trading");
  trading = commit(tradingWorld, trading, "buy_spice", "trade-1").state;
  assert.equal(trading.resources.credits, 6);
  assert.equal(trading.inventory.spice, 1);
});

test("same world, seed, state, and command produce identical mechanical results", () => {
  const first = newSession(survivalWorld, "deterministic", 987654);
  const second = newSession(survivalWorld, "deterministic", 987654);
  const firstResult = commit(survivalWorld, first, "search_for_supplies", "search-1");
  const secondResult = commit(survivalWorld, second, "search_for_supplies", "search-1");

  assert.deepEqual(firstResult.events, secondResult.events);
  assert.deepEqual(firstResult.state, secondResult.state);
  assert.equal(firstResult.events[0].randomOutcomes.length, 1);
});

test("committed events deterministically replay into the same state", () => {
  const initial = newSession(investigationWorld, "replay");
  const events = [];
  let state = initial;

  for (const [intentId, mutationId] of [
    ["inspect_red_thread", "replay-1"],
    ["inspect_broken_seal", "replay-2"],
    ["inspect_false_date", "replay-3"],
  ]) {
    const result = commit(investigationWorld, state, intentId, mutationId);
    events.push(...result.events);
    state = result.state;
  }

  assert.deepEqual(replay(investigationWorld, initial, events), state);
  assert.equal(state.frameId, "resolution");
  assert.equal(state.stateVersion, 3);
  assert.equal(state.turn, 3);
});

test("repeated mutation IDs do not apply a turn twice", () => {
  const initial = newSession(tradingWorld, "duplicate");
  const first = commit(tradingWorld, initial, "buy_spice", "same-mutation");
  const repeated = resolveTurn({
    world: tradingWorld,
    state: first.state,
    command: { intentId: "buy_spice" },
    expectedStateVersion: initial.stateVersion,
    mutationId: "same-mutation",
  });

  assert.equal(repeated.status, "duplicate");
  assert.equal(repeated.state.stateVersion, 1);
  assert.equal(repeated.state.resources.credits, 6);
  assert.equal(repeated.state.inventory.spice, 1);
});

test("stale and invalid commands are rejected transactionally", () => {
  const initial = newSession(tradingWorld, "invalid");
  const stale = resolveTurn({
    world: tradingWorld,
    state: initial,
    command: { intentId: "buy_spice" },
    expectedStateVersion: 99,
    mutationId: "stale",
  });
  assert.equal(stale.status, "rejected");
  assert.equal(stale.code, "version-conflict");
  assert.deepEqual(stale.state, initial);

  const unknown = resolveTurn({
    world: tradingWorld,
    state: initial,
    command: { intentId: "agency_override" },
    expectedStateVersion: 0,
    mutationId: "unknown",
  });
  assert.equal(unknown.status, "rejected");
  assert.equal(unknown.code, "unknown-intent");
  assert.deepEqual(unknown.state, initial);

  const invalidMutation = resolveTurn({
    world: tradingWorld,
    state: initial,
    command: { intentId: "buy_spice" },
    expectedStateVersion: 0,
    mutationId: "__proto__",
  });
  assert.equal(invalidMutation.status, "rejected");
  assert.deepEqual(invalidMutation.state, initial);
});

test("an invariant failure rolls back every operation in the proposed turn", () => {
  const unsafeWorld = structuredClone(survivalWorld);
  unsafeWorld.intents[0].effects = [
    { kind: "adjust-resource", resourceId: "supplies", amount: -99 },
    { kind: "transition", frameId: "should-not-commit" },
  ];
  const initial = newSession(unsafeWorld, "rollback");
  const result = resolveTurn({
    world: unsafeWorld,
    state: initial,
    command: { intentId: "travel_to_outpost" },
    expectedStateVersion: 0,
    mutationId: "rollback-1",
  });

  assert.equal(result.status, "rejected");
  assert.equal(result.code, "state-invariant");
  assert.deepEqual(result.state, initial);
});

test("secret facts and creator-only ledger entries are absent from player and model JSON", () => {
  const initial = newSession(investigationWorld, "secret");
  const first = commit(
    investigationWorld,
    initial,
    "inspect_red_thread",
    "secret-1",
  ).state;

  const playerJson = JSON.stringify(projectPlayerView(investigationWorld, first));
  const modelJson = JSON.stringify(projectModelView(investigationWorld, first));
  const creatorJson = JSON.stringify(projectCreatorView(investigationWorld, first));
  const debugJson = JSON.stringify(projectDebugView(investigationWorld, first));

  assert.equal(playerJson.includes("The caretaker forged the missing ledger."), false);
  assert.equal(modelJson.includes("The caretaker forged the missing ledger."), false);
  assert.equal(modelJson.includes('"canonId":"culprit"'), false);
  assert.equal(playerJson.includes("caretaker-private-motive"), false);
  assert.equal(modelJson.includes("caretaker-private-motive"), false);
  assert.equal(creatorJson.includes("The caretaker forged the missing ledger."), true);
  assert.equal(debugJson.includes("The caretaker forged the missing ledger."), true);
  assert.equal(playerJson.includes("owner-one"), false);
  assert.equal(modelJson.includes("owner-one"), false);
});

test("revealed canon enters authorized projections only after the reveal rule commits", () => {
  let state = newSession(investigationWorld, "reveal");
  state = commit(investigationWorld, state, "inspect_red_thread", "reveal-1").state;
  state = commit(investigationWorld, state, "inspect_broken_seal", "reveal-2").state;
  assert.equal(
    JSON.stringify(projectPlayerView(investigationWorld, state)).includes("forged the missing ledger"),
    false,
  );
  state = commit(investigationWorld, state, "inspect_false_date", "reveal-3").state;
  assert.equal(
    JSON.stringify(projectPlayerView(investigationWorld, state)).includes("forged the missing ledger"),
    true,
  );
});

test("available intents reflect conditions without exposing engine internals", () => {
  const initial = newSession(investigationWorld, "intents");
  assert.deepEqual(
    getAvailableIntents(investigationWorld, initial).map((intent) => intent.id),
    ["inspect_red_thread", "inspect_broken_seal", "inspect_false_date"],
  );
  const next = commit(investigationWorld, initial, "inspect_red_thread", "intents-1").state;
  assert.deepEqual(
    getAvailableIntents(investigationWorld, next).map((intent) => intent.id),
    ["inspect_broken_seal", "inspect_false_date"],
  );
});

test("engine-core source contains no Agency-specific branches", async () => {
  const source = await readFile(new URL("../packages/engine-core/src/index.ts", import.meta.url), "utf8");
  assert.equal(/agency|applicant|caseworker/i.test(source), false);
});

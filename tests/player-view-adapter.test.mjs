import assert from "node:assert/strict";
import test from "node:test";
import { resetSessionsForTests } from "../server/dist/engine.js";
import {
  getStoryState,
  getCharacterRecap,
  getWorldRecap,
  resetPlayerViewAdapterForTests,
  startStorySession,
  submitStoryIntent,
} from "../server/dist/player-view.js";

async function reset() {
  resetSessionsForTests();
  resetPlayerViewAdapterForTests();
}

test("player projection contains presentation metadata but no unreleased artifacts", async () => {
  await reset();
  const view = await startStorySession();
  assert.equal(view.audience, "player");
  assert.equal(view.presentation.layout, "focus");
  assert.deepEqual(view.presentation.frame, { kind: "default-crt" });
  assert.equal(view.artifacts.length, 3);
  assert.equal(view.artifacts.some((artifact) => artifact.id === "original-assignee"), false);
  assert.equal("playerId" in view, false);
  assert.equal("stage" in view, false);
  assert.equal("visible" in view.artifacts[0], false);
});

test("generic story intents are retry-safe by mutation id", async () => {
  await reset();
  const initial = await startStorySession();
  const input = {
    sessionId: initial.session.id,
    intentId: "confirm_alive",
    expectedStateVersion: initial.session.stateVersion,
    mutationId: "retry-once",
  };
  const first = await submitStoryIntent(input);
  const duplicate = await submitStoryIntent(input);
  assert.equal(first.status, "committed");
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.view.session.stateVersion, first.view.session.stateVersion);
});

test("stale component actions restore the latest authoritative player view", async () => {
  await reset();
  const initial = await startStorySession();
  const committed = await submitStoryIntent({
    sessionId: initial.session.id,
    intentId: "confirm_alive",
    expectedStateVersion: initial.session.stateVersion,
    mutationId: "first-turn",
  });
  const rejected = await submitStoryIntent({
    sessionId: initial.session.id,
    intentId: "express_uncertainty",
    expectedStateVersion: initial.session.stateVersion,
    mutationId: "stale-turn",
  });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.code, "version-conflict");
  assert.equal(rejected.view.session.stateVersion, committed.view.session.stateVersion);
  assert.match(rejected.message, /latest moment/i);
});

test("compiled Agency sessions enforce owner scope and reach a terminal ending", async () => {
  await reset();
  let view = await startStorySession("owner-a");
  await assert.rejects(() => getStoryState(view.session.id, "owner-b"), /not found/i);

  const path = [
    "confirm_alive",
    "deny_previous_life",
    "examine_personnel_a17",
    "examine_elevator_1974",
  ];
  for (const [index, intentId] of path.entries()) {
    const result = await submitStoryIntent({
      ownerId: "owner-a",
      sessionId: view.session.id,
      intentId,
      expectedStateVersion: view.session.stateVersion,
      mutationId: `compiled-agency-${index}`,
    });
    assert.equal(result.status, "committed");
    view = result.view;
  }
  assert.equal(view.artifacts.some((artifact) => artifact.id === "original-assignee"), false);

  for (const [index, intentId] of [
    "examine_childhood_kit",
    "examine_original_assignee",
    "retain_life",
  ].entries()) {
    const result = await submitStoryIntent({
      ownerId: "owner-a",
      sessionId: view.session.id,
      intentId,
      expectedStateVersion: view.session.stateVersion,
      mutationId: `compiled-agency-final-${index}`,
    });
    assert.equal(result.status, "committed");
    view = result.view;
  }
  assert.equal(view.session.status, "complete");
  assert.equal(view.presentation.layout, "complete");
  assert.equal(view.ending.title, "Notice of Continued Existence");
});

test("character and world recaps remain player-safe and owner-scoped", async () => {
  await reset();
  const view = await startStorySession("owner-a");
  const characters = await getCharacterRecap(view.session.id, "owner-a");
  assert.deepEqual(characters.characters.map((character) => character.name), ["Caseworker 43"]);
  assert.deepEqual(characters.characters[0].observations, []);

  const world = await getWorldRecap(view.session.id, "owner-a");
  assert.deepEqual(world.releasedClues.map((clue) => clue.id), [
    "personnel-a17",
    "elevator-1974",
    "childhood-kit",
  ]);
  assert.equal(JSON.stringify(world).includes("Applicant 71-442-B"), false);
  assert.equal(JSON.stringify(world).includes("original-assignee"), false);
  await assert.rejects(() => getWorldRecap(view.session.id, "owner-b"), /not found/i);
});

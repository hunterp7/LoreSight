import assert from "node:assert/strict";
import test from "node:test";
import { createSession, resolveTurn } from "@storyframe/engine-core";
import {
  auditStoryline,
  explainIntent,
  explainTurn,
  simulateCorrection,
} from "@storyframe/story-debugger";
import { investigationWorld } from "@storyframe/test-fixtures";

function newSession(suffix = "debugger") {
  return createSession(investigationWorld, {
    sessionId: `session-${suffix}`,
    ownerId: "owner-debugger",
    seed: 42,
  });
}

function commit(state, intentId, mutationId) {
  const result = resolveTurn({
    world: investigationWorld,
    state,
    command: { intentId },
    expectedStateVersion: state.stateVersion,
    mutationId,
  });
  assert.equal(result.status, "committed", JSON.stringify(result));
  return result;
}

function play(intents, suffix = "debugger") {
  const initial = newSession(suffix);
  const events = [];
  let state = initial;
  intents.forEach((intentId, index) => {
    const result = commit(state, intentId, `${suffix}-${index + 1}`);
    events.push(...result.events);
    state = result.state;
  });
  return { initial, events, state };
}

test("turn traces explain intent, operations, rule outcomes, and authored source", () => {
  const { initial, events } = play(["inspect_red_thread"], "explain");
  const explanation = explainTurn(investigationWorld, events[0]);

  assert.equal(explanation.intentId, "inspect_red_thread");
  assert.equal(explanation.intentSource.range.start.line, 30);
  assert.match(explanation.operations[0].summary, /Added clue red_thread/);
  assert.deepEqual(explanation.rules.map((rule) => rule.outcome), ["condition-false"]);

  const unavailable = explainIntent(investigationWorld, commit(
    initial,
    "inspect_red_thread",
    "availability-1",
  ).state, "inspect_red_thread");
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.conditionResult, false);
  assert.match(unavailable.message, /condition evaluated to false/);
});

test("story audit validates deterministic history without mutating the snapshot", () => {
  const run = play(["inspect_red_thread", "inspect_broken_seal"], "audit");
  const snapshotBefore = structuredClone(run.initial);
  const report = auditStoryline(investigationWorld, run.initial, run.events);

  assert.equal(report.ok, true);
  assert.equal(report.finalState.stateVersion, 2);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(run.initial, snapshotBefore);
});

test("story audit pinpoints a live narrative dead end at its source frame", () => {
  const run = play(
    ["inspect_red_thread", "inspect_broken_seal", "inspect_false_date"],
    "dead-end",
  );
  const report = auditStoryline(investigationWorld, run.initial, run.events);
  const deadEnd = report.issues.find((issue) => issue.code === "dead-end");

  assert.equal(report.ok, false);
  assert.equal(deadEnd.stateVersion, 3);
  assert.equal(deadEnd.source.semanticId, "resolution");
});

test("story audit detects a tampered event that still satisfies state invariants", () => {
  const run = play(["inspect_red_thread"], "tamper");
  const tampered = structuredClone(run.events);
  tampered[0].operations = [];
  const report = auditStoryline(investigationWorld, run.initial, tampered);

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.code === "event-divergence"), true);
});

test("corrections fork history and return an explicit before/after state diff", () => {
  const run = play(["inspect_red_thread", "inspect_broken_seal"], "original");
  const originalStateBefore = structuredClone(run.state);
  const simulation = simulateCorrection({
    world: investigationWorld,
    initialState: run.initial,
    events: run.events,
    forkAtVersion: 1,
    branchSessionId: "session-correction",
    command: { intentId: "inspect_false_date" },
    mutationId: "correction-2",
  });

  assert.equal(simulation.correction.status, "committed");
  assert.equal(simulation.branch.originalSessionId, "session-original");
  assert.equal(simulation.branch.branchSessionId, "session-correction");
  assert.deepEqual(simulation.branch.retainedEventIds, [run.events[0].id]);
  assert.equal(simulation.differences.some((difference) => difference.path === "clues"), true);
  assert.deepEqual(run.state, originalStateBefore);
});

import assert from "node:assert/strict";
import { createSession, resolveTurn } from "@storyframe/engine-core";
import { auditStoryline, explainTurn, simulateCorrection } from "@storyframe/story-debugger";
import { investigationWorld } from "@storyframe/test-fixtures";

const initial = createSession(investigationWorld, {
  sessionId: "debug-example-original",
  ownerId: "local-tester",
  seed: 42,
});
const events = [];
let state = initial;

for (const [index, intentId] of [
  "inspect_red_thread",
  "inspect_broken_seal",
  "inspect_false_date",
].entries()) {
  const result = resolveTurn({
    world: investigationWorld,
    state,
    command: { intentId },
    expectedStateVersion: state.stateVersion,
    mutationId: `debug-example-${index + 1}`,
  });
  assert.equal(result.status, "committed");
  events.push(...result.events);
  state = result.state;
}

const audit = auditStoryline(investigationWorld, initial, events);
const correction = simulateCorrection({
  world: investigationWorld,
  initialState: initial,
  events,
  forkAtVersion: 1,
  branchSessionId: "debug-example-correction",
  command: { intentId: "inspect_false_date" },
  mutationId: "debug-example-correction-2",
});

console.log(JSON.stringify({
  audit: {
    ok: audit.ok,
    finalFrame: audit.finalState.frameId,
    issues: audit.issues,
    finalTurn: explainTurn(investigationWorld, events.at(-1)),
  },
  correction: {
    branch: correction.branch,
    status: correction.correction.status,
    differences: correction.differences,
  },
}, null, 2));

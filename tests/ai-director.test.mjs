import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FailingDirectorProvider,
  StaticDirectorProvider,
  performCurrentFrame,
  validatePerformance,
} from "../packages/ai-director/dist/index.js";
import { createSession } from "@storyframe/engine-core";
import { compileStoryframe } from "@storyframe/storyframe";

async function investigation() {
  const url = new URL("../worlds/conformance/investigation.storyframe", import.meta.url);
  const result = compileStoryframe(await readFile(url, "utf8"), url.pathname);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics, null, 2));
  return result.world;
}

function candidate(overrides = {}) {
  return {
    narration: "The archive was locked overnight. Three physical details conflict with the official record, and you must choose which detail to inspect first.",
    dialogue: [],
    completedBeatIds: ["investigate.exact.1", "investigate.establish.1", "investigate.establish.2"],
    surfacedIntentIds: ["inspect_red_thread", "inspect_broken_seal", "inspect_false_date"],
    proposedSessionDetails: [{ id: "archive-hum", text: "A low electrical hum fills the archive.", persistence: "session" }],
    referencedCanonIds: ["archive_is_locked"],
    ...overrides,
  };
}

test("Director accepts a structured performance and advances only declared beat progress", async () => {
  const world = await investigation();
  const state = createSession(world, { sessionId: "director-valid", ownerId: "test", seed: 42 });
  const result = await performCurrentFrame({ world, state, provider: new StaticDirectorProvider(candidate()) });
  assert.equal(result.status, "generated");
  assert.equal(result.attempts, 1);
  assert.deepEqual(result.progress.completedBeatIds, [
    "investigate.exact.1",
    "investigate.establish.1",
    "investigate.establish.2",
  ]);
  assert.deepEqual(result.progress.acceptedSessionDetails.map((detail) => detail.id), ["archive-hum"]);
  assert.match(result.traceId, /director-valid:0:investigate:1/);
});

test("Director rejects hidden canon and falls back without changing engine state", async () => {
  const world = await investigation();
  const state = createSession(world, { sessionId: "director-hidden", ownerId: "test", seed: 42 });
  const before = structuredClone(state);
  const result = await performCurrentFrame({
    world,
    state,
    maxAttempts: 1,
    provider: new StaticDirectorProvider(candidate({ referencedCanonIds: ["culprit"] })),
  });
  assert.equal(result.status, "fallback");
  assert.equal(result.issues.some((issue) => issue.code === "hidden-canon-reference"), true);
  assert.match(result.performance.narration, /thread, wax, and clock/);
  assert.deepEqual(state, before);
});

test("Director rejects missing exact wording, unavailable actions, and unknown speakers", async () => {
  const world = await investigation();
  const state = createSession(world, { sessionId: "director-invalid", ownerId: "test", seed: 42 });
  const frame = world.frames[0];
  const checked = validatePerformance(world, state, frame, candidate({
    narration: "The room is quiet.",
    dialogue: [{ speakerId: "invented_witness", text: "I saw everything." }],
    surfacedIntentIds: ["invent_solution"],
  }));
  assert.equal(checked.performance, undefined);
  assert.deepEqual(new Set(checked.issues.map((issue) => issue.code)), new Set([
    "missing-exact-line",
    "unknown-intent",
    "unknown-speaker",
  ]));
});

test("Director provider failure uses authored fallback after bounded retries", async () => {
  const world = await investigation();
  const state = createSession(world, { sessionId: "director-failure", ownerId: "test", seed: 42 });
  const result = await performCurrentFrame({ world, state, provider: new FailingDirectorProvider(), maxAttempts: 2 });
  assert.equal(result.status, "fallback");
  assert.equal(result.attempts, 2);
  assert.equal(result.issues.length, 2);
  assert.equal(result.progress.completedBeatIds.includes("investigate.establish.2"), true);
});

test("Director telemetry records bounded metadata without performance text", async () => {
  const world = await investigation();
  const state = createSession(world, { sessionId: "director-telemetry", ownerId: "test", seed: 42 });
  const events = [];
  const ticks = [100, 108];
  const result = await performCurrentFrame({
    world,
    state,
    provider: new StaticDirectorProvider(candidate()),
    telemetry: { record(event) { events.push(event); } },
    nowMs: () => ticks.shift() ?? 108,
  });
  assert.equal(result.status, "generated");
  assert.deepEqual(events.map((event) => [event.type, event.status]), [
    ["attempt", "accepted"],
    ["result", "generated"],
  ]);
  assert.equal(events[0].durationMs, 8);
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes("archive was locked"), false);
  assert.equal(serialized.includes("narration"), false);
  assert.equal(serialized.includes("dialogue"), false);
});

test("Director telemetry failure cannot disable authored fallback", async () => {
  const world = await investigation();
  const state = createSession(world, { sessionId: "director-telemetry-fail", ownerId: "test", seed: 42 });
  const result = await performCurrentFrame({
    world,
    state,
    provider: new FailingDirectorProvider(),
    maxAttempts: 1,
    telemetry: { record() { throw new Error("collector unavailable"); } },
    nowMs: () => 10,
  });
  assert.equal(result.status, "fallback");
  assert.match(result.performance.narration, /thread, wax, and clock/);
});

test("semantic evaluator can reject implied meaning and force authored fallback", async () => {
  const world = await investigation();
  const state = createSession(world, { sessionId: "director-semantic", ownerId: "test", seed: 42 });
  const result = await performCurrentFrame({
    world,
    state,
    provider: new StaticDirectorProvider(candidate()),
    maxAttempts: 1,
    semanticEvaluator: {
      async evaluate(request) {
        assert.equal(JSON.stringify(request.modelView).includes("culprit"), false);
        return [{ code: "semantic-establish-failed", message: "Required meaning was contradicted." }];
      },
    },
  });
  assert.equal(result.status, "fallback");
  assert.equal(result.issues.some((issue) => issue.code === "semantic-establish-failed"), true);
});

test("semantic evaluator failure rejects generated prose without blocking play", async () => {
  const world = await investigation();
  const state = createSession(world, { sessionId: "director-semantic-fail", ownerId: "test", seed: 42 });
  const result = await performCurrentFrame({
    world,
    state,
    provider: new StaticDirectorProvider(candidate()),
    maxAttempts: 1,
    semanticEvaluator: { async evaluate() { throw new Error("evaluator timeout"); } },
  });
  assert.equal(result.status, "fallback");
  assert.equal(result.issues.some((issue) => issue.code === "semantic-evaluation-failed"), true);
});

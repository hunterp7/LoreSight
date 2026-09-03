import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSession, replay, resolveTurn } from "@storyframe/engine-core";
import { projectModelView, projectPlayerView } from "@storyframe/projections";
import {
  auditStoryline,
  exploreStoryBranches,
  runAuthoredWorldTests,
} from "@storyframe/story-debugger";
import { compileStoryframe, lexStoryframe, parseStoryframe } from "@storyframe/storyframe";

const fixtureUrls = {
  investigation: new URL("../worlds/conformance/investigation.storyframe", import.meta.url),
  survival: new URL("../worlds/conformance/survival.storyframe", import.meta.url),
  trading: new URL("../worlds/conformance/trading.storyframe", import.meta.url),
};

async function compileFixture(name) {
  const source = await readFile(fixtureUrls[name], "utf8");
  const result = compileStoryframe(source, fixtureUrls[name].pathname);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics, null, 2));
  return { source, ...result };
}

function session(world, suffix) {
  return createSession(world, {
    sessionId: `compiled-${suffix}`,
    ownerId: "compiler-test",
    seed: 987654,
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

test("lexer preserves comments and precise source locations", () => {
  const source = "# heading\nWORLD sample.world v1.0.0\n  title: Sample\n";
  const lexed = lexStoryframe(source, "sample.storyframe");
  assert.equal(lexed.diagnostics.length, 0);
  assert.equal(lexed.tokens[0].kind, "comment");
  assert.equal(lexed.tokens[1].range.start.line, 2);
  assert.equal(lexed.tokens[2].indent, 1);
  assert.equal(lexed.tokens[2].range.start.column, 3);

  const parsed = parseStoryframe(source, "sample.storyframe");
  assert.equal(parsed.document.comments[0].text, "heading");
  assert.equal(parsed.document.declarations[0].range.end.line, 3);
});

test("all three conformance genres compile and run through engine-core", async () => {
  const investigation = (await compileFixture("investigation")).world;
  let investigationState = session(investigation, "investigation");
  assert.deepEqual(projectPlayerView(investigation, investigationState).artifacts, []);
  assert.deepEqual(projectModelView(investigation, investigationState).artifacts, []);
  const investigationEvents = [];
  for (const [index, intentId] of [
    "inspect_red_thread",
    "inspect_broken_seal",
    "inspect_false_date",
    "review_case_summary",
    "acknowledge_solution",
  ].entries()) {
    const result = commit(investigation, investigationState, intentId, `compiled-investigation-${index}`);
    investigationEvents.push(...result.events);
    investigationState = result.state;
  }
  assert.equal(investigationState.status, "complete");
  assert.equal(investigationState.revealedCanonIds.includes("culprit"), true);
  assert.deepEqual(replay(investigation, session(investigation, "investigation"), investigationEvents), investigationState);
  assert.equal(auditStoryline(investigation, session(investigation, "investigation"), investigationEvents).ok, true);

  const beforeReveal = commit(
    investigation,
    session(investigation, "secret-projection"),
    "inspect_red_thread",
    "compiled-secret-1",
  ).state;
  assert.equal(JSON.stringify(projectPlayerView(investigation, beforeReveal)).includes("forged the missing ledger"), false);
  assert.equal(JSON.stringify(projectModelView(investigation, beforeReveal)).includes("forged the missing ledger"), false);
  assert.equal(projectPlayerView(investigation, beforeReveal).artifacts.length, 1);
  assert.equal(projectPlayerView(investigation, beforeReveal).artifacts[0].id, "red_thread_photo");
  assert.equal(projectModelView(investigation, beforeReveal).artifacts[0].asset, undefined);

  const survival = (await compileFixture("survival")).world;
  const survivalInitial = session(survival, "survival");
  const search = commit(survival, survivalInitial, "search_for_supplies", "compiled-search");
  assert.equal(search.events[0].randomOutcomes.length, 1);
  const travel = commit(survival, search.state, "travel_to_outpost", "compiled-travel");
  assert.equal(travel.state.status, "complete");

  const trading = (await compileFixture("trading")).world;
  const tradingInitial = session(trading, "trading");
  const purchase = commit(trading, tradingInitial, "buy_spice", "compiled-buy");
  assert.equal(purchase.state.resources.credits, 6);
  assert.equal(purchase.state.inventory.spice, 1);
});

test("compiler output and generated source maps are deterministic", async () => {
  const { source } = await compileFixture("investigation");
  const first = compileStoryframe(source, "fixture.storyframe");
  const second = compileStoryframe(source, "fixture.storyframe");
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(JSON.stringify(first.world), JSON.stringify(second.world));
  const intentLine = first.world.sourceMap["intent:inspect_red_thread"].range.start.line;
  assert.match(source.split("\n")[intentLine - 1], /^INTENT inspect_red_thread$/);
  assert.equal(first.world.sourceMap["rule:reveal_culprit_after_three_clues"].kind, "rule");
  const clueLine = first.world.sourceMap["state:clue.red_thread"].range.start.line;
  assert.match(source.split("\n")[clueLine - 1], /^  clue red_thread = false/);
  assert.equal(first.world.sourceMap["artifact:red_thread_photo"].kind, "artifact");
  assert.equal(first.world.sourceMap["span:verification_span"].kind, "span");
});

test("advanced narrative declarations compile into executable contracts", async () => {
  const world = (await compileFixture("investigation")).world;
  assert.equal(world.frames?.[0].title, "Archive inspection");
  assert.match(world.frames?.[0].text, /three details do not agree/);
  assert.deepEqual(world.frames?.[0].performance, {
    beats: [
      { id: "investigate.exact.1", authority: "exact", text: "The archive was locked overnight." },
      { id: "investigate.establish.1", authority: "establish", text: "Three physical details conflict with the official record." },
      { id: "investigate.establish.2", authority: "establish", text: "The player must choose which detail to inspect first." },
      { id: "investigate.suggest.1", authority: "suggest", text: "Keep the room quiet and the evidence visually precise." },
    ],
    forbiddenClaims: [
      "Identify who forged the ledger before the evidence reveals it.",
      "Resolve the archive patron's identity.",
    ],
    fallback: [
      "The cabinet remains sealed, but the thread, wax, and clock cannot all be telling the same story.",
      "Choose what to inspect first.",
    ],
  });
  assert.equal(world.sourceMap["frame:investigate.exact.1"].kind, "frame");
  assert.deepEqual(world.spans?.[0], {
    spanId: "verification_span",
    targetFrameId: "resolution",
    purpose: "Let the player connect the three clues before closing the case.",
    turnRange: { min: 1, max: 2 },
    requiredBeats: [
      {
        id: "verification_span.beat.1",
        text: "Connect the thread, seal, and false date into one coherent sequence.",
      },
      {
        id: "verification_span.beat.2",
        text: "Preserve the boundary around the unresolved patron identity.",
      },
    ],
    curves: [
      { dimension: "certainty", start: 2, end: 5 },
      { dimension: "urgency", start: 3, end: 1 },
    ],
    mayInvent: ["sensory details inside the archive", "concise evidence transitions"],
    mayNotInvent: ["new suspects", "new evidence", "the patron identity"],
    inventionPersistence: "turn",
    hiddenCanonIds: ["patron_identity"],
    hiddenArtifactIds: [],
    availableIntentIds: ["review_case_summary"],
    exit: { requiredBeatsComplete: true, condition: undefined },
    fallback: [
      "The three physical clues now describe one deliberate sequence of events.",
      "One identity remains outside the case and must stay unresolved.",
    ],
  });
  assert.deepEqual(world.threads?.[0], {
    id: "forged_ledger",
    plantFrameId: "investigate",
    echoIds: ["red_thread", "broken_seal", "false_date"],
    revealFrameId: "verification_span",
    payoffFrameId: "resolution",
    neverResolveIds: ["patron_identity"],
    optional: false,
  });
  assert.deepEqual(world.choices?.[0], {
    id: "investigation_methods",
    availableInFrames: ["investigate"],
    intentIds: ["inspect_red_thread", "inspect_broken_seal", "inspect_false_date"],
  });
  assert.equal(world.tests?.length, 2);
});

test("frame performance contracts require authored meaning and a safe fallback", () => {
  const source = `WORLD invalid.performance v1.0.0
  title: Invalid performance
  owner: Test
  rights: original
  engine: 0.1.0
FRAME start
  suggest:
    - Make the room ominous.
  never:
    - Explain the locked door.
STATE
  frame: start
INTENT wait
  title: Wait
  description: Remain in the room.
  frames: start
  effects:
    - complete
`;
  const result = compileStoryframe(source, "invalid-performance.storyframe");
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === "frame-without-required-performance"), true);
  assert.equal(result.diagnostics.some((item) => item.code === "missing-frame-fallback"), true);
});

test("authored tests and branch exploration expose story regressions", async () => {
  const world = (await compileFixture("investigation")).world;
  const authored = runAuthoredWorldTests(world);
  assert.equal(authored.ok, true, JSON.stringify(authored, null, 2));
  assert.equal(authored.passed, 2);

  const coverage = exploreStoryBranches(world, { maxDepth: 6, maxStates: 500, seed: 42 });
  assert.equal(coverage.complete, true, JSON.stringify(coverage, null, 2));
  assert.deepEqual(coverage.unreachedFrameIds, []);
  assert.deepEqual(coverage.unexercisedIntentIds, []);
  assert.deepEqual(coverage.unfiredRuleIds, []);
  assert.deepEqual(coverage.deadEnds, []);
  assert.deepEqual(coverage.rejections, []);
  assert.deepEqual(coverage.coverage, { frames: 100, intents: 100, rules: 100 });

  const regressed = structuredClone(world);
  regressed.tests[0].assertions.push({ kind: "frame", frameId: "resolution" });
  const failed = runAuthoredWorldTests(regressed);
  assert.equal(failed.ok, false);
  assert.match(failed.results[0].failures[0].message, /Expected frame resolution/);
});

test("malformed indentation and unknown references produce repair guidance", () => {
  const source = `WORLD invalid.world v1.0.0
  title: Invalid
  owner: Test
  rights: original
  engine: 0.1.0
FRAME start
STATE
  frame: start
  resource credits = 1 range 0..10
INTENT broken
  title: Broken
  description: References undeclared mechanics.
  frames: missing_frame
  effects:
    - adjust resource missing_resource by -1
`;
  const result = compileStoryframe(source, "invalid.storyframe");
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === "unknown-frame-reference"), true);
  const target = result.diagnostics.find((item) => item.code === "unknown-effect-target");
  assert.equal(target.range.sourceId, "invalid.storyframe");
  assert.match(target.guidance, /Declare missing_resource/);

  const tabs = compileStoryframe(source.replace("  title", "\ttitle"), "tabs.storyframe");
  assert.equal(tabs.ok, false);
  assert.equal(tabs.diagnostics.some((item) => item.code === "tabs-not-allowed"), true);
});

test("static graph validation rejects unreachable frames and actionless live frames", () => {
  const source = `WORLD invalid.graph v1.0.0
  title: Invalid Graph
  owner: Test
  rights: original
  engine: 0.1.0
FRAME start
FRAME orphan
STATE
  frame: start
INTENT wait
  title: Wait
  description: Remain where you are.
  frames: start
  effects:
    - set location start
`;
  const result = compileStoryframe(source, "invalid-graph.storyframe");
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === "unreachable-frame"), true);
  assert.equal(result.diagnostics.some((item) => item.code === "static-dead-end"), true);
});

test("advanced declarations reject incomplete interpolation and thread contracts", () => {
  const source = `WORLD advanced.invalid v1.0.0
  title: Advanced Invalid
  owner: Test
  rights: original
  engine: 0.1.0
FRAME start
  terminal: true
STATE
  frame: start
THREAD unresolved_promise
  plant at start
SPAN unsafe_bridge -> start
  purpose: Fill time.
  turns: 0..2
  may invent: anything
`;
  const result = compileStoryframe(source, "advanced-invalid.storyframe");
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === "missing-thread-payoff"), true);
  assert.equal(result.diagnostics.some((item) => item.code === "invalid-span-turn-range"), true);
  assert.equal(result.diagnostics.some((item) => item.code === "missing-required-beats"), true);
  assert.equal(result.diagnostics.some((item) => item.code === "ambiguous-invention-scope"), true);
  assert.equal(result.diagnostics.some((item) => item.code === "missing-span-exit"), true);
  assert.equal(result.diagnostics.some((item) => item.code === "missing-span-fallback"), true);
});

test("advanced contracts reject protected invention and invalid authored-test status", () => {
  const source = `WORLD advanced.protection v1.0.0
  title: Advanced Protection
  owner: Test
  rights: original
  engine: 0.1.0
FRAME start
ENDING done
STATE
  frame: start
CANON boundaries
  SECRET patron_identity: The patron is the magistrate.
INTENT enter_bridge
  title: Enter bridge
  description: Begin the bounded narrative bridge.
  frames: start
  effects:
    - go bridge
INTENT leave_bridge
  title: Leave bridge
  description: Finish the bridge.
  frames: bridge
  effects:
    - go done
    - complete
SPAN bridge -> done
  purpose: Connect the authored frames.
  turns: 1..1
  required beats: Preserve the boundary.
  curve: certainty 1 -> 2
  may invent: details about patron_identity
  may not invent: new evidence
  persist inventions: turn
  hide: canon patron_identity
  offer: leave_bridge
  exit when: required_beats complete
  fallback: The boundary remains intact.
TEST invalid_status
  play: enter_bridge
  assert status: paused
`;
  const result = compileStoryframe(source, "advanced-protection.storyframe");
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === "invention-protection-conflict"), true);
  assert.equal(result.diagnostics.some((item) => item.code === "invalid-test-status"), true);
});

test("visual artifacts require both accessible fallback text and an approved asset", () => {
  const source = `WORLD invalid.artifact v1.0.0
  title: Invalid Artifact
  owner: Test
  rights: original
  engine: 0.1.0
ENDING done
STATE
  frame: done
ARTIFACT unreadable_map
  kind: map
  title: Unreadable Map
  summary: A map with no accessible equivalent.
  alt: A map.
`;
  const result = compileStoryframe(source, "invalid-artifact.storyframe");
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === "missing-artifact-text-fallback"), true);
  assert.equal(result.diagnostics.some((item) => item.code === "missing-visual-asset"), true);
});

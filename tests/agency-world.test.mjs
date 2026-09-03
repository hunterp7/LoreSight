import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSession } from "@storyframe/engine-core";
import { projectModelView, projectPlayerView } from "@storyframe/projections";
import { exploreStoryBranches, runAuthoredWorldTests } from "@storyframe/story-debugger";
import { compileStoryframe } from "@storyframe/storyframe";

const sourceUrl = new URL("../worlds/the-agency/applicant-intake.storyframe", import.meta.url);

test("Applicant Intake compiles from source with complete authored paths and coverage", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const compiled = compileStoryframe(source, sourceUrl.pathname);
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics, null, 2));
  assert.equal(compiled.world.manifest.version, "1.0.0");

  const authored = runAuthoredWorldTests(compiled.world);
  assert.equal(authored.ok, true, JSON.stringify(authored, null, 2));
  assert.equal(authored.passed, 4);

  const coverage = exploreStoryBranches(compiled.world, { maxDepth: 8, maxStates: 2_000, seed: 42 });
  assert.equal(coverage.complete, true, JSON.stringify(coverage, null, 2));
  assert.deepEqual(coverage.coverage, { frames: 100, intents: 100, rules: 100 });
  assert.deepEqual(coverage.deadEnds, []);
  assert.deepEqual(coverage.rejections, []);
});

test("Applicant Intake opening projection includes public records but omits the final note and recipient", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const compiled = compileStoryframe(source, sourceUrl.pathname);
  assert.equal(compiled.ok, true);
  const state = createSession(compiled.world, {
    sessionId: "agency-projection",
    ownerId: "owner-a",
    seed: 42,
  });
  const player = projectPlayerView(compiled.world, state);
  const model = projectModelView(compiled.world, state);
  assert.deepEqual(player.artifacts.map((artifact) => artifact.id), [
    "personnel-a17",
    "elevator-1974",
    "childhood-kit",
  ]);
  assert.equal(JSON.stringify(player).includes("Applicant 71-442-B"), false);
  assert.equal(JSON.stringify(model).includes("Applicant 71-442-B"), false);
  assert.equal(JSON.stringify(player).includes("original-assignee"), false);
  assert.equal(JSON.stringify(model).includes("original-assignee"), false);
});

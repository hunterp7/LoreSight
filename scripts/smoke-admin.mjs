import assert from "node:assert/strict";

const baseUrl = process.env.STORYFRAME_ADMIN_BASE_URL ?? "http://127.0.0.1:8787";
const token = process.env.STORYFRAME_ADMIN_TOKEN;
if (!token) throw new Error("STORYFRAME_ADMIN_TOKEN is required for the admin smoke test.");

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json();
  assert.equal(response.ok, true, JSON.stringify(payload));
  return payload;
}

const unauthorized = await fetch(`${baseUrl}/admin/api/overview`);
assert.equal(unauthorized.status, 401);

const overview = await api("/admin/api/overview");
assert.equal(overview.worlds.filter((world) => world.compileStatus === "ready").length, 3);
assert.equal(Number.isSafeInteger(overview.draftCount), true);
const investigationWorld = overview.worlds.find((world) => world.id === "conformance.compiled-investigation");
assert.equal(investigationWorld.spans, 1);
assert.deepEqual(investigationWorld.authoredTests, { ok: true, passed: 2, failed: 0 });
assert.deepEqual(investigationWorld.branchCoverage.coverage, { frames: 100, intents: 100, rules: 100 });
assert.equal(investigationWorld.branchCoverage.deadEnds, 0);
assert.match(investigationWorld.opening, /three details do not agree/);

const created = await api("/admin/api/playtests", {
  method: "POST",
  body: JSON.stringify({ worldId: "conformance.compiled-investigation", seed: 42 }),
});
const sessionId = created.state.sessionId;
assert.deepEqual(created.state.revealedArtifactIds, []);
assert.equal(created.scene.title, "Archive inspection");
assert.match(created.scene.text, /three details do not agree/);
assert.deepEqual(created.history, []);

const committed = await api(`/admin/api/playtests/${encodeURIComponent(sessionId)}/intents`, {
  method: "POST",
  body: JSON.stringify({
    intentId: "inspect_red_thread",
    expectedStateVersion: 0,
    mutationId: "admin-smoke-red-thread",
  }),
});
assert.equal(committed.result.status, "committed");
assert.deepEqual(committed.session.state.revealedArtifactIds, ["red_thread_photo"]);
assert.equal(committed.session.history[0].title, "Inspect the red thread");
assert.equal(committed.session.playerView.artifacts[0].title, "Cabinet Thread Photograph");

const correction = await api("/admin/api/corrections", {
  method: "POST",
  body: JSON.stringify({
    sessionId,
    forkAtVersion: 0,
    intentId: "inspect_broken_seal",
    reason: "Verify a replacement first clue without changing original history.",
  }),
});
assert.equal(correction.proposal.status, "committed");
assert.equal(correction.simulation.branch.originalSessionId, sessionId);
assert.equal(committed.session.state.revealedArtifactIds.includes("red_thread_photo"), true);

const compiled = await api("/admin/api/compile", {
  method: "POST",
  body: JSON.stringify({
    sourceId: "smoke.storyframe",
    source: `WORLD admin.smoke v1.0.0
  title: Admin Smoke
  owner: Storyframe
  rights: original
  engine: 0.1.0
ENDING done
STATE
  frame: done
`,
  }),
});
assert.equal(compiled.ok, true);
assert.equal(compiled.summary.id, "admin.smoke");
assert.equal(compiled.authoredTestReport.ok, true);
assert.equal(compiled.branchCoverage.deadEnds.length, 1);

const draftSource = `WORLD admin.saved-draft v1.0.0
  title: Saved Draft
  owner: Storyframe
  rights: original
  engine: 0.1.0
FRAME start
  establish:
    - The tester understands this draft survived a restart.
  fallback:
    - This private draft is ready for another review.
STATE
  frame: start
INTENT finish
  title: Finish
  description: Complete this draft path.
  frames: start
  effects:
    - complete
`;
const savedDraft = await api("/admin/api/drafts/admin-smoke", {
  method: "PUT",
  body: JSON.stringify({ title: "Saved Draft", source: draftSource }),
});
assert.equal(savedDraft.draft.compileStatus, "ready");
const loadedDraft = await api("/admin/api/drafts/admin-smoke");
assert.equal(loadedDraft.source, draftSource);
const draftList = await api("/admin/api/drafts");
assert.equal(draftList.drafts.some((draft) => draft.id === "admin-smoke"), true);
assert.equal(draftList.drafts.some((draft) => "source" in draft), false);

console.log(JSON.stringify({
  ok: true,
  worlds: overview.worlds.length,
  sessionId,
  artifactReveal: "red_thread_photo",
  correctionProposal: correction.proposal.id,
  savedDraft: savedDraft.draft.id,
}, null, 2));

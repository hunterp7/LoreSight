import assert from "node:assert/strict";
import test from "node:test";
import {
  OpenAiStoryGenerationProvider,
  inspectStoryframeSource,
  readStoryGenerationConfig,
  validateStoryProposal,
} from "../server/dist/generation.js";

const source = `WORLD test.generated v1.0.0
  title: Generated Test
  owner: Test
  rights: original
  engine: 0.1.0

FRAME start
  title: Start
  text: A small test world.

STATE
  frame: start
  flag looked = false audiences player, model, creator, debug

INTENT look
  title: Look around
  description: Look around the room.
  frames: start
  effects:
    - set flag looked = true
`;

test("story generation is explicit opt-in and bounded", () => {
  assert.equal(readStoryGenerationConfig({ OPENAI_API_KEY: "key" }), undefined);
  const config = readStoryGenerationConfig({ STORYFRAME_GENERATION_ENABLED: "true", OPENAI_API_KEY: "key", STORYFRAME_GENERATION_TIMEOUT_MS: "999999", STORYFRAME_GENERATION_MAX_OUTPUT_TOKENS: "1" });
  assert.deepEqual(config, { apiKey: "key", model: "gpt-5.6-sol", endpoint: "https://api.openai.com/v1/responses", timeoutMs: 120_000, maxOutputTokens: 1_000 });
});

test("source inspection returns a bounded privacy-safe fingerprint", () => {
  const inspection = inspectStoryframeSource(source);
  assert.equal(inspection.format, "storyframe");
  assert.equal(inspection.sha256.length, 64);
  assert.equal(inspection.storyframeSource, source);
});

test("OpenAI generation requests strict, non-stored proposal output", async () => {
  let sent;
  const provider = new OpenAiStoryGenerationProvider({ apiKey: "test-key", model: "test-model", endpoint: "https://api.openai.test/v1/responses", timeoutMs: 1_000, maxOutputTokens: 1_000 }, {
    fetch: async (_url, init) => {
      sent = { headers: init.headers, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ status: "completed", output_text: JSON.stringify({ source, summary: "A test", fidelityPlan: ["KEEP CLOSE: authored facts"], capabilityNotes: ["Uses deterministic intents"] }) }), { status: 200 });
    },
  });
  const result = await provider.generate({ mode: "new", prompt: "Create a tiny deterministic test story.", rights: "original" });
  assert.equal(result.source, source);
  assert.equal(sent.headers.Authorization, "Bearer test-key");
  assert.equal(sent.body.store, false);
  assert.equal(sent.body.text.format.strict, true);
  assert.equal(sent.body.text.format.schema.additionalProperties, false);
});

test("generated proposals must compile before becoming drafts", () => {
  const proposal = validateStoryProposal("new", { source, summary: "A test", fidelityPlan: [], capabilityNotes: [] });
  assert.equal(proposal.status, "draft");
  assert.equal(proposal.mode, "new");
  assert.equal(proposal.diagnostics.some((diagnostic) => diagnostic.severity === "error"), false);
  assert.throws(() => validateStoryProposal("remix", { source: "not StoryFrame", summary: "bad", fidelityPlan: [], capabilityNotes: [] }), /compiler validation/);
});

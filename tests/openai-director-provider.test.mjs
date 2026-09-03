import assert from "node:assert/strict";
import test from "node:test";
import {
  OpenAiResponsesDirectorProvider,
  OpenAiResponsesDirectorSemanticEvaluator,
  readOpenAiDirectorConfig,
} from "../server/dist/director.js";

const request = {
  traceId: "session:1:frame:1",
  frame: {
    id: "frame",
    title: "Archive inspection",
    performance: {
      beats: [{ id: "frame.exact.1", authority: "exact", text: "The seal is broken." }],
      forbiddenClaims: ["The archive was empty."],
      fallback: ["PRIVATE FALLBACK MUST STAY SERVER SIDE"],
    },
  },
  modelView: {
    audience: "model",
    state: {
      sessionId: "session", worldId: "world", worldVersion: "1.0.0", stateVersion: 1,
      turn: 1, status: "active", frameId: "frame", flags: {}, resources: {}, clocks: {},
      relationships: {}, inventory: {}, clues: [], knowledge: [],
    },
    canon: [{ id: "archive_locked", classification: "locked", statement: "The archive was locked overnight." }],
    artifacts: [],
    characterLedger: [],
    availableIntents: [{ id: "inspect", title: "Inspect", description: "Inspect the seal." }],
    directives: [],
  },
  progress: { completedBeatIds: [], acceptedSessionDetails: [] },
};

const performance = {
  narration: "The seal is broken.",
  dialogue: [],
  completedBeatIds: ["frame.exact.1"],
  surfacedIntentIds: ["inspect"],
  proposedSessionDetails: [],
  referencedCanonIds: ["archive_locked"],
};

const config = {
  apiKey: "test-key",
  model: "gpt-5.6-sol",
  reasoningEffort: "low",
  endpoint: "https://api.openai.test/v1/responses",
  timeoutMs: 1_000,
  maxOutputTokens: 1_200,
};

test("Director configuration is explicit opt-in and bounded", () => {
  assert.equal(readOpenAiDirectorConfig({ OPENAI_API_KEY: "key" }), undefined);
  assert.equal(readOpenAiDirectorConfig({ STORYFRAME_DIRECTOR_ENABLED: "true" }), undefined);
  assert.deepEqual(readOpenAiDirectorConfig({
    STORYFRAME_DIRECTOR_ENABLED: "true",
    OPENAI_API_KEY: "key",
    STORYFRAME_DIRECTOR_TIMEOUT_MS: "999999",
    STORYFRAME_DIRECTOR_MAX_OUTPUT_TOKENS: "1",
  }), {
    apiKey: "key",
    model: "gpt-5.6-sol",
    reasoningEffort: "low",
    endpoint: "https://api.openai.com/v1/responses",
    timeoutMs: 60_000,
    maxOutputTokens: 256,
  });
});

test("Responses provider sends only the safe contract and parses structured output", async () => {
  let sent;
  const usage = [];
  const provider = new OpenAiResponsesDirectorProvider(config, {
    nowMs: (() => { let value = 100; return () => value += 7; })(),
    usage: { record: (event) => usage.push(event) },
    fetch: async (url, init) => {
      sent = { url, init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({
        id: "resp_test",
        status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(performance) }] }],
        usage: {
          input_tokens: 100,
          input_tokens_details: { cached_tokens: 40 },
          output_tokens: 25,
          output_tokens_details: { reasoning_tokens: 5 },
          total_tokens: 125,
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.deepEqual(await provider.generate(request), performance);
  assert.equal(sent.url, config.endpoint);
  assert.equal(sent.init.headers.Authorization, "Bearer test-key");
  assert.equal(sent.body.store, false);
  assert.equal(sent.body.model, "gpt-5.6-sol");
  assert.deepEqual(sent.body.reasoning, { effort: "low" });
  assert.equal(sent.body.text.format.strict, true);
  assert.equal(sent.body.text.format.schema.additionalProperties, false);
  assert.equal(sent.init.body.includes("PRIVATE FALLBACK MUST STAY SERVER SIDE"), false);
  assert.equal(sent.init.body.includes("archive_locked"), true);
  assert.deepEqual(usage, [{
    traceId: request.traceId,
    operation: "performance",
    model: "gpt-5.6-sol",
    status: "completed",
    durationMs: 7,
    responseId: "resp_test",
    inputTokens: 100,
    cachedInputTokens: 40,
    outputTokens: 25,
    reasoningTokens: 5,
    totalTokens: 125,
  }]);
});

test("Semantic evaluator reports establish and implied-claim failures by authored ID/index", async () => {
  const semanticRequest = {
    traceId: request.traceId,
    frame: {
      ...request.frame,
      performance: {
        ...request.frame.performance,
        beats: [
          ...request.frame.performance.beats,
          { id: "frame.establish.1", authority: "establish", text: "The cabinet was opened recently." },
        ],
      },
    },
    modelView: request.modelView,
    performance,
  };
  let sent;
  const usage = [];
  const evaluator = new OpenAiResponsesDirectorSemanticEvaluator(config, {
    usage: { record: (event) => usage.push(event) },
    fetch: async (_url, init) => {
      sent = JSON.parse(init.body);
      return new Response(JSON.stringify({
        id: "resp_semantic",
        status: "completed",
        output_text: JSON.stringify({
          establishBeatIds: ["frame.establish.1"],
          impliedForbiddenClaimIndexes: [0],
        }),
        usage: { input_tokens: 80, output_tokens: 10, total_tokens: 90 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.deepEqual(await evaluator.evaluate(semanticRequest), [
    {
      code: "semantic-establish-failed",
      message: "The generated performance did not clearly establish beat frame.establish.1.",
    },
    {
      code: "implied-forbidden-claim",
      message: "The generated performance implied protected claim 1.",
    },
  ]);
  assert.equal(sent.text.format.name, "storyframe_semantic_evaluation");
  assert.equal(sent.store, false);
  assert.equal(sent.input[0].content.includes("PRIVATE FALLBACK MUST STAY SERVER SIDE"), false);
  assert.equal(usage[0].operation, "semantic-evaluation");
});

test("Responses provider records sanitized failure telemetry without leaking provider bodies", async () => {
  const usage = [];
  const provider = new OpenAiResponsesDirectorProvider(config, {
    usage: { record: (event) => usage.push(event) },
    fetch: async () => new Response(JSON.stringify({ error: { message: "sensitive upstream detail" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }),
  });

  await assert.rejects(() => provider.generate(request), /status 429/);
  assert.equal(usage.length, 1);
  assert.equal(usage[0].status, "api-error");
  assert.equal(JSON.stringify(usage).includes("sensitive upstream detail"), false);
});

test("Responses provider rejects refusals and incomplete structured output", async () => {
  const provider = new OpenAiResponsesDirectorProvider(config, {
    fetch: async () => new Response(JSON.stringify({
      id: "resp_refusal",
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "No." }] }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  await assert.rejects(() => provider.generate(request), /incomplete or refused/);
});

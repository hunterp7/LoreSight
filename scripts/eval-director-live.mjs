import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { createSession } from "../packages/engine-core/dist/index.js";
import { performCurrentFrame } from "../packages/ai-director/dist/index.js";
import { createOpenAiDirectorAdapters } from "../server/dist/director.js";
import { agencyWorld } from "../server/dist/player-view.js";

const envPath = resolve(".env.local");
if (!process.env.OPENAI_API_KEY && existsSync(envPath)) loadEnvFile(envPath);

if (process.env.STORYFRAME_DIRECTOR_LIVE_EVAL !== "true") {
  throw new Error("Set STORYFRAME_DIRECTOR_LIVE_EVAL=true to acknowledge that this command makes a paid API request.");
}

const usage = [];
const adapters = createOpenAiDirectorAdapters(process.env, {
  usage: { record: (event) => usage.push(event) },
});
if (!adapters) {
  throw new Error("Set STORYFRAME_DIRECTOR_ENABLED=true and provide OPENAI_API_KEY before running the live eval.");
}

const state = createSession(agencyWorld, {
  sessionId: "director-live-eval",
  ownerId: "local-evaluator",
  seed: 42,
});
const result = await performCurrentFrame({
  world: agencyWorld,
  state,
  provider: adapters.provider,
  semanticEvaluator: adapters.semanticEvaluator,
  maxAttempts: 1,
});

const generationUsage = usage.find((event) => event.operation === "performance");
const semanticUsage = usage.find((event) => event.operation === "semantic-evaluation");
console.log(JSON.stringify({
  status: result.status,
  attempts: result.attempts,
  issueCodes: [...new Set(result.issues.map((issue) => issue.code))],
  completedBeatCount: result.performance?.completedBeatIds.length ?? 0,
  surfacedIntentCount: result.performance?.surfacedIntentIds.length ?? 0,
  model: generationUsage?.model,
  generation: generationUsage,
  semanticEvaluation: semanticUsage,
}, null, 2));

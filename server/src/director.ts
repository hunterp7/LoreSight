import type {
  DirectorSemanticEvaluator,
  DirectorSemanticEvaluationRequest,
  DirectorProvider,
  DirectorRequest,
  PerformanceIssue,
} from "@storyframe/ai-director";

export type DirectorReasoningEffort = "none" | "low" | "medium" | "high";

export interface OpenAiDirectorConfig {
  apiKey: string;
  model: string;
  reasoningEffort: DirectorReasoningEffort;
  endpoint: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

export interface OpenAiDirectorUsageEvent {
  traceId: string;
  operation: "performance" | "semantic-evaluation";
  model: string;
  status: "completed" | "api-error" | "invalid-response" | "network-error";
  durationMs: number;
  responseId?: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
}

export interface OpenAiDirectorUsageSink {
  record(event: OpenAiDirectorUsageEvent): void | Promise<void>;
}

export interface OpenAiDirectorProviderOptions {
  fetch?: typeof fetch;
  usage?: OpenAiDirectorUsageSink;
  nowMs?: () => number;
}

const PERFORMANCE_SCHEMA = {
  type: "object",
  properties: {
    narration: { type: "string" },
    dialogue: {
      type: "array",
      items: {
        type: "object",
        properties: {
          speakerId: { type: "string" },
          text: { type: "string" },
        },
        required: ["speakerId", "text"],
        additionalProperties: false,
      },
    },
    completedBeatIds: { type: "array", items: { type: "string" } },
    surfacedIntentIds: { type: "array", items: { type: "string" } },
    proposedSessionDetails: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          persistence: {
            type: "string",
            enum: ["turn", "scene", "session", "proposal"],
          },
        },
        required: ["id", "text", "persistence"],
        additionalProperties: false,
      },
    },
    referencedCanonIds: { type: "array", items: { type: "string" } },
  },
  required: [
    "narration",
    "dialogue",
    "completedBeatIds",
    "surfacedIntentIds",
    "proposedSessionDetails",
    "referencedCanonIds",
  ],
  additionalProperties: false,
} as const;

const SEMANTIC_EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    establishBeatIds: { type: "array", items: { type: "string" } },
    impliedForbiddenClaimIndexes: { type: "array", items: { type: "integer" } },
  },
  required: ["establishBeatIds", "impliedForbiddenClaimIndexes"],
  additionalProperties: false,
} as const;

const DIRECTOR_INSTRUCTIONS = `You perform one moment in a deterministic narrative game.

Success means:
- express every exact and establish beat in the supplied frame contract;
- copy exact beats verbatim;
- use only visible canon, artifacts, characters, directives, and available intents in modelView;
- never claim that a forbidden claim is true;
- return only the requested structured performance;
- report referenced canon IDs, surfaced intent IDs, and completed beat IDs accurately.

Mechanics are server-authoritative. Do not invent or change resources, flags, clues, endings, intent availability, or permanent canon. A session detail is optional color, not a mechanical fact. Use proposal persistence for anything that would need creator approval.`;

const SEMANTIC_EVALUATOR_INSTRUCTIONS = `Evaluate one proposed narrative performance against its authored meaning contract.

Return the IDs of establish beats whose meaning is not clearly expressed. Return the zero-based indexes of forbidden claims that the performance implies are true, even when it does not repeat the claim verbatim. Judge only the supplied contract and performance. Do not rewrite the prose, add canon, or report explanations.`;

function clampInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function effort(value: string | undefined): DirectorReasoningEffort {
  return value === "none" || value === "low" || value === "medium" || value === "high"
    ? value
    : "low";
}

export function readOpenAiDirectorConfig(
  env: NodeJS.ProcessEnv,
): OpenAiDirectorConfig | undefined {
  if (env.STORYFRAME_DIRECTOR_ENABLED !== "true" || !env.OPENAI_API_KEY) return undefined;
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.STORYFRAME_DIRECTOR_MODEL?.trim() || "gpt-5.6-sol",
    reasoningEffort: effort(env.STORYFRAME_DIRECTOR_REASONING_EFFORT),
    endpoint: env.STORYFRAME_DIRECTOR_ENDPOINT?.trim() || "https://api.openai.com/v1/responses",
    timeoutMs: clampInteger(env.STORYFRAME_DIRECTOR_TIMEOUT_MS, 20_000, 1_000, 60_000),
    maxOutputTokens: clampInteger(env.STORYFRAME_DIRECTOR_MAX_OUTPUT_TOKENS, 1_200, 256, 4_096),
  };
}

function modelPayload(request: DirectorRequest): Record<string, unknown> {
  return {
    frame: {
      id: request.frame.id,
      title: request.frame.title,
      performance: request.frame.performance ? {
        beats: request.frame.performance.beats,
        forbiddenClaims: request.frame.performance.forbiddenClaims,
      } : undefined,
    },
    modelView: request.modelView,
    progress: request.progress,
  };
}

function outputText(body: Record<string, unknown>): string | undefined {
  if (typeof body.output_text === "string") return body.output_text;
  if (!Array.isArray(body.output)) return undefined;
  for (const item of body.output) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object" || Array.isArray(part)) continue;
      const entry = part as Record<string, unknown>;
      if (entry.type === "refusal") return undefined;
      if (entry.type === "output_text" && typeof entry.text === "string") return entry.text;
    }
  }
  return undefined;
}

function usageEvent(
  body: Record<string, unknown>,
  event: Omit<OpenAiDirectorUsageEvent, "responseId" | "inputTokens" | "cachedInputTokens" | "outputTokens" | "reasoningTokens" | "totalTokens">,
): OpenAiDirectorUsageEvent {
  const usage = body.usage && typeof body.usage === "object" && !Array.isArray(body.usage)
    ? body.usage as Record<string, unknown>
    : {};
  const inputDetails = usage.input_tokens_details && typeof usage.input_tokens_details === "object" && !Array.isArray(usage.input_tokens_details)
    ? usage.input_tokens_details as Record<string, unknown>
    : {};
  const outputDetails = usage.output_tokens_details && typeof usage.output_tokens_details === "object" && !Array.isArray(usage.output_tokens_details)
    ? usage.output_tokens_details as Record<string, unknown>
    : {};
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
  return {
    ...event,
    responseId: typeof body.id === "string" ? body.id : undefined,
    inputTokens: number(usage.input_tokens),
    cachedInputTokens: number(inputDetails.cached_tokens),
    outputTokens: number(usage.output_tokens),
    reasoningTokens: number(outputDetails.reasoning_tokens),
    totalTokens: number(usage.total_tokens),
  };
}

async function recordUsage(sink: OpenAiDirectorUsageSink | undefined, event: OpenAiDirectorUsageEvent): Promise<void> {
  if (!sink) return;
  try {
    await sink.record(structuredClone(event));
  } catch {
    // Usage telemetry is content-free and non-authoritative; failure must not alter story behavior.
  }
}

export class OpenAiResponsesDirectorProvider implements DirectorProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly nowMs: () => number;

  constructor(
    private readonly config: OpenAiDirectorConfig,
    private readonly options: OpenAiDirectorProviderOptions = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.nowMs = options.nowMs ?? (() => performance.now());
  }

  async generate(request: DirectorRequest): Promise<unknown> {
    const startedAt = this.nowMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let body: Record<string, unknown> = {};
    try {
      const response = await this.fetchImpl(this.config.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          reasoning: { effort: this.config.reasoningEffort },
          instructions: DIRECTOR_INSTRUCTIONS,
          input: [{ role: "user", content: JSON.stringify(modelPayload(request)) }],
          text: {
            format: {
              type: "json_schema",
              name: "storyframe_performance",
              strict: true,
              schema: PERFORMANCE_SCHEMA,
            },
          },
          max_output_tokens: this.config.maxOutputTokens,
          store: false,
          metadata: { storyframe_trace_id: request.traceId },
        }),
        signal: controller.signal,
      });
      const parsed = await response.json().catch(() => ({}));
      body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
      if (!response.ok) {
        await recordUsage(this.options.usage, usageEvent(body, {
          traceId: request.traceId,
          operation: "performance",
          model: this.config.model,
          status: "api-error",
          durationMs: Math.max(0, Math.round(this.nowMs() - startedAt)),
        }));
        throw new Error(`OpenAI Director request failed with status ${response.status}.`);
      }
      const text = outputText(body);
      if (body.status !== "completed" || !text) {
        await recordUsage(this.options.usage, usageEvent(body, {
          traceId: request.traceId,
          operation: "performance",
          model: this.config.model,
          status: "invalid-response",
          durationMs: Math.max(0, Math.round(this.nowMs() - startedAt)),
        }));
        throw new Error("OpenAI Director response was incomplete or refused.");
      }
      let candidate: unknown;
      try {
        candidate = JSON.parse(text);
      } catch {
        await recordUsage(this.options.usage, usageEvent(body, {
          traceId: request.traceId,
          operation: "performance",
          model: this.config.model,
          status: "invalid-response",
          durationMs: Math.max(0, Math.round(this.nowMs() - startedAt)),
        }));
        throw new Error("OpenAI Director structured output was not valid JSON.");
      }
      await recordUsage(this.options.usage, usageEvent(body, {
        traceId: request.traceId,
        operation: "performance",
        model: this.config.model,
        status: "completed",
        durationMs: Math.max(0, Math.round(this.nowMs() - startedAt)),
      }));
      return candidate;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("OpenAI Director")) throw error;
      await recordUsage(this.options.usage, usageEvent(body, {
        traceId: request.traceId,
        operation: "performance",
        model: this.config.model,
        status: "network-error",
        durationMs: Math.max(0, Math.round(this.nowMs() - startedAt)),
      }));
      throw new Error("OpenAI Director request was unavailable.", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class OpenAiResponsesDirectorSemanticEvaluator implements DirectorSemanticEvaluator {
  private readonly fetchImpl: typeof fetch;
  private readonly nowMs: () => number;

  constructor(
    private readonly config: OpenAiDirectorConfig,
    private readonly options: OpenAiDirectorProviderOptions = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.nowMs = options.nowMs ?? (() => performance.now());
  }

  async evaluate(request: DirectorSemanticEvaluationRequest): Promise<PerformanceIssue[]> {
    const startedAt = this.nowMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let body: Record<string, unknown> = {};
    try {
      const response = await this.fetchImpl(this.config.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          reasoning: { effort: this.config.reasoningEffort },
          instructions: SEMANTIC_EVALUATOR_INSTRUCTIONS,
          input: [{
            role: "user",
            content: JSON.stringify({
              establishBeats: request.frame.performance?.beats.filter((beat) => beat.authority === "establish") ?? [],
              forbiddenClaims: request.frame.performance?.forbiddenClaims ?? [],
              modelView: request.modelView,
              performance: request.performance,
            }),
          }],
          text: {
            format: {
              type: "json_schema",
              name: "storyframe_semantic_evaluation",
              strict: true,
              schema: SEMANTIC_EVALUATION_SCHEMA,
            },
          },
          max_output_tokens: Math.min(this.config.maxOutputTokens, 512),
          store: false,
          metadata: { storyframe_trace_id: request.traceId },
        }),
        signal: controller.signal,
      });
      const parsed = await response.json().catch(() => ({}));
      body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
      if (!response.ok) {
        await recordUsage(this.options.usage, usageEvent(body, {
          traceId: request.traceId,
          operation: "semantic-evaluation",
          model: this.config.model,
          status: "api-error",
          durationMs: Math.max(0, Math.round(this.nowMs() - startedAt)),
        }));
        throw new Error(`OpenAI Director semantic evaluation failed with status ${response.status}.`);
      }
      const text = outputText(body);
      if (body.status !== "completed" || !text) {
        await recordUsage(this.options.usage, usageEvent(body, {
          traceId: request.traceId,
          operation: "semantic-evaluation",
          model: this.config.model,
          status: "invalid-response",
          durationMs: Math.max(0, Math.round(this.nowMs() - startedAt)),
        }));
        throw new Error("OpenAI Director semantic evaluation was incomplete or refused.");
      }
      const result = JSON.parse(text) as {
        establishBeatIds?: unknown;
        impliedForbiddenClaimIndexes?: unknown;
      };
      if (!Array.isArray(result.establishBeatIds) || !result.establishBeatIds.every((id) => typeof id === "string") ||
          !Array.isArray(result.impliedForbiddenClaimIndexes) || !result.impliedForbiddenClaimIndexes.every(Number.isInteger)) {
        throw new Error("OpenAI Director semantic evaluation had an invalid structure.");
      }
      const establishIds = new Set(
        request.frame.performance?.beats.filter((beat) => beat.authority === "establish").map((beat) => beat.id) ?? [],
      );
      const issues: PerformanceIssue[] = [];
      for (const id of [...new Set(result.establishBeatIds)]) {
        if (!establishIds.has(id)) {
          issues.push({
            code: "semantic-evaluation-failed",
            message: "The semantic evaluator returned an unknown establish beat ID.",
          });
          continue;
        }
        issues.push({
          code: "semantic-establish-failed",
          message: `The generated performance did not clearly establish beat ${id}.`,
        });
      }
      const forbiddenCount = request.frame.performance?.forbiddenClaims.length ?? 0;
      for (const index of [...new Set(result.impliedForbiddenClaimIndexes)]) {
        if (index < 0 || index >= forbiddenCount) {
          issues.push({
            code: "semantic-evaluation-failed",
            message: "The semantic evaluator returned an unknown forbidden-claim index.",
          });
          continue;
        }
        issues.push({
          code: "implied-forbidden-claim",
          message: `The generated performance implied protected claim ${index + 1}.`,
        });
      }
      await recordUsage(this.options.usage, usageEvent(body, {
        traceId: request.traceId,
        operation: "semantic-evaluation",
        model: this.config.model,
        status: "completed",
        durationMs: Math.max(0, Math.round(this.nowMs() - startedAt)),
      }));
      return issues;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("OpenAI Director")) throw error;
      await recordUsage(this.options.usage, usageEvent(body, {
        traceId: request.traceId,
        operation: "semantic-evaluation",
        model: this.config.model,
        status: "network-error",
        durationMs: Math.max(0, Math.round(this.nowMs() - startedAt)),
      }));
      throw new Error("OpenAI Director semantic evaluation was unavailable.", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createOpenAiDirectorProvider(
  env: NodeJS.ProcessEnv,
  options: OpenAiDirectorProviderOptions = {},
): OpenAiResponsesDirectorProvider | undefined {
  const config = readOpenAiDirectorConfig(env);
  return config ? new OpenAiResponsesDirectorProvider(config, options) : undefined;
}

export function createOpenAiDirectorAdapters(
  env: NodeJS.ProcessEnv,
  options: OpenAiDirectorProviderOptions = {},
): { provider: OpenAiResponsesDirectorProvider; semanticEvaluator: OpenAiResponsesDirectorSemanticEvaluator } | undefined {
  const config = readOpenAiDirectorConfig(env);
  return config ? {
    provider: new OpenAiResponsesDirectorProvider(config, options),
    semanticEvaluator: new OpenAiResponsesDirectorSemanticEvaluator(config, options),
  } : undefined;
}

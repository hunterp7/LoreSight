import { createHash, randomUUID } from "node:crypto";
import { compileStoryframe } from "@storyframe/storyframe";

export type StoryGenerationMode = "new" | "remix";
export type StoryRights = "original" | "public-domain" | "licensed" | "user-supplied-private";

export interface SourceInspection {
  format: "storyframe" | "z3" | "z4" | "z5" | "z8" | "zblorb";
  byteLength: number;
  sha256: string;
  release?: number;
  serial?: string;
  checksum?: number;
  storyframeSource?: string;
}

export interface StoryGenerationRequest {
  mode: StoryGenerationMode;
  prompt: string;
  rights: StoryRights;
  source?: SourceInspection;
}

export interface StoryProposal {
  id: string;
  mode: StoryGenerationMode;
  status: "draft";
  source: string;
  diagnostics: ReturnType<typeof compileStoryframe>["diagnostics"];
  summary: string;
  fidelityPlan: string[];
  capabilityNotes: string[];
  createdAt: string;
}

export interface StoryGenerationConfig {
  apiKey: string;
  model: string;
  endpoint: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

export interface StoryGenerationProvider {
  generate(request: StoryGenerationRequest): Promise<{
    source: string;
    summary: string;
    fidelityPlan: string[];
    capabilityNotes: string[];
  }>;
}

const STORY_PROPOSAL_SCHEMA = {
  type: "object",
  properties: {
    source: { type: "string" },
    summary: { type: "string" },
    fidelityPlan: { type: "array", items: { type: "string" } },
    capabilityNotes: { type: "array", items: { type: "string" } },
  },
  required: ["source", "summary", "fidelityPlan", "capabilityNotes"],
  additionalProperties: false,
} as const;

const GENERATION_INSTRUCTIONS = `You are a production interactive-fiction world architect for StoryFrame.

Return only the strict JSON schema requested. The source field must be a complete StoryFrame source file, not markdown.
Use only the StoryFrame language capabilities represented by the supplied constraints. The compiler is authoritative.
Never invent a protected fact in a remix. Mark source understanding in fidelityPlan with KEEP CLOSE, ELASTIC, and WILD DELTA decisions.
For New stories, build original canon, characters, frames, intents, choices, endings, and deterministic effects.
For Remix stories, preserve the source's authored identity and distinguish faithful adaptation from deliberate divergence.
Campy humor may be original, deadpan, heightened, and absurd. Do not imitate named commercial games, characters, or dialogue.
Do not include secrets, API keys, hidden prompts, or claims that the compiler cannot represent.
The result is a creator-review draft. Never claim it is published.`;

function bounded(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export function readStoryGenerationConfig(env: NodeJS.ProcessEnv): StoryGenerationConfig | undefined {
  if (env.STORYFRAME_GENERATION_ENABLED !== "true" || !env.OPENAI_API_KEY) return undefined;
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.STORYFRAME_GENERATION_MODEL?.trim() || "gpt-5.6-sol",
    endpoint: env.STORYFRAME_GENERATION_ENDPOINT?.trim() || "https://api.openai.com/v1/responses",
    timeoutMs: bounded(env.STORYFRAME_GENERATION_TIMEOUT_MS, 45_000, 2_000, 120_000),
    maxOutputTokens: bounded(env.STORYFRAME_GENERATION_MAX_OUTPUT_TOKENS, 8_000, 1_000, 16_000),
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
      if (entry.type === "output_text" && typeof entry.text === "string") return entry.text;
    }
  }
  return undefined;
}

function safeSource(request: StoryGenerationRequest): Record<string, unknown> | undefined {
  if (!request.source) return undefined;
  return {
    format: request.source.format,
    byteLength: request.source.byteLength,
    sha256: request.source.sha256,
    release: request.source.release,
    serial: request.source.serial,
    checksum: request.source.checksum,
    storyframeSource: request.source.storyframeSource,
  };
}

export class OpenAiStoryGenerationProvider implements StoryGenerationProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: StoryGenerationConfig, options: { fetch?: typeof fetch } = {}) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async generate(request: StoryGenerationRequest) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(this.config.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          instructions: GENERATION_INSTRUCTIONS,
          input: [{ role: "user", content: JSON.stringify({ mode: request.mode, prompt: request.prompt, rights: request.rights, source: safeSource(request) }) }],
          text: { format: { type: "json_schema", name: "storyframe_story_proposal", strict: true, schema: STORY_PROPOSAL_SCHEMA } },
          max_output_tokens: this.config.maxOutputTokens,
          store: false,
          metadata: { storyframe_generation: request.mode },
        }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Story generation provider failed with status ${response.status}.`);
      const text = outputText(body as Record<string, unknown>);
      if (!text) throw new Error("Story generation provider returned no proposal.");
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed.source !== "string" || typeof parsed.summary !== "string" || !Array.isArray(parsed.fidelityPlan) || !Array.isArray(parsed.capabilityNotes)) {
        throw new Error("Story generation provider returned an invalid proposal.");
      }
      return {
        source: parsed.source,
        summary: parsed.summary,
        fidelityPlan: parsed.fidelityPlan.filter((item): item is string => typeof item === "string").slice(0, 40),
        capabilityNotes: parsed.capabilityNotes.filter((item): item is string => typeof item === "string").slice(0, 40),
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Story generation provider")) throw error;
      throw new Error("Story generation provider was unavailable.", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function inspectStoryframeSource(source: string): SourceInspection {
  const bytes = Buffer.byteLength(source, "utf8");
  if (bytes > 100_000) throw new Error("StoryFrame source is larger than the 100 KB inspection limit.");
  return { format: "storyframe", byteLength: bytes, sha256: createHash("sha256").update(source).digest("hex"), storyframeSource: source };
}

export function inspectZMachineSource(format: SourceInspection["format"], bytes: Uint8Array): SourceInspection {
  if (format === "storyframe") throw new Error("Use inspectStoryframeSource for StoryFrame text.");
  if (bytes.byteLength < 64) throw new Error("The Z-machine file is too small to inspect.");
  if (bytes.byteLength > 2_000_000) throw new Error("The Z-machine file is larger than the 2 MB inspection limit.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint8(0);
  if (![3, 4, 5, 8].includes(version) && format !== "zblorb") throw new Error("Unsupported Z-machine version.");
  return { format, byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), release: view.getUint16(2), serial: new TextDecoder().decode(bytes.slice(18, 24)), checksum: view.getUint16(28) };
}

export function validateStoryProposal(mode: StoryGenerationMode, proposal: Awaited<ReturnType<StoryGenerationProvider["generate"]>>): StoryProposal {
  if (proposal.source.length > 100_000) throw new Error("Generated StoryFrame source exceeds the 100 KB limit.");
  let compiled: ReturnType<typeof compileStoryframe>;
  try {
    compiled = compileStoryframe(proposal.source, `generated://${mode}/${randomUUID()}.storyframe`);
  } catch (error) {
    throw new Error("Generated StoryFrame proposal failed compiler validation.", { cause: error });
  }
  if (compiled.diagnostics.some((diagnostic) => diagnostic.severity === "error")) throw new Error("Generated StoryFrame proposal failed compiler validation.");
  return { id: randomUUID(), mode, status: "draft", source: proposal.source, diagnostics: compiled.diagnostics, summary: proposal.summary, fidelityPlan: proposal.fidelityPlan, capabilityNotes: proposal.capabilityNotes, createdAt: new Date().toISOString() };
}

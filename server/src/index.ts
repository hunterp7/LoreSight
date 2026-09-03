import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { handleAdminRequest } from "./admin.js";
import { readThemeProfiles } from "./theme-profiles.js";
import { generateNarrationDataUrl, NarrationError } from "./audio.js";
import { AuthorizationError } from "@storyframe/auth";
import type { ActorContext, StoryScope } from "@storyframe/application";
import { createOAuthServices, oauthToolMeta } from "./oauth.js";
import { toolContract } from "./tool-catalog.js";
import { errorName, resolveRequestId, writeOperationalEvent } from "./observability.js";
import { MemoryFixedWindowRateLimiter, STORYFRAME_RATE_LIMITS } from "./rate-limit.js";
import { ServiceReadiness } from "./service-lifecycle.js";
import { createOpenAiDirectorAdapters } from "./director.js";
import { OpenAiStoryGenerationProvider, readStoryGenerationConfig, validateStoryProposal } from "./generation.js";
import { handleFeedbackRequest, submitFeedbackPayload } from "./feedback.js";
import type { StoryframePlayerView } from "./player-view.js";
import {
  createSession,
  getSession,
  selectStory,
  storyLibrary,
  submitCommand,
  type LoreSightSession,
} from "./loresight-actions.js";

const here = dirname(fileURLToPath(import.meta.url));
const localEnvPath = resolve(here, "../../.env.local");
if ((!process.env.OPENAI_API_KEY || (!process.env.STORYFRAME_ADMIN_PASSWORD && !process.env.STORYFRAME_ADMIN_TOKEN)) && existsSync(localEnvPath)) {
  loadEnvFile(localEnvPath);
}
const widgetHtml = readFileSync(resolve(here, "../../web/dist/loresight-widget.html"), "utf8");
const adminAssets = {
  html: readFileSync(resolve(here, "../../admin/dist/index.html"), "utf8"),
  javascript: readFileSync(resolve(here, "../../admin/dist/app.js"), "utf8"),
  css: readFileSync(resolve(here, "../../admin/dist/app.css"), "utf8"),
};
const launchPadAssets = {
  html: readFileSync(resolve(here, "../../launch/dist/index.html"), "utf8"),
  javascript: readFileSync(resolve(here, "../../launch/dist/app.js"), "utf8"),
  css: readFileSync(resolve(here, "../../launch/dist/app.css"), "utf8"),
};
// Keep the resource URI versioned so hosted releases can be cached separately.
// Local development stays on v5 unless a rollout explicitly sets a version.
const WIDGET_VERSION = /^[a-z0-9][a-z0-9.-]*$/i.test(process.env.LORESIGHT_WIDGET_VERSION ?? "")
  ? process.env.LORESIGHT_WIDGET_VERSION!
  : "5";
const WIDGET_URI = `ui://widget/storyframe-player-v${WIDGET_VERSION}.html`;
const oauth = createOAuthServices(process.env);
const oauthAuthorizationDocs = [
  "Storyframe OAuth setup",
  "",
  "1. Set STORYFRAME_OAUTH_ISSUER, STORYFRAME_OAUTH_RESOURCE, and STORYFRAME_OAUTH_JWKS_URI together.",
  "2. STORYFRAME_OAUTH_RESOURCE must be the canonical HTTPS origin for the MCP server.",
  "3. The server exposes /.well-known/oauth-protected-resource automatically when OAuth is enabled.",
  "4. Add the HTTPS /mcp URL in ChatGPT Developer mode and keep the tunnel or hosted origin online while testing.",
  "",
  "OpenAI authentication guide: https://developers.openai.com/plugins/build/auth",
].join("\n");
const runtimeLimiter = new MemoryFixedWindowRateLimiter();
const readiness = new ServiceReadiness();
const directorAdapters = createOpenAiDirectorAdapters(process.env, {
  usage: {
    record(event) {
      writeOperationalEvent({
        event: "director.provider.complete",
        level: event.status === "completed" ? "info" : "warn",
        requestId: event.traceId,
        details: {
          model: event.model,
          operation: event.operation,
          status: event.status,
          durationMs: event.durationMs,
          inputTokens: event.inputTokens,
          cachedInputTokens: event.cachedInputTokens,
          outputTokens: event.outputTokens,
          reasoningTokens: event.reasoningTokens,
          totalTokens: event.totalTokens,
        },
      });
    },
  },
});
const storyGenerationConfig = readStoryGenerationConfig(process.env);
const storyGenerationProvider = storyGenerationConfig
  ? new OpenAiStoryGenerationProvider(storyGenerationConfig)
  : undefined;
const creatorToolsEnabled = process.env.STORYFRAME_CREATOR_TOOLS_ENABLED === "true";
const localActor: ActorContext = {
  subjectId: "local-development",
  scopes: ["story:sessions:read", "story:sessions:write", "story:worlds:write"],
};

const playerViewSchema = z.object({
  audience: z.literal("player"),
  session: z.object({
    id: z.string(),
    worldId: z.string(),
    worldVersion: z.string(),
    stateVersion: z.number().int(),
    status: z.enum(["active", "complete"]),
  }),
  presentation: z.object({
    worldTitle: z.string(),
    identityLabel: z.string(),
    identityValue: z.string(),
    layout: z.enum(["focus", "investigation", "decision", "complete"]),
    stageLabel: z.string(),
    stepLabel: z.string(),
    headline: z.string(),
    speakerLine: z.string(),
    objective: z.string(),
    progress: z.number(),
    atmosphere: z.string(),
    footer: z.string(),
    frame: z.object({
      kind: z.enum(["default-crt", "authored"]),
      preset: z.enum(["institutional", "ornate", "industrial", "minimal"]).optional(),
      label: z.string().max(48).optional(),
      mark: z.string().max(16).optional(),
      colors: z.object({
        surround: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        surface: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        edge: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }).optional(),
    }),
  }),
  availableIntents: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    kind: z.enum(["primary", "inspect", "decision"]),
    artifactId: z.string().optional(),
  })),
  artifacts: z.array(z.object({
    id: z.string(),
    kind: z.string(),
    title: z.string(),
    shortTitle: z.string(),
    summary: z.string(),
    body: z.array(z.string()),
    stamp: z.string().optional(),
    reviewed: z.boolean(),
    visual: z.object({ assetKey: z.string(), altText: z.string(), caption: z.string(), textLines: z.array(z.string()).optional() }).optional(),
  })),
  ending: z.object({ title: z.string(), disposition: z.string(), certificate: z.string() }).optional(),
});

const storyResult = (view: StoryframePlayerView, message: string, operation?: Record<string, unknown>) => ({
  structuredContent: { view, ...(operation ? { operation } : {}) },
  content: [{
    type: "text" as const,
    text: `${message}\n\nSTORY VOICE: ${view.presentation.speakerLine}\n\nCurrent objective: ${view.presentation.objective}`,
  }],
});

function authError(scopes: StoryScope[]) {
  return {
    content: [{ type: "text" as const, text: "Connect your LoreSight account to continue." }],
    isError: true,
    _meta: oauth ? {
      "mcp/www_authenticate": [oauth.authorizer.challenge(scopes, "insufficient_scope")],
    } : {},
  };
}

function rateLimitError(retryAfterSeconds: number) {
  return {
    content: [{ type: "text" as const, text: `LoreSight is receiving too many requests. Try again in ${retryAfterSeconds} seconds.` }],
    isError: true,
    _meta: { retryAfterSeconds },
  };
}

function hasScopes(actor: ActorContext, scopes: StoryScope[]): boolean {
  return scopes.every((scope) => actor.scopes.includes(scope));
}

function sessionView(session: LoreSightSession): StoryframePlayerView {
  return {
    audience: "player",
    session: {
      id: session.id,
      worldId: session.storyId ?? "loresight.library",
      worldVersion: "1",
      stateVersion: session.stateVersion,
      status: session.status,
    },
    presentation: {
      worldTitle: "LoreSight",
      identityLabel: "Interactive fiction terminal",
      identityValue: session.storyTitle ?? "READY",
      layout: "focus",
      stageLabel: session.storyTitle ? "Playing" : "Choose a story",
      stepLabel: `Turn ${session.stateVersion + 1}`,
      headline: session.storyTitle ?? "LoreSight",
      speakerLine: session.transcript.at(-1) ?? "The terminal is ready.",
      objective: session.storyTitle ? "Type a command to continue." : "Choose Load story, Library, or Play sample below the CRT.",
      progress: 0,
      atmosphere: "Classic interactive fiction · modern presentation",
      footer: "Your story state is kept in this session.",
      frame: { kind: "default-crt" },
    },
    availableIntents: [],
    artifacts: [],
  };
}

function createLoreSightServer(actor: ActorContext): McpServer {
  const server = new McpServer(
    { name: "loresight-player", version: "0.1.0" },
    {
      instructions:
        "LoreSight is a CRT terminal for interactive fiction. Use the player to choose a story, type commands, inspect the current state, and request optional narration. Keep the conversation focused on the user's active LoreSight session.",
    },
  );

  registerAppResource(
    server,
    "loresight-widget",
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ui: {
              prefersBorder: false,
              csp: { connectDomains: [], resourceDomains: [] },
            },
            "openai/widgetDescription":
              "A story-first CRT terminal for loading and playing interactive fiction.",
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "start_story_session",
    {
      title: "Open LoreSight Terminal",
      description:
        "Use this when the user explicitly wants to open LoreSight. Always attach the LoreSight CRT player so the user sees the terminal and its action bar.",
      inputSchema: {},
      outputSchema: { view: playerViewSchema },
      annotations: toolContract("start_story_session").annotations,
      // The widget's Play sample action can invoke this tool directly. Keep it
      // model-visible as well so the same operation works from conversation.
      _meta: {
        ui: { resourceUri: WIDGET_URI, visibility: ["model", "app"] },
        "openai/outputTemplate": WIDGET_URI,
        ...oauthToolMeta(toolContract("start_story_session").scopes, Boolean(oauth)),
      },
    },
    async () => hasScopes(actor, ["story:sessions:write"])
      ? (() => {
          const view = sessionView(createSession(actor.subjectId));
          return Promise.resolve({
            structuredContent: { view },
            content: [{ type: "text" as const, text: "LoreSight terminal ready. Choose Load story, Library, or Play sample below the CRT." }],
          });
        })()
      : authError(["story:sessions:write"]),
  );

  registerAppTool(
    server,
    "list_story_library",
    {
      title: "Browse Story Library",
      description:
        "Use this when the player asks what stories are available in LoreSight. Return titles and formats so the player can choose one in the terminal.",
      inputSchema: {},
      outputSchema: { stories: z.array(z.object({ id: z.string(), title: z.string(), author: z.string(), format: z.string(), source: z.string() })) },
      annotations: toolContract("list_story_library").annotations,
      _meta: { ui: { visibility: ["model"] }, ...oauthToolMeta(toolContract("list_story_library").scopes, Boolean(oauth)) },
    },
    async () => hasScopes(actor, ["story:sessions:read"])
      ? { structuredContent: { stories: storyLibrary }, content: [{ type: "text" as const, text: "LoreSight story library retrieved." }] }
      : authError(["story:sessions:read"]),
  );

  const componentAction = (action: string, message: string) => ({
    structuredContent: { action },
    content: [{ type: "text" as const, text: message }],
  });

  registerAppTool(server, "open_story_library", {
    title: "Open Story Library",
    description: "Use this when the player asks to browse or choose a LoreSight story. It opens the library inside the mounted widget.",
    inputSchema: {},
    outputSchema: { action: z.literal("open_library") },
    annotations: toolContract("open_story_library").annotations,
    _meta: { ui: { visibility: ["model", "app"] }, ...oauthToolMeta(toolContract("open_story_library").scopes, Boolean(oauth)) },
  }, async () => hasScopes(actor, ["story:sessions:read"])
    ? componentAction("open_library", "The LoreSight story library is open in the widget.")
    : authError(["story:sessions:read"]));

  registerAppTool(server, "load_story_file", {
    title: "Load Story File",
    description: "Use this when the player asks to load a local .z3, .z5, .z8, or .zblorb file. The widget opens the browser file picker; the server never reads the user's filesystem.",
    inputSchema: {},
    outputSchema: { action: z.literal("load_file") },
    annotations: toolContract("load_story_file").annotations,
    _meta: { ui: { visibility: ["model", "app"] }, ...oauthToolMeta(toolContract("load_story_file").scopes, Boolean(oauth)) },
  }, async () => hasScopes(actor, ["story:sessions:write"])
    ? componentAction("load_file", "Choose a Z-machine story file in the LoreSight widget.")
    : authError(["story:sessions:write"]));

  registerAppTool(server, "play_sample_story", {
    title: "Play Sample Story",
    description: "Use this when the player asks to play LoreSight's bundled sample story. The widget loads the sample and starts the interpreter.",
    inputSchema: {},
    outputSchema: { action: z.literal("load_sample") },
    annotations: toolContract("play_sample_story").annotations,
    _meta: { ui: { visibility: ["model", "app"] }, ...oauthToolMeta(toolContract("play_sample_story").scopes, Boolean(oauth)) },
  }, async () => hasScopes(actor, ["story:sessions:write"])
    ? componentAction("load_sample", "The LoreSight sample story is starting in the widget.")
    : authError(["story:sessions:write"]));

  registerAppTool(server, "set_theme", {
    title: "Set CRT Theme",
    description: "Use this when the player asks to change the LoreSight CRT theme. The widget applies and locally saves the selected theme.",
    inputSchema: { theme: z.enum(["orange", "green", "blue", "matrix", "kindle", "clean", "vertigo", "toucan", "apple-blue", "apple-green", "apple-purple", "commodore", "commodore-white", "muthur", "night-owl", "terminator"]) },
    outputSchema: { action: z.literal("set_theme"), theme: z.string() },
    annotations: toolContract("set_theme").annotations,
    _meta: { ui: { visibility: ["model", "app"] }, ...oauthToolMeta(toolContract("set_theme").scopes, Boolean(oauth)) },
  }, async ({ theme }) => hasScopes(actor, ["story:sessions:write"])
    ? { ...componentAction("set_theme", `The ${theme} CRT theme is active in the widget.`), structuredContent: { action: "set_theme", theme } }
    : authError(["story:sessions:write"]));

  registerAppTool(server, "submit_feedback", {
    title: "Send LoreSight Feedback",
    description: "Submit feedback explicitly entered in the LoreSight widget with an optional privacy-bounded diagnostic snapshot.",
    inputSchema: {
      category: z.enum(["bug", "idea", "other"]),
      message: z.string().min(10).max(4000),
      contact: z.string().max(320).optional(),
      diagnostics: z.object({
        formatVersion: z.literal(1),
        capturedAt: z.string(),
        entries: z.array(z.object({ timestamp: z.string(), level: z.string(), event: z.string(), message: z.string(), stack: z.string().optional() })).max(80),
        environment: z.object({ path: z.string(), viewport: z.string(), online: z.boolean(), language: z.string() }),
      }).optional(),
      context: z.object({ displayMode: z.string(), theme: z.string(), storyLoaded: z.boolean(), interpreterVersion: z.number().nullable() }),
    },
    outputSchema: { ok: z.literal(true), id: z.string(), receivedAt: z.string() },
    annotations: toolContract("submit_feedback").annotations,
    _meta: { ui: { visibility: ["app"] }, ...oauthToolMeta(toolContract("submit_feedback").scopes, Boolean(oauth)) },
  }, async (payload) => {
    if (!hasScopes(actor, ["story:sessions:read"])) return authError(["story:sessions:read"]);
    const limit = runtimeLimiter.consume(`${actor.subjectId}:feedback`, STORYFRAME_RATE_LIMITS.feedback);
    if (!limit.allowed) return rateLimitError(limit.retryAfterSeconds);
    const record = await submitFeedbackPayload(payload);
    return { structuredContent: { ok: true as const, id: record.id, receivedAt: record.receivedAt }, content: [{ type: "text" as const, text: "LoreSight feedback received." }] };
  });

  registerAppTool(
    server,
    "get_story_recap",
    {
      title: "Get Story Recap",
      description:
        "Use this when the player asks where they are in the current LoreSight story or what they last entered.",
      inputSchema: { sessionId: z.string().min(1) },
      outputSchema: { view: playerViewSchema },
      annotations: toolContract("get_story_recap").annotations,
      _meta: { ui: { visibility: ["model"] }, ...oauthToolMeta(toolContract("get_story_recap").scopes, Boolean(oauth)) },
    },
    async ({ sessionId }) => hasScopes(actor, ["story:sessions:read"])
      ? {
          structuredContent: { view: sessionView(getSession(sessionId, actor.subjectId)) },
          content: [{ type: "text" as const, text: "Current LoreSight story recap retrieved." }],
        }
      : authError(["story:sessions:read"]),
  );

  registerAppTool(
    server,
    "get_story_state",
    {
      title: "Get Story State",
      description:
        "Use this when the player asks for the current story moment, released clues, progress, or available choices.",
      inputSchema: { sessionId: z.string().min(1) },
      outputSchema: { view: playerViewSchema },
      annotations: toolContract("get_story_state").annotations,
      _meta: { ui: { visibility: ["model"] }, ...oauthToolMeta(toolContract("get_story_state").scopes, Boolean(oauth)) },
    },
    async ({ sessionId }) => hasScopes(actor, ["story:sessions:read"])
      ? storyResult(sessionView(getSession(sessionId, actor.subjectId)), "Current LoreSight story state retrieved.")
      : authError(["story:sessions:read"]),
  );

  registerAppTool(
    server,
    "submit_story_command",
    {
      title: "Submit Story Command",
      description:
        "Use this when the player types a command for the active LoreSight story. Preserve the expected state version so retries cannot apply twice.",
      inputSchema: {
        sessionId: z.string().min(1),
        command: z.string().min(1).max(500),
        expectedStateVersion: z.number().int().nonnegative(),
        mutationId: z.string().uuid(),
      },
      outputSchema: {
        view: playerViewSchema,
        operation: z.object({
          status: z.enum(["committed", "duplicate", "rejected"]),
          code: z.enum(["version-conflict", "intent-unavailable"]).optional(),
          message: z.string().optional(),
        }),
      },
      annotations: toolContract("submit_story_command").annotations,
      _meta: { ui: { visibility: ["model", "app"] }, ...oauthToolMeta(toolContract("submit_story_command").scopes, Boolean(oauth)) },
    },
    async (input) => {
      if (!hasScopes(actor, ["story:sessions:write"])) return authError(["story:sessions:write"]);
      const limit = runtimeLimiter.consume(`${actor.subjectId}:story-turn`, STORYFRAME_RATE_LIMITS.storyTurns);
      if (!limit.allowed) return rateLimitError(limit.retryAfterSeconds);
      const result = submitCommand({ ...input, ownerId: actor.subjectId });
      const view = sessionView(result.session);
      return storyResult(
        view,
        result.status === "rejected" ? result.message ?? "The command was rejected." : "The story accepted your command.",
        { status: result.status, message: result.message },
      );
    },
  );

  registerAppTool(
    server,
    "open_story_interface",
    {
      title: "Open Story Interface",
      description:
        "Use this after a story session exists when the player wants the persistent visual interface for the current story state.",
      inputSchema: { sessionId: z.string().min(1) },
      outputSchema: { view: playerViewSchema },
      annotations: toolContract("open_story_interface").annotations,
      _meta: {
        ui: { resourceUri: WIDGET_URI, visibility: ["model"] },
        "openai/outputTemplate": WIDGET_URI,
        ...oauthToolMeta(toolContract("open_story_interface").scopes, Boolean(oauth)),
      },
    },
    async ({ sessionId }) => hasScopes(actor, ["story:sessions:read"])
      ? (() => {
          const view = sessionView(getSession(sessionId, actor.subjectId));
          return Promise.resolve({
            structuredContent: { view },
            content: [{ type: "text" as const, text: "LoreSight terminal opened." }],
          });
        })()
      : authError(["story:sessions:read"]),
  );

  registerAppTool(
    server,
    "generate_story_narration",
    {
      title: "Generate Story Narration",
      description:
        "Use this from the LoreSight widget when the player asks to hear the visible story text read aloud.",
      inputSchema: { text: z.string().min(1).max(800) },
      outputSchema: { ready: z.boolean() },
      annotations: toolContract("generate_story_narration").annotations,
      _meta: { ui: { visibility: ["app"] }, ...oauthToolMeta(toolContract("generate_story_narration").scopes, Boolean(oauth)) },
    },
    async ({ text }) => {
      if (!hasScopes(actor, ["story:sessions:read"])) return authError(["story:sessions:read"]);
      const limit = runtimeLimiter.consume(`${actor.subjectId}:narration`, STORYFRAME_RATE_LIMITS.narration);
      if (!limit.allowed) return rateLimitError(limit.retryAfterSeconds);
      return {
        structuredContent: { ready: true },
        content: [{ type: "text" as const, text: "AI-generated narration is ready in the widget." }],
        _meta: {
          audioDataUrl: await generateNarrationDataUrl(text),
          audioDisclosure: "AI-generated voice",
        },
      };
    },
  );

  if (creatorToolsEnabled) {
    registerAppTool(
      server,
      "generate_story_proposal",
      {
        title: "Generate Story Proposal",
        description:
          "Create a compiler-validated New or Remix StoryFrame draft for creator review. This never publishes automatically. Remix requests must include rights classification and an approved source inspection dossier.",
        inputSchema: {
          mode: z.enum(["new", "remix"]),
          prompt: z.string().min(20).max(8_000),
          rights: z.enum(["original", "public-domain", "licensed", "user-supplied-private"]),
          source: z.object({
            format: z.enum(["storyframe", "z3", "z4", "z5", "z8", "zblorb"]),
            byteLength: z.number().int().nonnegative().max(2_000_000),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            release: z.number().int().optional(),
            serial: z.string().max(32).optional(),
            checksum: z.number().int().optional(),
            storyframeSource: z.string().max(100_000).optional(),
          }).optional(),
        },
        outputSchema: {
          proposal: z.object({
            id: z.string(), mode: z.enum(["new", "remix"]), status: z.literal("draft"), source: z.string(),
            diagnostics: z.array(z.unknown()), summary: z.string(), fidelityPlan: z.array(z.string()),
            capabilityNotes: z.array(z.string()), createdAt: z.string(),
          }),
        },
        annotations: toolContract("generate_story_proposal").annotations,
        _meta: { ui: { visibility: ["app"] }, ...oauthToolMeta(toolContract("generate_story_proposal").scopes, Boolean(oauth)) },
      },
      async (input) => {
        if (!hasScopes(actor, ["story:worlds:write"])) return authError(["story:worlds:write"]);
        if (!storyGenerationProvider) {
          return {
            structuredContent: { error: "story-generation-not-configured" },
            content: [{ type: "text" as const, text: "Story generation is disabled until STORYFRAME_GENERATION_ENABLED=true and a server-side OPENAI_API_KEY are configured." }],
          };
        }
        const limit = runtimeLimiter.consume(`${actor.subjectId}:story-generation`, { limit: 3, windowMs: 3_600_000 });
        if (!limit.allowed) return rateLimitError(limit.retryAfterSeconds);
        if (input.mode === "remix" && !input.source) {
          return {
            structuredContent: { error: "remix-source-required" },
            content: [{ type: "text" as const, text: "Remix requires a rights classification and source inspection dossier before generation." }],
          };
        }
        try {
          const generated = await storyGenerationProvider.generate(input);
          const proposal = validateStoryProposal(input.mode, generated);
          return {
            structuredContent: { proposal },
            content: [{ type: "text" as const, text: `StoryFrame ${input.mode} proposal ${proposal.id} is compiler-validated and awaiting creator review. It has not been published.` }],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Story proposal generation failed.";
          return { structuredContent: { error: "story-generation-failed" }, content: [{ type: "text" as const, text: message }] };
        }
      },
    );
  }

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > 120_000) throw new NarrationError("Request body is too large.", 413);
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function handleNodeRequest(req: IncomingMessage, res: ServerResponse) {
  if (!req.url) return res.writeHead(400).end("Missing URL");
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const requestId = resolveRequestId(req.headers["x-request-id"]);
  const startedAt = performance.now();
  res.setHeader("x-request-id", requestId);
  res.once("finish", () => {
    writeOperationalEvent({
      event: "http.request.complete",
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      requestId,
      details: {
        method: req.method ?? "UNKNOWN",
        path: url.pathname,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      },
    });
  });

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ name: "LoreSight", status: "available" }));
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, directorConfigured: Boolean(directorAdapters) }));
  }

  if (req.method === "GET" && url.pathname === "/ready") {
    const snapshot = readiness.snapshot();
    res.writeHead(snapshot.ready ? 200 : 503, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    return res.end(JSON.stringify(snapshot));
  }

  if (req.method === "GET" && url.pathname === "/.well-known/oauth-protected-resource" && oauth) {
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    });
    return res.end(JSON.stringify(oauth.authorizer.protectedResourceMetadata()));
  }

  if (req.method === "GET" && url.pathname === "/docs/authorization") {
    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    });
    return res.end(oauthAuthorizationDocs);
  }

  if (req.method === "GET" && url.pathname === "/favicon.ico") {
    res.writeHead(204, { "cache-control": "public, max-age=86400" });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/widget") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    return res.end(widgetHtml);
  }

  if (req.method === "GET" && ["/desk", "/demo"].includes(url.pathname)) {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    return res.end(widgetHtml);
  }

  if (req.method === "GET" && url.pathname === "/launch-pad") {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    return res.end(launchPadAssets.html);
  }

  if (req.method === "GET" && url.pathname === "/launch-pad/app.js") {
    res.writeHead(200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    return res.end(launchPadAssets.javascript);
  }

  if (req.method === "GET" && url.pathname === "/launch-pad/app.css") {
    res.writeHead(200, {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    return res.end(launchPadAssets.css);
  }

  if (req.method === "GET" && url.pathname === "/api/theme-profiles") {
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    return res.end(JSON.stringify(readThemeProfiles()));
  }

  if (await handleFeedbackRequest(req, res, url)) return;

  const isLoopbackPreview = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (req.method === "POST" && url.pathname === "/narration" && isLoopbackPreview) {
    try {
      const limit = runtimeLimiter.consume(`${req.socket.remoteAddress ?? "local"}:preview-narration`, STORYFRAME_RATE_LIMITS.narration);
      if (!limit.allowed) {
        res.writeHead(429, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "retry-after": String(limit.retryAfterSeconds),
        });
        return res.end(JSON.stringify({ error: "Narration is temporarily rate limited." }));
      }
      const body = await readJsonBody(req) as { text?: unknown };
      if (typeof body.text !== "string") throw new NarrationError("Narration text is required.", 400);
      const audioDataUrl = await generateNarrationDataUrl(body.text);
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      return res.end(JSON.stringify({ audioDataUrl, disclosure: "AI-generated voice" }));
    } catch (error) {
      const status = error instanceof NarrationError ? error.status : 400;
      const message = error instanceof NarrationError ? error.message : "Invalid narration request.";
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: message }));
    }
  }

  if (await handleAdminRequest(req, res, url, adminAssets)) return;

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    return res.end();
  }

  if (url.pathname === MCP_PATH && req.method && ["POST", "GET", "DELETE"].includes(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    let actor = localActor;
    if (oauth) {
      try {
        actor = await oauth.authorizer.authorize({
          authorizationHeader: req.headers.authorization,
          requiredScopes: [],
          nowEpochSeconds: Math.floor(Date.now() / 1000),
          traceId: requestId,
        });
      } catch (error) {
        const code = error instanceof AuthorizationError && error.code === "insufficient-scope"
          ? "insufficient_scope" : "invalid_token";
        writeOperationalEvent({
          event: "oauth.authorization.denied",
          level: "warn",
          requestId,
          details: { code, error: errorName(error) },
        });
        res.writeHead(401, {
          "content-type": "application/json; charset=utf-8",
          "www-authenticate": oauth.authorizer.challenge([], code),
          "cache-control": "no-store",
        });
        return res.end(JSON.stringify({ error: "authorization_required" }));
      }
    }
    const server = createLoreSightServer(actor);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      writeOperationalEvent({
        event: "mcp.request.failed",
        level: "error",
        requestId,
        details: { error: errorName(error) },
      });
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
}

const httpServer = createServer(handleNodeRequest);

httpServer.requestTimeout = 35_000;
httpServer.headersTimeout = 10_000;
httpServer.keepAliveTimeout = 5_000;

if (process.env.VERCEL !== "1") {
  httpServer.listen(port, "0.0.0.0", () => {
    readiness.markReady();
    writeOperationalEvent({
      event: "service.ready",
      level: "info",
      details: { port, oauthEnabled: Boolean(oauth) },
    });
  });
} else {
  readiness.markReady();
}

let shutdownStarted = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shutdownStarted) return;
  shutdownStarted = true;
  readiness.markStopping();
  writeOperationalEvent({ event: "service.stopping", level: "info", details: { signal } });
  const forceTimer = setTimeout(() => {
    writeOperationalEvent({ event: "service.shutdown.timeout", level: "error" });
    process.exitCode = 1;
    httpServer.closeAllConnections();
  }, 10_000);
  forceTimer.unref();
  httpServer.close((error) => {
    clearTimeout(forceTimer);
    if (error) {
      process.exitCode = 1;
      writeOperationalEvent({ event: "service.shutdown.failed", level: "error", details: { error: errorName(error) } });
    } else {
      writeOperationalEvent({ event: "service.stopped", level: "info" });
    }
  });
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

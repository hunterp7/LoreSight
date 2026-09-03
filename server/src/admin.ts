import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSession, getAvailableIntents, resolveTurn } from "@storyframe/engine-core";
import { projectCreatorView, projectPlayerView } from "@storyframe/projections";
import {
  auditStoryline,
  exploreStoryBranches,
  runAuthoredWorldTests,
  simulateCorrection,
} from "@storyframe/story-debugger";
import { compileStoryframe } from "@storyframe/storyframe";
import type { DomainEvent, GameState, WorldPack } from "@storyframe/world-schema";
import { JsonAdminStore, type StoredDraft } from "./admin-store.js";
import { devopsActions, devopsIsEnabled, getDevopsJob, startDevopsJob } from "./devops-jobs.js";
import { writeThemeProfiles, type ThemeProfileMap } from "./theme-profiles.js";
import { readFeedbackRecords } from "./feedback.js";

const here = dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 512_000;

interface ManagedSession {
  kind: "playtest";
  world: WorldPack;
  initialState: GameState;
  state: GameState;
  events: DomainEvent[];
  startedAt: string;
}

interface CorrectionProposal {
  id: string;
  createdAt: string;
  sessionId: string;
  forkAtVersion: number;
  intentId: string;
  reason: string;
  status: string;
  differences: ReturnType<typeof simulateCorrection>["differences"];
}

const playtests = new Map<string, ManagedSession>();
const correctionProposals: CorrectionProposal[] = [];
const drafts = new Map<string, StoredDraft>();

function loadWorld(relativePath: string): { sourceId: string; result: ReturnType<typeof compileStoryframe> } {
  const sourceId = resolve(here, "../../worlds/conformance", relativePath);
  const source = readFileSync(sourceId, "utf8");
  return { sourceId, result: compileStoryframe(source, sourceId) };
}

const compiledWorlds = ["investigation.storyframe", "survival.storyframe", "trading.storyframe"]
  .map(loadWorld);

function worldById(worldId: string): WorldPack | undefined {
  for (const entry of compiledWorlds) {
    if (entry.result.ok && entry.result.world.manifest.id === worldId) return entry.result.world;
  }
  return undefined;
}

const adminStore = new JsonAdminStore(
  process.env.STORYFRAME_ADMIN_DATA_FILE || resolve(process.cwd(), ".storyframe-data/admin.json"),
);
const storedAdmin = await adminStore.load();
for (const stored of storedAdmin.playtests) {
  const world = worldById(stored.worldId);
  if (!world || world.manifest.version !== stored.worldVersion) continue;
  playtests.set(stored.state.sessionId, {
    kind: "playtest",
    world,
    initialState: stored.initialState,
    state: stored.state,
    events: stored.events,
    startedAt: stored.startedAt,
  });
}
correctionProposals.push(...storedAdmin.correctionProposals as CorrectionProposal[]);
for (const draft of storedAdmin.drafts) drafts.set(draft.id, draft);

async function persistAdminState(): Promise<void> {
  await adminStore.save({
    formatVersion: 1,
    playtests: [...playtests.values()].map((session) => ({
      worldId: session.world.manifest.id,
      worldVersion: session.world.manifest.version,
      initialState: session.initialState,
      state: session.state,
      events: session.events,
      startedAt: session.startedAt,
    })),
    correctionProposals,
    drafts: [...drafts.values()],
  });
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(payload));
}

function text(res: ServerResponse, status: number, contentType: string, payload: string): void {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "referrer-policy": "no-referrer",
  });
  res.end(payload);
}

function normalizeEnhancements(value: unknown): StoredDraft["enhancements"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const shell = item.shell === "authored" ? "authored" : "default-crt";
  const audio = item.audio === "on" ? "on" : "off";
  const imagery = item.imagery === "occasional" || item.imagery === "rich" ? item.imagery : "text-first";
  const motion = item.motion === "subtle" || item.motion === "alive" ? item.motion : "calm";
  const guidance = item.guidance === "balanced" || item.guidance === "hands-on" ? item.guidance : "minimal";
  const notes = typeof item.notes === "string" ? item.notes.trim().slice(0, 280) : "";
  return {
    shell,
    audio,
    imagery,
    motion,
    guidance,
    ...(notes ? { notes } : {}),
  };
}

export function adminTokenIsValid(authorization: string | undefined, expected: string | undefined): boolean {
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body exceeds 512 KB.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON body must be an object.");
  }
  return parsed as Record<string, unknown>;
}

function worldSummaries() {
  return compiledWorlds.map(({ sourceId, result }) =>
    result.ok
      ? (() => {
          const authoredTests = runAuthoredWorldTests(result.world);
          const branchCoverage = exploreStoryBranches(result.world, {
            maxDepth: 16,
            maxStates: 2_000,
            seed: 42,
          });
          const openingFrame = result.world.frames?.find((frame) => frame.id === result.world.initialState.frameId);
          return {
          id: result.world.manifest.id,
          version: result.world.manifest.version,
          title: result.world.manifest.title,
          compileStatus: "ready",
          diagnostics: result.diagnostics,
          intents: result.world.intents.length,
          frames: result.world.frames?.length ?? 0,
          artifacts: result.world.artifacts?.length ?? 0,
          spans: result.world.spans?.length ?? 0,
          authoredTests: {
            ok: authoredTests.ok,
            passed: authoredTests.passed,
            failed: authoredTests.failed,
          },
          opening: openingFrame?.text,
          branchCoverage: {
            complete: branchCoverage.complete,
            exploredStates: branchCoverage.exploredStates,
            coverage: branchCoverage.coverage,
            deadEnds: branchCoverage.deadEnds.length,
            unreachedFrameIds: branchCoverage.unreachedFrameIds,
            unexercisedIntentIds: branchCoverage.unexercisedIntentIds,
          },
          sourceId,
        };
        })()
      : {
          id: sourceId,
          version: "draft",
          title: sourceId.split("/").at(-1),
          compileStatus: "error",
          diagnostics: result.diagnostics,
          intents: 0,
          frames: 0,
          artifacts: 0,
          spans: 0,
          authoredTests: { ok: false, passed: 0, failed: 0 },
          branchCoverage: undefined,
          sourceId,
        },
  );
}

function sessionSummaries() {
  const generic = [...playtests.values()].map((session) => ({
    sessionId: session.state.sessionId,
    worldId: session.state.worldId,
    worldVersion: session.state.worldVersion,
    stateVersion: session.state.stateVersion,
    status: session.state.status,
    frameId: session.state.frameId,
    startedAt: session.startedAt,
    kind: session.kind,
    issueCount: auditStoryline(session.world, session.initialState, session.events).issues.length,
  }));
  return generic.sort((left, right) =>
    right.startedAt.localeCompare(left.startedAt),
  );
}

function sessionDetail(sessionId: string): unknown | undefined {
  const session = playtests.get(sessionId);
  if (session) {
    const audit = auditStoryline(session.world, session.initialState, session.events);
    const frame = session.world.frames?.find((candidate) => candidate.id === session.state.frameId);
    const span = session.world.spans?.find((candidate) => candidate.spanId === session.state.frameId);
    const history = session.events.map((event) => {
      const intent = session.world.intents.find((candidate) => candidate.id === event.intentId);
      return {
        id: event.id,
        intentId: event.intentId,
        title: intent?.title ?? event.intentId,
        description: intent?.description,
        step: event.stateVersionAfter,
      };
    });
    return {
      kind: session.kind,
      state: session.state,
      events: session.events,
      audit,
      creatorView: projectCreatorView(session.world, session.state),
      playerView: projectPlayerView(session.world, session.state),
      scene: {
        id: session.state.frameId,
        title: frame?.title ?? (span ? "Review the evidence" : "Current scene"),
        text: frame?.text ?? span?.fallback[0] ?? "Choose the next action to continue this story path.",
      },
      history,
      availableIntents: getAvailableIntents(session.world, session.state).map(({ id, title, description }) => ({ id, title, description })),
      sourceMap: session.world.sourceMap,
    };
  }
  return undefined;
}

const scenarios = [
  { id: "compile-failure", label: "Draft will not compile", response: "Open diagnostics, jump to source, repair, compile twice." },
  { id: "story-dead-end", label: "Player has no legal action", response: "Audit the exact version, inspect frame source, revise a new world draft." },
  { id: "wrong-rule", label: "Reveal or transition fired unexpectedly", response: "Compare the committed rule trace with source and deterministic resolution." },
  { id: "visual-clue", label: "Visual clue is missing or inaccessible", response: "Verify reveal event, asset key, MIME, alt text, and textual fallback." },
  { id: "secret-leak", label: "Hidden information appeared early", response: "Freeze release, inspect player/model projections, correct before resuming tests." },
  { id: "player-recovery", label: "A tester needs an earlier choice corrected", response: "Fork at a version boundary, simulate, review the diff, never rewrite original history." },
  { id: "version-conflict", label: "Two clients submitted against one state", response: "Keep the first commit, refresh the stale client, preserve mutation IDs on retry." },
];

export interface AdminAssets {
  html: string;
  javascript: string;
  css: string;
}

export async function handleAdminRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  assets: AdminAssets,
): Promise<boolean> {
  // The operations console is a private surface. In production it is only
  // routable when an explicit admin credential is configured; otherwise the
  // public deployment must not reveal that the console exists.
  const adminCredentialConfigured = Boolean(process.env.STORYFRAME_ADMIN_PASSWORD || process.env.STORYFRAME_ADMIN_TOKEN);
  if (process.env.NODE_ENV === "production" && !adminCredentialConfigured && url.pathname.startsWith("/admin")) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    res.end("Not found");
    return true;
  }
  if (req.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) {
    text(res, 200, "text/html; charset=utf-8", assets.html);
    return true;
  }
  if (req.method === "GET" && url.pathname === "/admin/app.js") {
    text(res, 200, "text/javascript; charset=utf-8", assets.javascript);
    return true;
  }
  if (req.method === "GET" && url.pathname === "/admin/app.css") {
    text(res, 200, "text/css; charset=utf-8", assets.css);
    return true;
  }
  if (!url.pathname.startsWith("/admin/api/")) return false;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (
    process.env.NODE_ENV === "production" &&
    forwardedProto !== "https" &&
    !("encrypted" in req.socket && req.socket.encrypted)
  ) {
    json(res, 426, { error: "Remote admin access requires HTTPS in production." });
    return true;
  }

  const token = process.env.STORYFRAME_ADMIN_PASSWORD || process.env.STORYFRAME_ADMIN_TOKEN;
  if (!token) {
    json(res, 503, { error: "Admin API is disabled until STORYFRAME_ADMIN_PASSWORD is configured." });
    return true;
  }
  if (!adminTokenIsValid(req.headers.authorization, token)) {
    res.setHeader("www-authenticate", 'Bearer realm="LoreSight Admin"');
    json(res, 401, { error: "Valid admin credentials are required." });
    return true;
  }

  try {
    if (req.method === "GET" && url.pathname === "/admin/api/devops/actions") {
      json(res, 200, { enabled: devopsIsEnabled(), actions: devopsActions() });
      return true;
    }
    if (req.method === "POST" && url.pathname === "/admin/api/devops/jobs") {
      if (!devopsIsEnabled()) {
        json(res, 403, { error: "Command buttons are disabled in production until STORYFRAME_DEVOPS_ENABLED=true is set." });
        return true;
      }
      const body = await readJsonBody(req);
      const job = startDevopsJob(String(body.actionId ?? ""));
      json(res, 202, { job });
      return true;
    }
    const devopsJobMatch = url.pathname.match(/^\/admin\/api\/devops\/jobs\/([0-9a-f-]+)$/i);
    if (req.method === "GET" && devopsJobMatch) {
      const job = getDevopsJob(devopsJobMatch[1]);
      json(res, job ? 200 : 404, job ? { job } : { error: "Operation not found." });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/admin/api/overview") {
      json(res, 200, {
        generatedAt: new Date().toISOString(),
        worlds: worldSummaries(),
        sessions: sessionSummaries(),
        correctionProposalCount: correctionProposals.length,
        draftCount: drafts.size,
        scenarios,
      });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/admin/api/feedback") {
      json(res, 200, { feedback: await readFeedbackRecords(200) });
      return true;
    }
    if (req.method === "POST" && url.pathname === "/admin/api/theme-profiles") {
      const body = await readJsonBody(req);
      const profiles = body.profiles;
      if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) {
        json(res, 400, { error: "Theme profiles must be an object keyed by theme id." });
        return true;
      }
      writeThemeProfiles(profiles as ThemeProfileMap);
      json(res, 200, { ok: true, savedAt: new Date().toISOString() });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/admin/api/sessions") {
      json(res, 200, { sessions: sessionSummaries() });
      return true;
    }
    const sessionMatch = url.pathname.match(/^\/admin\/api\/sessions\/([^/]+)$/);
    if (req.method === "GET" && sessionMatch) {
      const detail = sessionDetail(decodeURIComponent(sessionMatch[1]));
      json(res, detail ? 200 : 404, detail ?? { error: "Session not found." });
      return true;
    }
    if (req.method === "POST" && url.pathname === "/admin/api/playtests") {
      const body = await readJsonBody(req);
      const world = worldById(String(body.worldId ?? ""));
      if (!world) {
        json(res, 404, { error: "Compiled world not found." });
        return true;
      }
      const sessionId = `playtest-${randomUUID()}`;
      const initialState = createSession(world, {
        sessionId,
        ownerId: "admin-playtest",
        seed: Number.isSafeInteger(body.seed) ? Number(body.seed) : 42,
      });
      playtests.set(sessionId, {
        kind: "playtest",
        world,
        initialState,
        state: initialState,
        events: [],
        startedAt: new Date().toISOString(),
      });
      await persistAdminState();
      json(res, 201, sessionDetail(sessionId));
      return true;
    }
    const intentMatch = url.pathname.match(/^\/admin\/api\/playtests\/([^/]+)\/intents$/);
    if (req.method === "POST" && intentMatch) {
      const sessionId = decodeURIComponent(intentMatch[1]);
      const session = playtests.get(sessionId);
      if (!session) {
        json(res, 404, { error: "Playtest session not found." });
        return true;
      }
      const body = await readJsonBody(req);
      const result = resolveTurn({
        world: session.world,
        state: session.state,
        command: { intentId: String(body.intentId ?? "") },
        expectedStateVersion: Number(body.expectedStateVersion),
        mutationId: String(body.mutationId ?? randomUUID()),
      });
      if (result.status === "committed") {
        session.state = result.state;
        session.events.push(...result.events);
        await persistAdminState();
      }
      json(res, result.status === "rejected" ? 409 : 200, { result, session: sessionDetail(sessionId) });
      return true;
    }
    if (req.method === "POST" && url.pathname === "/admin/api/corrections") {
      const body = await readJsonBody(req);
      const sessionId = String(body.sessionId ?? "");
      const session = playtests.get(sessionId);
      if (!session) {
        json(res, 404, { error: "Only deterministic playtest sessions can be corrected." });
        return true;
      }
      const forkAtVersion = Number(body.forkAtVersion);
      const intentId = String(body.intentId ?? "");
      const reason = String(body.reason ?? "").trim();
      if (reason.length < 8) {
        json(res, 400, { error: "A correction reason of at least eight characters is required." });
        return true;
      }
      const simulation = simulateCorrection({
        world: session.world,
        initialState: session.initialState,
        events: session.events,
        forkAtVersion,
        branchSessionId: `${sessionId}-correction-${correctionProposals.length + 1}`,
        command: { intentId },
        mutationId: `admin-correction-${randomUUID()}`,
      });
      const proposal: CorrectionProposal = {
        id: `correction-${randomUUID()}`,
        createdAt: new Date().toISOString(),
        sessionId,
        forkAtVersion,
        intentId,
        reason,
        status: simulation.correction.status,
        differences: simulation.differences,
      };
      correctionProposals.push(proposal);
      await persistAdminState();
      json(res, 201, { proposal, simulation });
      return true;
    }
    if (req.method === "GET" && url.pathname === "/admin/api/drafts") {
      json(res, 200, {
        drafts: [...drafts.values()]
          .map(({ source: _source, ...draft }) => draft)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      });
      return true;
    }
    const draftMatch = url.pathname.match(/^\/admin\/api\/drafts\/([A-Za-z][A-Za-z0-9._-]{0,79})$/);
    if (req.method === "GET" && draftMatch) {
      const draft = drafts.get(draftMatch[1]);
      json(res, draft ? 200 : 404, draft ?? { error: "Draft not found." });
      return true;
    }
    if (req.method === "PUT" && draftMatch) {
      const body = await readJsonBody(req);
      const source = String(body.source ?? "");
      const title = String(body.title ?? "Untitled draft").trim().slice(0, 120) || "Untitled draft";
      if (!source.trim()) {
        json(res, 400, { error: "Draft story text is required." });
        return true;
      }
      const compilation = compileStoryframe(source, `admin-draft://${draftMatch[1]}`);
      const enhancements = normalizeEnhancements(body.enhancements);
      const draft: StoredDraft = {
        id: draftMatch[1],
        title,
        source,
        updatedAt: new Date().toISOString(),
        compileStatus: compilation.ok ? "ready" : "error",
        ...(enhancements ? { enhancements } : {}),
      };
      drafts.set(draft.id, draft);
      await persistAdminState();
      json(res, 200, { draft, diagnostics: compilation.diagnostics });
      return true;
    }
    if (req.method === "POST" && url.pathname === "/admin/api/compile") {
      const body = await readJsonBody(req);
      const source = String(body.source ?? "");
      const sourceId = String(body.sourceId ?? "admin-draft.storyframe");
      if (!source.trim()) {
        json(res, 400, { error: "LoreSight source is required." });
        return true;
      }
      const result = compileStoryframe(source, `admin://${sourceId.replace(/[^A-Za-z0-9._/-]/g, "_")}`);
      if (result.ok) {
        const authoredTests = runAuthoredWorldTests(result.world);
        const branchCoverage = exploreStoryBranches(result.world, {
          maxDepth: 16,
          maxStates: 2_000,
          seed: 42,
        });
        json(res, 200, {
            ok: true,
            diagnostics: result.diagnostics,
            summary: {
              id: result.world.manifest.id,
              version: result.world.manifest.version,
              frames: result.world.frames?.length ?? 0,
              intents: result.world.intents.length,
              artifacts: result.world.artifacts?.length ?? 0,
              spans: result.world.spans?.length ?? 0,
              threads: result.world.threads?.length ?? 0,
              choices: result.world.choices?.length ?? 0,
              authoredTests: result.world.tests?.length ?? 0,
              sourceMapEntries: Object.keys(result.world.sourceMap ?? {}).length,
            },
            authoredTestReport: authoredTests,
            branchCoverage,
          });
      } else {
        json(res, 422, result);
      }
      return true;
    }
    if (req.method === "GET" && url.pathname === "/admin/api/artifacts") {
      json(res, 200, {
        artifacts: compiledWorlds.flatMap(({ result }) => result.ok
          ? (result.world.artifacts ?? []).map((artifact) => ({ worldId: result.world.manifest.id, ...artifact }))
          : []),
      });
      return true;
    }
    json(res, 404, { error: "Admin endpoint not found." });
    return true;
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : "Admin request failed." });
    return true;
  }
}

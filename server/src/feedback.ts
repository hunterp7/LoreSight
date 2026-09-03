import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";

const MAX_BODY_BYTES = 96_000;
const MAX_ENTRIES = 80;
const feedbackFile = process.env.STORYFRAME_FEEDBACK_FILE || resolve(process.cwd(), ".storyframe-data/feedback.jsonl");
const rateWindows = new Map<string, { count: number; resetAt: number }>();

type SafeDiagnostic = { timestamp: string; level: string; event: string; message: string; stack?: string };

export interface FeedbackRecord {
  id: string;
  receivedAt: string;
  category: "bug" | "idea" | "other";
  message: string;
  contact?: string;
  diagnostics?: { formatVersion: 1; capturedAt: string; entries: SafeDiagnostic[]; environment: Record<string, string | boolean> };
  context: { displayMode?: string; theme?: string; storyLoaded?: boolean; interpreterVersion?: number | null };
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(payload));
}

function safeText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/([?&](?:token|key|secret|password|code)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|sess|proj)-[A-Za-z0-9_-]{12,}\b/g, "[redacted]")
    .replace(/\/Users\/[^/\s]+/g, "/Users/[redacted]")
    .slice(0, max);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_BODY_BYTES) throw new Error("too-large");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function consumeRateLimit(key: string): number | null {
  const now = Date.now();
  let entry = rateWindows.get(key);
  if (!entry || now >= entry.resetAt) entry = { count: 0, resetAt: now + 3_600_000 };
  if (entry.count >= 5) return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  entry.count += 1;
  rateWindows.set(key, entry);
  return null;
}

function normalizeDiagnostics(value: unknown): FeedbackRecord["diagnostics"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const rawEntries = Array.isArray(input.entries) ? input.entries.slice(-MAX_ENTRIES) : [];
  const entries = rawEntries.flatMap((item): SafeDiagnostic[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    return [{ timestamp: safeText(row.timestamp, 40), level: safeText(row.level, 16), event: safeText(row.event, 80), message: safeText(row.message, 1_200), ...(typeof row.stack === "string" ? { stack: safeText(row.stack, 4_000) } : {}) }];
  });
  const env = input.environment && typeof input.environment === "object" && !Array.isArray(input.environment) ? input.environment as Record<string, unknown> : {};
  return { formatVersion: 1, capturedAt: safeText(input.capturedAt, 40), entries, environment: { path: safeText(env.path, 120).split("?")[0].split("#")[0], viewport: safeText(env.viewport, 24), online: Boolean(env.online), language: safeText(env.language, 16) } };
}

function normalizeRecord(value: unknown): FeedbackRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
  const body = value as Record<string, unknown>;
  const category = body.category === "idea" || body.category === "other" ? body.category : body.category === "bug" ? "bug" : null;
  const message = safeText(body.message, 4_000).trim();
  const contact = safeText(body.contact, 320).trim();
  if (!category || message.length < 10) throw new Error("invalid");
  const rawContext = body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context as Record<string, unknown> : {};
  return {
    id: `feedback-${randomUUID()}`,
    receivedAt: new Date().toISOString(),
    category,
    message,
    ...(contact ? { contact } : {}),
    ...(body.diagnostics ? { diagnostics: normalizeDiagnostics(body.diagnostics) } : {}),
    context: { displayMode: safeText(rawContext.displayMode, 24), theme: safeText(rawContext.theme, 40), storyLoaded: Boolean(rawContext.storyLoaded), interpreterVersion: typeof rawContext.interpreterVersion === "number" ? rawContext.interpreterVersion : null },
  };
}

export async function submitFeedbackPayload(value: unknown): Promise<FeedbackRecord> {
  const record = normalizeRecord(value);
  await mkdir(dirname(feedbackFile), { recursive: true });
  await appendFile(feedbackFile, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
  return record;
}

export async function handleFeedbackRequest(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (url.pathname !== "/api/feedback") return false;
  if (req.method !== "POST") { json(res, 405, { error: "Method not allowed." }); return true; }
  if (!String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) { json(res, 415, { error: "Feedback must be sent as JSON." }); return true; }
  const retryAfter = consumeRateLimit(req.socket.remoteAddress ?? "unknown");
  if (retryAfter) { res.setHeader("retry-after", String(retryAfter)); json(res, 429, { error: "Too many feedback reports. Please try again later." }); return true; }
  try {
    const record = await submitFeedbackPayload(await readBody(req));
    json(res, 201, { ok: true, id: record.id, receivedAt: record.receivedAt });
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "too-large";
    json(res, tooLarge ? 413 : 400, { error: tooLarge ? "Feedback report is too large." : "Please provide a type and at least 10 characters of feedback." });
  }
  return true;
}

export async function readFeedbackRecords(limit = 100): Promise<FeedbackRecord[]> {
  try {
    const content = await readFile(feedbackFile, "utf8");
    return content.trim().split("\n").slice(-Math.max(1, Math.min(limit, 500))).reverse().flatMap((line) => {
      try { return [JSON.parse(line) as FeedbackRecord]; } catch { return []; }
    });
  } catch { return []; }
}

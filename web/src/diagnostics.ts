export type DiagnosticLevel = "breadcrumb" | "warning" | "error";

export interface DiagnosticEntry {
  timestamp: string;
  level: DiagnosticLevel;
  event: string;
  message: string;
  stack?: string;
}

export interface DiagnosticSnapshot {
  formatVersion: 1;
  capturedAt: string;
  entries: DiagnosticEntry[];
  environment: { path: string; viewport: string; online: boolean; language: string };
}

export interface FeedbackPayload {
  category: string;
  message: string;
  contact?: string;
  diagnostics?: DiagnosticSnapshot;
  context: { displayMode: string; theme: string; storyLoaded: boolean; interpreterVersion: number | null };
}

const MAX_ENTRIES = 80;
const entries: DiagnosticEntry[] = [];
let installed = false;

function redactText(value: string, limit = 1_200): string {
  return value
    .replace(/([?&](?:token|key|secret|password|code)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|sess|proj)-[A-Za-z0-9_-]{12,}\b/g, "[redacted]")
    .replace(/\/Users\/[^/\s]+/g, "/Users/[redacted]")
    .slice(0, limit);
}

function errorDetails(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) return { message: redactText(`${value.name}: ${value.message}`), stack: value.stack ? redactText(value.stack, 4_000) : undefined };
  if (typeof value === "string") return { message: redactText(value) };
  return { message: `[${typeof value} detail omitted]` };
}

function append(entry: DiagnosticEntry): void {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

export function recordDiagnostic(event: string, message: string, level: DiagnosticLevel = "breadcrumb"): void {
  append({ timestamp: new Date().toISOString(), level, event: redactText(event, 80), message: redactText(message) });
}

export function installDiagnostics(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  (["warn", "error"] as const).forEach((method) => {
    const original = console[method].bind(console);
    console[method] = (...values: unknown[]) => {
      const detail = errorDetails(values.find((value) => value instanceof Error) ?? values.find((value) => typeof value === "string") ?? "Console event");
      append({ timestamp: new Date().toISOString(), level: method === "error" ? "error" : "warning", event: `console.${method}`, ...detail });
      original(...values);
    };
  });
  window.addEventListener("error", (event) => append({ timestamp: new Date().toISOString(), level: "error", event: "window.error", ...errorDetails(event.error ?? event.message) }));
  window.addEventListener("unhandledrejection", (event) => append({ timestamp: new Date().toISOString(), level: "error", event: "promise.unhandled", ...errorDetails(event.reason) }));
  recordDiagnostic("app.started", "LoreSight client initialized");
}

export function getDiagnosticSnapshot(): DiagnosticSnapshot {
  return {
    formatVersion: 1,
    capturedAt: new Date().toISOString(),
    entries: entries.map((entry) => ({ ...entry })),
    environment: { path: window.location.pathname, viewport: `${window.innerWidth}x${window.innerHeight}`, online: navigator.onLine, language: navigator.language.slice(0, 16) },
  };
}

export function diagnosticEntryCount(): number { return entries.length; }

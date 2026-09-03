import { randomUUID } from "node:crypto";

export interface OperationalEvent {
  event: string;
  level: "info" | "warn" | "error";
  requestId?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
}

const REQUEST_ID = /^[A-Za-z0-9_-]{8,80}$/;

export function resolveRequestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate && REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

export function errorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : "UnknownError";
}

/** Emits explicit operational fields only; request bodies, tokens, and story prose are never accepted. */
export function writeOperationalEvent(
  event: OperationalEvent,
  sink: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
): void {
  sink(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "loresight-mcp",
    ...event,
    details: event.details
      ? Object.fromEntries(Object.entries(event.details).filter(([, value]) => value !== undefined))
      : undefined,
  }));
}

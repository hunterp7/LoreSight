import assert from "node:assert/strict";
import test from "node:test";
import {
  errorName,
  resolveRequestId,
  writeOperationalEvent,
} from "../server/dist/observability.js";

test("request ids preserve safe upstream correlation and replace unsafe input", () => {
  assert.equal(resolveRequestId("trace_20260803"), "trace_20260803");
  assert.match(resolveRequestId("Bearer secret value"), /^[0-9a-f-]{36}$/);
  assert.match(resolveRequestId(undefined), /^[0-9a-f-]{36}$/);
});

test("operational logs contain bounded metadata without request content", () => {
  let line = "";
  writeOperationalEvent({
    event: "http.request.complete",
    level: "info",
    requestId: "trace_20260803",
    details: { method: "POST", path: "/mcp", status: 200, durationMs: 12 },
  }, (value) => { line = value; });
  const logged = JSON.parse(line);
  assert.equal(logged.service, "loresight-mcp");
  assert.deepEqual(logged.details, { method: "POST", path: "/mcp", status: 200, durationMs: 12 });
  assert.equal(line.includes("authorization"), false);
  assert.equal(line.includes("playerWords"), false);
  assert.equal(line.includes("audioDataUrl"), false);
});

test("error logging reports a class only, not a sensitive error message", () => {
  assert.equal(errorName(new TypeError("Bearer private-token")), "TypeError");
  assert.equal(errorName("raw secret"), "UnknownError");
});

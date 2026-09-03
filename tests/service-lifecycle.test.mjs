import assert from "node:assert/strict";
import test from "node:test";
import { ServiceReadiness } from "../server/dist/service-lifecycle.js";

test("service readiness exposes startup, ready, and terminal stopping phases", () => {
  const readiness = new ServiceReadiness();
  assert.deepEqual(readiness.snapshot(), { ready: false, phase: "starting" });
  readiness.markReady();
  assert.deepEqual(readiness.snapshot(), { ready: true, phase: "ready" });
  readiness.markStopping();
  assert.deepEqual(readiness.snapshot(), { ready: false, phase: "stopping" });
  assert.throws(() => readiness.markReady(), /Cannot become ready from stopping/);
});

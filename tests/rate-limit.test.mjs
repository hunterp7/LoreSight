import assert from "node:assert/strict";
import test from "node:test";
import { MemoryFixedWindowRateLimiter } from "../server/dist/rate-limit.js";

test("fixed-window limiter allows a bounded burst and reports retry timing", () => {
  const limiter = new MemoryFixedWindowRateLimiter();
  const policy = { limit: 2, windowMs: 10_000 };
  assert.deepEqual(limiter.consume("player:narration", policy, 1_000), {
    allowed: true, remaining: 1, retryAfterSeconds: 0,
  });
  assert.deepEqual(limiter.consume("player:narration", policy, 2_000), {
    allowed: true, remaining: 0, retryAfterSeconds: 0,
  });
  assert.deepEqual(limiter.consume("player:narration", policy, 2_001), {
    allowed: false, remaining: 0, retryAfterSeconds: 9,
  });
});

test("rate-limit windows are isolated by subject/action and reset deterministically", () => {
  const limiter = new MemoryFixedWindowRateLimiter();
  const policy = { limit: 1, windowMs: 1_000 };
  assert.equal(limiter.consume("one:turn", policy, 10).allowed, true);
  assert.equal(limiter.consume("two:turn", policy, 10).allowed, true);
  assert.equal(limiter.consume("one:turn", policy, 11).allowed, false);
  assert.equal(limiter.consume("one:turn", policy, 1_010).allowed, true);
});

test("rate limiter rejects unsafe configuration instead of disabling itself", () => {
  const limiter = new MemoryFixedWindowRateLimiter();
  assert.throws(() => limiter.consume("", { limit: 1, windowMs: 1 }), /must not be empty/);
  assert.throws(() => limiter.consume("key", { limit: 0, windowMs: 1 }), /positive integer/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { adminTokenIsValid } from "../server/dist/admin.js";

test("admin bearer authentication rejects missing, short, and incorrect tokens", () => {
  const expected = "correct-admin-token-at-least-24-chars";
  assert.equal(adminTokenIsValid(undefined, expected), false);
  assert.equal(adminTokenIsValid("Bearer short", expected), false);
  assert.equal(adminTokenIsValid(`Bearer ${expected}x`, expected), false);
  assert.equal(adminTokenIsValid(`Bearer ${expected}`, undefined), false);
});

test("admin bearer authentication accepts only the exact configured token", () => {
  const expected = "correct-admin-token-at-least-24-chars";
  assert.equal(adminTokenIsValid(`Bearer ${expected}`, expected), true);
});

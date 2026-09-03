import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JsonAdminStore } from "../server/dist/admin-store.js";

test("admin store atomically round-trips playtests, corrections, and drafts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "storyframe-admin-store-"));
  const filePath = join(directory, "nested", "admin.json");
  try {
    const store = new JsonAdminStore(filePath);
    assert.deepEqual(await store.load(), {
      formatVersion: 1,
      playtests: [],
      correctionProposals: [],
      drafts: [],
    });
    const snapshot = {
      formatVersion: 1,
      playtests: [],
      correctionProposals: [{
        id: "correction-1",
        createdAt: "2026-08-03T00:00:00.000Z",
        sessionId: "session-1",
        forkAtVersion: 1,
        intentId: "inspect_thread",
        reason: "The clue should appear sooner.",
        status: "committed",
        differences: [],
      }],
      drafts: [{
        id: "creator-studio",
        title: "Opening scene",
        source: "WORLD test.world v1.0.0",
        updatedAt: "2026-08-03T00:00:00.000Z",
        compileStatus: "error",
        enhancements: {
          shell: "authored",
          audio: "on",
          imagery: "occasional",
          motion: "subtle",
          guidance: "balanced",
          notes: "Use a warmer retro surround.",
        },
      }],
    };
    await store.save(snapshot);
    assert.deepEqual(await store.load(), snapshot);
    assert.equal((await readFile(filePath, "utf8")).endsWith("\n"), true);
    assert.equal((await stat(filePath)).mode & 0o777, 0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

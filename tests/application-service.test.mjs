import assert from "node:assert/strict";
import test from "node:test";
import { StoryAccessError, StoryApplicationService, StoryIntegrityError, StoryNotFoundError } from "../packages/application/dist/index.js";
import { MemoryStoryframeRepository } from "../packages/persistence/dist/index.js";
import { investigationWorld } from "../packages/test-fixtures/dist/index.js";

const writeActor = { subjectId: "owner-a", scopes: ["story:sessions:read", "story:sessions:write"] };
const otherActor = { subjectId: "owner-b", scopes: ["story:sessions:read", "story:sessions:write"] };
const clock = { now: () => "2026-08-03T12:00:00.000Z" };

async function setup() {
  const repository = new MemoryStoryframeRepository();
  await repository.publish({
    worldId: investigationWorld.manifest.id,
    worldVersion: investigationWorld.manifest.version,
    contentHash: "a".repeat(64),
    world: investigationWorld,
    createdAt: clock.now(),
    createdBy: "creator-a",
  });
  return { repository, service: new StoryApplicationService(repository, repository, clock) };
}

test("application service derives ownership from authenticated actor context", async () => {
  const { service } = await setup();
  const started = await service.startStory({
    actor: writeActor,
    sessionId: "session-a",
    worldId: investigationWorld.manifest.id,
    worldVersion: investigationWorld.manifest.version,
    seed: 42,
  });
  assert.equal(started.state.sessionId, "session-a");
  await assert.rejects(() => service.getStory(otherActor, "session-a"), StoryNotFoundError);
  await assert.rejects(
    () => service.getStory({ subjectId: "owner-a", scopes: [] }, "session-a"),
    StoryAccessError,
  );
});

test("application service commits once and returns duplicate receipts safely", async () => {
  const { service } = await setup();
  await service.startStory({
    actor: writeActor,
    sessionId: "session-a",
    worldId: investigationWorld.manifest.id,
    worldVersion: investigationWorld.manifest.version,
    seed: 42,
  });
  const first = await service.submitIntent({
    actor: writeActor,
    sessionId: "session-a",
    command: { intentId: "inspect_red_thread" },
    expectedStateVersion: 0,
    mutationId: "mutation-a",
  });
  assert.equal(first.status, "committed");
  assert.equal(first.view.state.stateVersion, 1);

  const duplicate = await service.submitIntent({
    actor: writeActor,
    sessionId: "session-a",
    command: { intentId: "inspect_red_thread" },
    expectedStateVersion: 0,
    mutationId: "mutation-a",
  });
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.view.state.stateVersion, 1);
});

test("application service refuses a stored state that diverges from its event log", async () => {
  const { repository, service } = await setup();
  await service.startStory({
    actor: writeActor,
    sessionId: "session-a",
    worldId: investigationWorld.manifest.id,
    worldVersion: investigationWorld.manifest.version,
    seed: 42,
  });
  const stored = await repository.getOwned("owner-a", "session-a");
  stored.state.frameId = "tampered";
  const corruptRepository = {
    ...repository,
    getOwned: async () => structuredClone(stored),
  };
  const corruptService = new StoryApplicationService(corruptRepository, repository, clock);
  await assert.rejects(() => corruptService.getStory(writeActor, "session-a"), StoryIntegrityError);
});

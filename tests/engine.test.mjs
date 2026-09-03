import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseEnding,
  examineArtifact,
  resetSessionsForTests,
  respond,
  startGame,
} from "../server/dist/engine.js";

test("Applicant Intake reaches a complete retain-life ending", () => {
  resetSessionsForTests();
  let state = startGame();
  assert.equal(state.stage, "orientation");
  assert.equal(state.artifacts.filter((item) => item.visible).length, 3);

  state = respond(state.playerId, "confirm_alive", "I am definitely alive.");
  assert.equal(state.stage, "memory_review");

  state = respond(state.playerId, "request_personnel_file", "Show me the file.");
  assert.equal(state.stage, "investigation");

  state = examineArtifact(state.playerId, "personnel-a17");
  state = examineArtifact(state.playerId, "elevator-1974");
  state = examineArtifact(state.playerId, "childhood-kit");
  assert.equal(state.artifacts.find((item) => item.id === "original-assignee")?.visible, true);
  assert.equal(state.stage, "investigation");

  state = examineArtifact(state.playerId, "original-assignee");
  assert.equal(state.stage, "resolution");

  state = chooseEnding(state.playerId, "retain_life");
  assert.equal(state.stage, "complete");
  assert.equal(state.progress, 100);
  assert.equal(state.ending?.id, "retain_life");
});

test("the final memorandum stays protected until all initial records are examined", () => {
  resetSessionsForTests();
  let state = startGame();
  state = respond(state.playerId, "express_uncertainty");
  state = respond(state.playerId, "admit_dejavu");
  state = examineArtifact(state.playerId, "personnel-a17");
  state = examineArtifact(state.playerId, "elevator-1974");
  assert.equal(state.artifacts.find((item) => item.id === "original-assignee")?.visible, false);
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "storyframe-smoke-test", version: "0.2.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://127.0.0.1:8787/mcp"));

await client.connect(transport);
const tools = await client.listTools();
const publicToolNames = new Set([
  "start_story_session",
  "list_story_library",
  "open_story_library",
  "load_story_file",
  "play_sample_story",
  "set_theme",
  "submit_feedback",
  "get_story_recap",
  "get_story_state",
  "submit_story_command",
  "open_story_interface",
  "generate_story_narration",
]);
assert.ok(publicToolNames.size <= tools.tools.length, `Expected at least ${publicToolNames.size} public tools, received ${tools.tools.length}`);
for (const name of publicToolNames) assert.ok(tools.tools.some((tool) => tool.name === name), `Missing public tool: ${name}`);
const renderTools = tools.tools.filter((tool) => tool._meta?.ui?.resourceUri);
assert.deepEqual(renderTools.map((tool) => tool.name), ["start_story_session", "open_story_interface"]);
assert.equal(renderTools[0]._meta.ui.resourceUri, "ui://widget/storyframe-player-v5.html");
assert.equal(tools.tools.some((tool) => tool.name === "generate_story_narration"), true);
assert.equal(tools.tools.some((tool) => tool.name === "list_story_library"), true);
assert.equal(tools.tools.some((tool) => tool.name === "get_story_recap"), true);
assert.equal(tools.tools.some((tool) => tool.name === "submit_story_command"), true);
assert.equal(tools.tools.some((tool) => tool.name === "submit_feedback"), true);

const started = await client.callTool({ name: "start_story_session", arguments: {} });
const initialView = started.structuredContent?.view;
assert.equal(initialView?.presentation?.layout, "focus");
assert.equal(initialView?.artifacts?.some((artifact) => artifact.id === "original-assignee"), false);

const opened = await client.callTool({ name: "open_story_interface", arguments: { sessionId: initialView.session.id } });
assert.equal(opened.structuredContent?.view?.session?.id, initialView.session.id);

const mutationId = randomUUID();
const submitted = await client.callTool({
  name: "submit_story_command",
  arguments: {
    sessionId: initialView.session.id,
    command: "look",
    expectedStateVersion: initialView.session.stateVersion,
    mutationId,
  },
});
assert.equal(submitted.structuredContent?.operation?.status, "committed");

const duplicate = await client.callTool({
  name: "submit_story_command",
  arguments: {
    sessionId: initialView.session.id,
    command: "look",
    expectedStateVersion: initialView.session.stateVersion,
    mutationId,
  },
});
assert.equal(duplicate.structuredContent?.operation?.status, "rejected");

console.log(JSON.stringify({
  tools: tools.tools.map((tool) => tool.name),
  renderTool: renderTools[0].name,
  renderResource: renderTools[0]._meta.ui.resourceUri,
  initialLayout: initialView.presentation.layout,
  retryStatus: duplicate.structuredContent.operation.status,
}));

await client.close();

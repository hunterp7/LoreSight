import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { STORYFRAME_PUBLIC_TOOL_NAMES, STORYFRAME_TOOL_CATALOG } from "../server/dist/tool-catalog.js";

const submission = JSON.parse(await readFile(new URL("../chatgpt-app-submission.json", import.meta.url), "utf8"));

function collectStrings(value, path = "$", entries = []) {
  if (typeof value === "string") {
    entries.push({ path, value });
    return entries;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, entries));
    return entries;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectStrings(child, `${path}.${key}`, entries);
    }
  }
  return entries;
}

const publicDescriptorStrings = collectStrings({
  app_info: submission.app_info,
  tools: submission.tools,
});

for (const { pattern, label } of [
  { pattern: /\/admin(?:\/|$)/i, label: "/admin" },
  { pattern: /\b(?:subjectId|ownerId|scopes|actorId|actorContext)\b/i, label: "private actor fields" },
  { pattern: /\bhidden canon\b/i, label: "hidden canon" },
  { pattern: /\braw filesystem data\b/i, label: "raw filesystem data" },
]) {
  const leak = publicDescriptorStrings.find(({ value }) => pattern.test(value));
  assert.equal(leak, undefined, `Public descriptors and metadata must not expose ${label}${leak ? ` (${leak.path})` : ""}.`);
}

assert.equal(submission.schema_version, 1);
assert.ok(submission.app_info.subtitle.length <= 30, "Submission subtitle must be 30 characters or fewer.");
assert.equal(submission.test_cases.length, 5, "Submission requires exactly five positive test cases.");
assert.equal(submission.negative_test_cases.length, 3, "Submission requires exactly three negative test cases.");

const catalogNames = [...STORYFRAME_PUBLIC_TOOL_NAMES].sort();
const submissionNames = Object.keys(submission.tools).sort();
assert.deepEqual(submissionNames, catalogNames, "Submission tool names must match the server tool catalog.");

for (const name of catalogNames) {
  const expected = STORYFRAME_TOOL_CATALOG[name].annotations;
  const actual = submission.tools[name].annotations;
  assert.equal(actual.readOnlyHint, expected.readOnlyHint, `${name} readOnlyHint mismatch.`);
  assert.equal(actual.openWorldHint, expected.openWorldHint, `${name} openWorldHint mismatch.`);
  assert.equal(actual.destructiveHint, expected.destructiveHint, `${name} destructiveHint mismatch.`);
}

for (const testCase of submission.test_cases) {
  assert.ok(submission.tools[testCase.tools_triggered], `Unknown positive test tool: ${testCase.tools_triggered}.`);
}
for (const testCase of submission.negative_test_cases) {
  assert.equal(testCase.tools_triggered, null, "Negative tests must not trigger Storyframe tools.");
}

const live = process.argv.includes("--live");
if (!live) {
  console.log(JSON.stringify({
    ok: true,
    mode: "static",
    tools: catalogNames.length,
    positiveTests: submission.test_cases.length,
    negativeTests: submission.negative_test_cases.length,
  }));
  process.exit(0);
}

const endpoint = new URL(process.env.STORYFRAME_MCP_URL ?? "http://localhost:8787/mcp");
const client = new Client({ name: "storyframe-submission-validator", version: "0.1.0" });
const transport = new StreamableHTTPClientTransport(endpoint);

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const descriptorNames = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(submissionNames, descriptorNames, "Submission tool names must match the live MCP server.");

  for (const tool of listed.tools) {
    assert.ok(tool.outputSchema, `${tool.name} must declare outputSchema.`);
    const expected = submission.tools[tool.name].annotations;
    assert.equal(tool.annotations?.readOnlyHint, expected.readOnlyHint, `${tool.name} readOnlyHint mismatch.`);
    assert.equal(tool.annotations?.openWorldHint, expected.openWorldHint, `${tool.name} openWorldHint mismatch.`);
    assert.equal(tool.annotations?.destructiveHint, expected.destructiveHint, `${tool.name} destructiveHint mismatch.`);
  }

  console.log(JSON.stringify({
    ok: true,
    mode: "live",
    tools: descriptorNames.length,
    positiveTests: submission.test_cases.length,
    negativeTests: submission.negative_test_cases.length,
    outputSchemas: "complete",
  }));
} finally {
  await client.close();
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [server, admin, main, widget] = await Promise.all([
  readFile(new URL("../server/src/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../server/src/admin.ts", import.meta.url), "utf8"),
  readFile(new URL("../web/src/main.tsx", import.meta.url), "utf8"),
  readFile(new URL("../web/dist/loresight-widget.html", import.meta.url), "utf8"),
]);

test("public launch routes are explicit and separate from admin", () => {
  assert.match(server, /url\.pathname === "\/widget"/);
  assert.match(server, /\["\/desk", "\/demo"\]\.includes\(url\.pathname\)/);
  assert.match(server, /const MCP_PATH = "\/mcp"/);
  assert.doesNotMatch(server, /url\.pathname === "\/admin"/);
});

test("desk is a browser-only presentation over the shared player", () => {
  assert.match(main, /const page = window\.location\.pathname;/);
  assert.match(main, /const isDeskScene = page === "\/desk"/);
  assert.match(main, /const isDemo = page === "\/demo"/);
  assert.match(main, /<StoryframePlayer \/>/);
  assert.match(main, /retro-desk\.png/);
});

test("production admin access fails closed without an explicit credential", () => {
  assert.match(admin, /NODE_ENV === "production"/);
  assert.match(admin, /adminCredentialConfigured/);
  assert.match(admin, /res\.end\("Not found"\)/);
});

test("the widget bundle does not carry admin implementation or credentials", () => {
  assert.doesNotMatch(widget, /STORYFRAME_ADMIN_(?:TOKEN|PASSWORD)/);
  assert.doesNotMatch(widget, /admin\/api/);
});

test("creator proposal tools stay off the public launch surface by default", () => {
  assert.match(server, /STORYFRAME_CREATOR_TOOLS_ENABLED/);
  assert.match(server, /if \(creatorToolsEnabled\)/);
});

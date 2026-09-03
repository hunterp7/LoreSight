import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (file) => readFile(resolve(root, file), "utf8");
const widget = await read("web/dist/loresight-widget.html");
const main = await read("web/src/main.tsx");
const server = await read("server/src/index.ts");
const admin = await read("server/src/admin.ts");

assert.match(widget, /LoreSight|loresight/i, "widget bundle must contain LoreSight UI text");
assert.match(main, /const isDeskScene = page === ["']\/desk["']/, "desk route must use browser-only rendering");
assert.match(main, /const isDemo = page === ["']\/demo["']/, "demo route must render the focused CRT page");
assert.match(main, /retro-desk\.(png|webp|jpg)/, "desk scene must include its local background asset");
assert.match(server, /url\.pathname === ["']\/widget["']/, "server must expose the ChatGPT widget route");
assert.match(server, /["']\/desk["'], ["']\/demo["']/, "server must expose the standalone desk and demo routes");
assert.match(server, /const MCP_PATH = ["']\/mcp["']/, "server must expose the MCP endpoint");
assert.match(server, /const WIDGET_VERSION =/, "widget resource must be versioned for hosted rollouts");
assert.match(server, /url\.pathname === ["']\/ready["']/, "server must expose readiness for deployment orchestration");
assert.match(admin, /process\.env\.NODE_ENV === ["']production["']/, "admin must have a production boundary");
assert.match(admin, /Not found/, "admin must fail closed when no credential is configured");
assert.doesNotMatch(widget, /STORYFRAME_ADMIN_(?:TOKEN|PASSWORD)/, "widget must not contain admin credentials");

console.log(JSON.stringify({
  ok: true,
  widget: "self-contained",
  publicRoutes: ["/widget", "/desk", "/demo"],
  serviceRoutes: ["/mcp", "/health", "/ready"],
  admin: "production-private",
}));

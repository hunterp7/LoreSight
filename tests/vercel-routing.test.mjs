import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

test("Vercel entrypoint preserves public routes and keeps MCP authenticated", async () => {
  process.env.VERCEL = "1";
  process.env.OPENAI_API_KEY = "test-unused";
  process.env.STORYFRAME_ADMIN_TOKEN = "test-unused";
  process.env.STORYFRAME_OAUTH_ISSUER = "https://identity.example.com";
  process.env.STORYFRAME_OAUTH_RESOURCE = "https://storyframe.example.com";
  process.env.STORYFRAME_OAUTH_JWKS_URI = "https://identity.example.com/.well-known/jwks.json";
  const compiled = await build({
    entryPoints: ["api/mcp.ts"], bundle: true, platform: "node", format: "esm", write: false,
    plugins: [{ name: "built-server", setup(builder) {
      builder.onResolve({ filter: /server\/src\/index\.js$/ }, () => ({
        path: pathToFileURL(resolve("server/dist/index.js")).href, external: true,
      }));
    } }],
  });
  const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
  const server = createServer(handler);
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const route of ["/health", "/health?probe=1", "/api/health", "/ready", "/api/ready"]) {
      const response = await fetch(origin + route);
      assert.equal(response.status, 200, route);
      const body = await response.json();
      assert.equal(body.ok ?? body.ready, true, route);
    }
    const metadata = await fetch(origin + "/.well-known/oauth-protected-resource");
    assert.equal(metadata.status, 200);
    assert.equal((await metadata.json()).resource, "https://storyframe.example.com");
    for (const route of ["/mcp", "/api/mcp?probe=1"]) {
      const response = await fetch(origin + route);
      assert.equal(response.status, 401, route);
      assert.match(response.headers.get("www-authenticate"), /resource_metadata=/);
    }
    assert.equal((await fetch(origin + "/missing-route")).status, 404);
  } finally {
    await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
  }
});

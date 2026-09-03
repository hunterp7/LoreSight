import { createServer } from "node:http";

// Deliberately expose only the ChatGPT app surface when using an ephemeral
// tunnel. Admin, theme APIs, and narration preview routes never leave localhost.
const listenPort = Number(process.env.CHATGPT_PROXY_PORT ?? 8890);
const upstreamPort = Number(process.env.STORYFRAME_PORT ?? 8787);
const allowed = new Set(["/", "/health", "/mcp", "/widget"]);

const proxy = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (!allowed.has(url.pathname)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const headers = { ...req.headers, host: `127.0.0.1:${upstreamPort}` };
  const upstream = fetch(`http://127.0.0.1:${upstreamPort}${url.pathname}${url.search}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
    // Node's fetch requires streaming request bodies to opt in explicitly.
    duplex: req.method === "GET" || req.method === "HEAD" ? undefined : "half",
  });
  upstream.then(async (response) => {
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      for await (const chunk of response.body) res.write(chunk);
    }
    res.end();
  }).catch(() => {
    if (!res.headersSent) res.writeHead(502);
    res.end("Upstream unavailable");
  });
});

proxy.listen(listenPort, "127.0.0.1", () => {
  console.log(`ChatGPT-safe proxy listening on http://127.0.0.1:${listenPort}`);
  console.log(`Allowed paths: ${[...allowed].join(", ")}`);
});

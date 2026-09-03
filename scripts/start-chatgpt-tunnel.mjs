import { spawn } from "node:child_process";

const port = process.env.LORESIGHT_PROXY_PORT || "8890";
const child = spawn("cloudflared", ["tunnel", "--url", `http://127.0.0.1:${port}`], {
  stdio: ["ignore", "pipe", "pipe"],
});

let published = false;
let buffer = "";

function inspect(chunk) {
  const text = String(chunk);
  process.stdout.write(text);
  buffer += text;
  const match = buffer.match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/i);
  if (match && !published) {
    published = true;
    const mcpUrl = `${match[0].replace(/\/+$/, "")}/mcp`;
    console.log(`\nLoreSight MCP URL:\n${mcpUrl}\n`);
    console.log("Keep this terminal open while testing in ChatGPT.");
  }
  buffer = buffer.slice(-4_000);
}

child.stdout.on("data", inspect);
child.stderr.on("data", inspect);
child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error("cloudflared was not found. Install it with: brew install cloudflared");
  } else {
    console.error(`Unable to start cloudflared: ${error.message}`);
  }
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (code && code !== 0) process.exitCode = code;
  if (signal) console.log(`Cloudflare tunnel stopped (${signal}).`);
});

process.on("SIGINT", () => child.kill("SIGINT"));

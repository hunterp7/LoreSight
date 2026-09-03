const input = process.argv[2]?.trim();

if (!input) {
  console.error("Usage: node scripts/generate-mcp-url.mjs https://your-tunnel.example.com");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(input);
} catch {
  console.error("Enter a complete HTTPS tunnel URL, such as https://your-name.trycloudflare.com");
  process.exit(1);
}

if (parsed.protocol !== "https:") {
  console.error("ChatGPT connections require an HTTPS URL.");
  process.exit(1);
}

parsed.pathname = parsed.pathname.replace(/\/+$/, "").replace(/\/mcp$/i, "") + "/mcp";
parsed.search = "";
parsed.hash = "";
console.log(parsed.toString());

# Connecting LoreSight to ChatGPT

LoreSight exposes its ChatGPT app through the streamable MCP endpoint `/mcp`.
The local server and safe proxy run on ports `8787` and `8890`; an HTTPS tunnel
must forward to port `8890` before ChatGPT can connect.

For production OAuth, the canonical MCP origin is the HTTPS resource URL from
`STORYFRAME_OAUTH_RESOURCE`, and the server publishes
`/.well-known/oauth-protected-resource` from that origin automatically.

## Generate the URL

The easiest option is to let the helper start Cloudflare and detect the URL:

```bash
node scripts/start-chatgpt-tunnel.mjs
```

It forwards the LoreSight proxy on port `8890`, prints the temporary HTTPS
hostname, and prints the complete `/mcp` URL. Keep that terminal open while
testing. Install Cloudflare first if needed:

```bash
brew install cloudflared
```

From the repository root:

```bash
node scripts/generate-mcp-url.mjs https://your-tunnel.trycloudflare.com
```

The command prints the canonical URL:

```text
https://your-tunnel.trycloudflare.com/mcp
```

The Admin **Connect** page provides the same normalization and a copy button.
It stores only the tunnel address in browser local storage; no credentials are
stored.

## Add it in ChatGPT

In ChatGPT Web, enable **Settings → Security and login → Developer mode**, then
open [ChatGPT Plugins](https://chatgpt.com/plugins), choose **＋**, and add the
HTTPS `/mcp` URL. Refresh the connection after restarting the server or
changing tool metadata. Start a new chat, enable LoreSight from the tools
menu, and say `Launch LoreSight`.

If OAuth is enabled, confirm the connection points at the production MCP origin,
not the `/mcp` path, and that the identity provider exposes the matching JWKS
and discovery metadata.

Keep the tunnel process running while testing. Cloudflare quick-tunnel URLs are
temporary; generate a new URL when the tunnel restarts.

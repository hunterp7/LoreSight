# LoreSight Public Launch Quickstart

Status: recommended development and deployment path  
Verified: August 15, 2026  
Primary app archetype: **submission-ready** (stateful React MCP app)

This is the shortest practical path from the current repository to a public
LoreSight listing in the universal directory shared by ChatGPT and Codex.

## Recommended stack

- **Source and automatic releases:** GitHub
- **Production MCP host:** one always-on Render Node Web Service
- **Durable state:** Render Postgres, connected through the existing persistence
  package once its production adapter is bound
- **Public origin:** a dedicated custom hostname such as
  `https://mcp.loresight.app`
- **Local ChatGPT testing:** the repository's safe proxy plus Cloudflare Quick
  Tunnel; no ngrok or pnpm is required
- **Submission:** OpenAI Platform plugin submission portal

Render is the simplest match for the current server because it can build a
Node repository from GitHub, provides a stable HTTPS origin, supports health
checks and automatic deployments, and can provision Postgres in the same
environment. Use an always-on production instance; a service that sleeps after
inactivity is not appropriate for review or public use.

## One-time local setup

Install Node 20 or newer and Cloudflare's tunnel client:

```bash
brew install node@20 cloudflared
cd /Users/Hunter/Documents/Codex/StoryFrame
npm install
```

Use npm consistently for this repository. Before production, keep one
authoritative lockfile and remove the competing package-manager lock only after
the selected npm dependency graph has been reviewed and committed.

## Daily local development

Open three terminals in the repository.

Terminal 1 — build and run LoreSight:

```bash
npm run dev
```

Terminal 2 — expose only the safe ChatGPT routes:

```bash
npm run chatgpt:proxy
```

Terminal 3 — create an HTTPS tunnel and print the complete MCP URL:

```bash
npm run chatgpt:tunnel
```

Paste the printed URL ending in `/mcp` into a developer-mode ChatGPT app.
After tool descriptors or widget metadata change, restart LoreSight and use
**Refresh** on the app connection before testing in a new conversation.

Run the complete local gate before pushing a release candidate:

```bash
npm run check
npm run build
npm test
npm run smoke
npm run check:submission
npm run check:submission:live
```

### Real local command dashboard

Open `/admin?view=launch` and sign in with the existing LoreSight admin password. This page can run a fixed allowlist of local verification commands and show their output live: code checks, tests, builds, MCP smoke tests, submission checks, or the complete release checklist.

The dashboard does not accept terminal text or user-provided command arguments. Only one operation can run at a time, output is capped, and each step has a five-minute timeout. In production, command execution stays disabled unless the operator explicitly sets `STORYFRAME_DEVOPS_ENABLED=true`.

Restart and public deployment are intentionally not executed from the app server. Restarting could turn off the dashboard that issued the command, while deployment requires a named provider, project ownership, credentials, and an explicit confirmation design.

## First production deployment

1. Push the reviewed repository to GitHub.
2. In Render, create a **Node Web Service** connected to the production branch.
3. Use `npm ci && npm run build` as the build command.
4. Use `npm start` as the start command.
5. Set the health-check path to `/ready`.
6. Let Render provide `PORT`; the server already binds it on `0.0.0.0`.
7. Store all secrets in Render environment settings, never in source control.
8. Add an always-on instance and a custom domain such as
   `mcp.loresight.app`.
9. Verify `https://mcp.loresight.app/health`, `/ready`, and `/mcp`.
10. Connect the production `/mcp` URL in ChatGPT developer mode and run the
    positive and negative submission tests.

For the first anonymous public-player release, OAuth is not inherently
required if LoreSight exposes only public catalog data and private ephemeral
player actions. Add OAuth before offering accounts, cloud saves, private
libraries, creator projects, or any user-owned server data. Durable sessions
still require the production persistence adapter before the app can be called
reliable across restarts and multiple instances.

## Required source work before submission

- Serve the exact OpenAI domain-verification token at
  `/.well-known/openai-apps-challenge` when configured.
- Set `_meta.ui.domain` to the final dedicated widget/application origin.
- Keep `_meta.ui.csp` limited to the exact production connect and resource
  domains.
- Bind the existing Postgres repository to the player session path, run
  migrations, and verify restart and multi-instance behavior.
- Disable or separately protect the private admin surface in production.
- Choose npm as the single frozen dependency graph and make CI use `npm ci`.
- Remove any remaining obsolete product-language references from public copy,
  reviewer prompts, screenshots, and logs.
- Publish public website, privacy policy, terms, support, and data-deletion
  instructions that match the verified publisher identity.
- Capture final screenshots from the hosted ChatGPT experience.

## OpenAI submission sequence

1. In the OpenAI Platform organization that will own LoreSight, complete
   individual or business verification.
2. Confirm the submitter has **Apps Management: Write** permission.
3. Open the Platform plugin submission portal and create an MCP-backed draft.
4. Choose a **Universal** MCP URL and enter the production URL ending in
   `/mcp`.
5. Complete domain verification using the exact challenge token supplied by
   the portal.
6. Select **Scan Tools** and review all discovered tools, schemas, annotations,
   output schemas, CSP domains, and UI metadata.
7. Import `chatgpt-app-submission.json`; it already contains five positive and
   three negative tests.
8. Add the final listing copy, logo, hosted screenshots, starter prompts,
   support URL, privacy policy, terms, country availability, and release notes.
9. Test the reviewer path on the production origin. If authentication is later
   enabled, provide a fully functional review account that does not require
   MFA, email confirmation, SMS, or private-network access.
10. Obtain product-owner approval, submit for review, respond to findings, and
    publish only after approval.

## Current repository evidence

As of the verification date, the repository exposes 11 tools. Static and live
submission validation pass, every tool declares all three safety hints and an
output schema, and the import artifact contains exactly five positive and three
negative test cases. The public-hosting, persistence, domain, policy, identity,
and final hosted QA gates remain.

## Current official references

- [Build and deploy the MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [Connect and test in ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Submit plugins](https://developers.openai.com/plugins/deploy/submission)
- [Plugin guidelines](https://developers.openai.com/plugins/app-guidelines)
- [Render Node deployment](https://render.com/docs/deploy-node-express-app)
- [Render health checks](https://render.com/docs/health-checks)
- [Render web services](https://render.com/docs/web-services)

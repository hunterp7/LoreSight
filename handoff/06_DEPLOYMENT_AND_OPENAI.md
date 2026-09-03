# Deployment and OpenAI Integration

Verified against official OpenAI documentation on August 3, 2026. Re-check again immediately before submission.

## Primary plugin architecture

Use an MCP server plus optional MCP Apps UI. The current prototype already follows this pattern with a React widget bundled into a single HTML resource.

Primary references:

- https://developers.openai.com/plugins/build/app-quickstart
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/chatgpt-ui
- https://developers.openai.com/plugins/plan/tools
- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/app-guidelines

## App archetype

Primary archetype: **interactive-decoupled**.

- data and mutation tools return reusable structured state;
- one render tool attaches the UI resource;
- the mounted widget calls action tools through the MCP Apps bridge;
- state snapshots include monotonic versions;
- retries use mutation IDs;
- server state remains authoritative.

## AI Director

Dynamic interpolation requires a provider boundary. The engine must not import an OpenAI SDK.

Recommended production evaluation strategy:

- use the current flagship model tier for compiler/creator tasks where complex narrative reasoning is valuable;
- evaluate the balanced model tier for runtime interpolation and recap generation;
- use deterministic authored fallbacks for availability and cost control;
- select models from measured Storyframe evals rather than reputation alone;
- keep model names configurable and re-check the current model catalog before launch.

Current model guidance: https://developers.openai.com/api/docs/guides/latest-model

Do not add an API key to source control. A server-side Responses API provider should be enabled only after the environment credential gate is configured.

## Persistence

For a deployable application, replace in-memory session state with repository interfaces backed by a production Postgres-compatible database.

Persist:

- users and permissions;
- world drafts and immutable releases;
- source and compiled packages;
- sessions, snapshots, and ordered events;
- character and entity ledger facts;
- generated performance and usage metadata;
- creator approvals and audit history;
- asset metadata;
- migrations.

Do not store entire hidden world packages in model-visible state.

## Hosting requirements

- stable public HTTPS MCP endpoint;
- streaming-compatible request handling;
- region and timeout appropriate for model and database calls;
- production CSP and domain metadata;
- environment-based secrets;
- structured logs and trace IDs;
- request latency, error, token, and generation-cost metrics;
- rate limiting and abuse controls;
- database backups and migration procedure;
- health/readiness endpoints.

Hosting provider is intentionally not selected in this context pack. Choose it during Phase 7 based on runtime behavior, database integration, cost, and deployment ownership.

## Local and Developer Mode testing

1. Run checks, build, and tests.
2. Start the MCP server locally.
3. Verify `/health` and `/mcp` through a client smoke test or MCP Inspector.
4. Expose the server through a temporary HTTPS tunnel.
5. Enable Developer Mode in ChatGPT.
6. Add the tunneled MCP endpoint.
7. Refresh the app after tool or resource metadata changes.
8. Exercise a complete Agency path, retries, recaps, save/resume, mobile layout, and generation fallback.

The provider-neutral production order, readiness/drain behavior, migration job, rollback constraints, and evidence matrix are maintained in `docs/HOSTED_DEPLOYMENT_RUNBOOK.md`.

## Submission boundary

Do not submit automatically. Public release requires explicit owner approval, verified ownership prerequisites, production URLs, privacy and support documentation, app metadata, screenshots, test prompts, and a fresh policy review.

The current import draft is `chatgpt-app-submission.json`; run `npm run check:submission` for the offline catalog gate and `npm run check:submission:live` while the MCP server is available. See `docs/SUBMISSION_READINESS.md` for source-review findings and remaining hosted gates.

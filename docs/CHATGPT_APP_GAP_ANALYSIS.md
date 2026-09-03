# LoreSight ChatGPT App Gap Analysis

Updated: September 1, 2026

## Target

Ship LoreSight as a public ChatGPT app backed by a stable HTTPS MCP server and a React MCP Apps widget. The widget remains the focused CRT player; `/desk` and `/demo` remain browser-only surfaces and are not embedded into ChatGPT.

## Current baseline

The repository is already an **interactive-decoupled React widget** rather than a greenfield app:

- `server/src/index.ts` exposes a Streamable HTTP MCP endpoint at `/mcp`, a versioned UI resource, and the current player/creator tool catalog.
- `web/` builds a self-contained React widget resource through `scripts/build-widget.mjs`.
- `start_story_session` and `open_story_interface` attach the widget resource; mutation tools return structured projections and operation status.
- Tool contracts define explicit read-only, destructive, open-world, and idempotency hints in `server/src/tool-catalog.ts`.
- All currently emitted tools have `outputSchema` declarations and `chatgpt-app-submission.json` is checked offline and live.
- OAuth resource authorization, JWKS verification, rate limiting, readiness, request IDs, feedback redaction, deterministic engine tests, and local smoke tests already exist.
- `/widget`, `/desk`, and `/demo` are served locally; production persistence and hosted identity are not yet bound to the player path.

## Gaps by launch gate

| Priority | Gap | Evidence | Required outcome |
|---|---|---|---|
| P0 | Stable hosted origin | Localhost-only routes and temporary tunnel instructions in `docs/CHATGPT_CONNECTION.md` | HTTPS `/mcp`, `/widget`, `/ready`, and stable widget resource origin with rollback |
| P0 | Production session repository | Server player actions still use the in-memory path in `server/src/loresight-actions.ts` | Postgres-backed sessions, snapshots, events, ownership, and restart-safe idempotency |
| P0 | Real OAuth deployment | `server/src/oauth.ts` supports configuration but hosted issuer, redirect, audience, and scopes are not configured | Authorization-code + PKCE flow, discovery metadata, JWKS rotation, and denied-scope behavior verified against hosted app |
| P0 | ChatGPT hosted verification | `scripts/smoke-mcp.mjs` is local protocol coverage only | Developer Mode test pass against final HTTPS origin with widget rendering, native actions, retries, and resume |
| P0 | Submission freshness | Existing submission JSON is locally validated, but metadata and policy URLs are not hosted launch evidence | Re-run official submission checks, capture hosted screenshots, verify owner/domain/org prerequisites |
| P1 | Descriptor/resource conformance | Current SDK compatibility metadata is present; normative behavior must be confirmed against current OpenAI guidance | Verify top-level security metadata, UI resource MIME/metadata, CSP, cache versioning, and no admin exposure |
| P1 | Widget host resilience | Local tests cover accessibility and player behavior, not all ChatGPT host safe-area/display-mode transitions | Inline/fullscreen/return, composer-safe layout, state preservation, focus recovery, and reduced-motion pass |
| P1 | Local-file boundary | Browser-local loading exists, but hosted test evidence is missing | Prove file bytes never leave the browser and invalid `.z3/.z5/.z8/.zblorb` files fail safely |
| P1 | AI/audio production controls | Providers and fallbacks exist but hosted keys, budgets, retention, and eval evidence are not complete | Server-only key storage, bounded cost/latency, authored fallback, redaction, and disclosure |
| P1 | Operational readiness | Request logs/readiness/rate limits exist; production dashboards, alerts, backup restore, and incident drills remain | Observable, recoverable service with documented rollback and deletion/export operations |
| P2 | Public product polish | Browser `/desk` and `/demo` are implemented but are not part of the ChatGPT submission surface | Keep public browser route separate, accurate, and free of private/admin data |

## Scope decision

The first submission should include the player tools only: session start, library, local-file/sample loading, theme, state/recap, command submission, interface rendering, feedback, and optional narration. Creator proposal generation and admin operations remain private until they have separate authorization, privacy copy, and review evidence.

## Official guidance used

- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [Add UI to an MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Submit plugins](https://developers.openai.com/plugins/deploy/submission)
- [Plugin guidelines](https://developers.openai.com/plugins/app-guidelines)

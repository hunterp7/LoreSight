# LoreSight ChatGPT App Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move LoreSight from a locally validated interactive-decoupled MCP widget to a hosted, authenticated, review-ready ChatGPT app without exposing admin or creator-only capabilities.

**Architecture:** Keep `server/` as the MCP and authorization boundary and `web/` as the self-contained React MCP Apps resource. Preserve server-authoritative engine state, structured player projections, versioned widget URIs, and browser-local Z-machine file loading. Bind the existing repository interfaces to managed Postgres and place the service behind stable HTTPS with OAuth/OIDC, narrow CSP metadata, observability, and rollback.

**Tech Stack:** Node 20+, TypeScript, `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, React 19, Three.js/Retro React player UI, `@storyframe/*` engine packages, Postgres, OAuth/OIDC + JWKS, HTTPS deployment, Node test runner.

**Spec:** `docs/CHATGPT_APP_GAP_ANALYSIS.md`, `docs/SUBMISSION_READINESS.md`, and `docs/LORESIGHT_LAUNCH_RUNBOOK.md`.

## Global Constraints

- The engine contains no story-specific characters, setting, dialogue, IDs, or rules.
- Published world versions are immutable.
- Hidden facts must be removed before model or player projection.
- Simulation state is server-authoritative, serializable, deterministic, and independent of React or MCP.
- Repeated mutation IDs must not apply a turn twice.
- AI generation failure must not make a world unplayable; use authored fallbacks.
- The public ChatGPT scope excludes admin routes, private diagnostics, hidden canon, source maps, and creator authoring data.
- The widget must use the MCP Apps bridge first and `window.openai` only for documented host extensions.
- Production secrets must never be committed or placed in widget payloads.

---

### Task 1: Freeze the public app contract

**Files:**
- Modify: `server/src/index.ts`
- Modify: `server/src/tool-catalog.ts`
- Modify: `chatgpt-app-submission.json`
- Modify: `scripts/validate-submission.mjs`
- Test: `tests/launch-surface.test.mjs`, `tests/server-oauth.test.mjs`

**Interfaces:**
- Produces the approved player tool list, annotations, output schemas, widget URI policy, and visibility rules used by later hosted tasks.

- [ ] Inventory every current tool from `server/src/index.ts` and `server/src/tool-catalog.ts`; classify each as player, creator, or private.
- [ ] Keep only the approved player tools model-visible for the first submission; keep creator/admin operations authenticated and out of widget output.
- [ ] Verify every public tool has explicit `readOnlyHint`, `openWorldHint`, `destructiveHint`, and `outputSchema` values matching implementation behavior.
- [ ] Add a static assertion that no public descriptor exposes `/admin`, private actor fields, hidden canon, or raw filesystem data.
- [ ] Regenerate `chatgpt-app-submission.json` with exactly five positive and three negative cases after the final tool list is frozen.
- [ ] Run `npm run check:submission` and `npm run check:launch`; expected result: both pass with the frozen public catalog.

### Task 2: Reconcile the MCP Apps resource with current OpenAI guidance

**Files:**
- Modify: `server/src/index.ts`
- Modify: `server/src/oauth.ts`
- Modify: `scripts/build-widget.mjs`
- Test: `tests/launch-surface.test.mjs`, `tests/server-oauth.test.mjs`

**Interfaces:**
- Consumes the frozen tool contract from Task 1.
- Produces a versioned `ui://widget/...` resource with correct MIME type, `openai/widgetDescription`, CSP, optional domain metadata, and OAuth metadata.

- [ ] Confirm the registered resource uses `RESOURCE_MIME_TYPE` and returns the built HTML without server-relative asset dependencies.
- [ ] Set exact `connectDomains` and `resourceDomains` for the hosted widget; reject wildcard domains.
- [ ] Keep `LORESIGHT_WIDGET_VERSION` as the cache-busting release control and document the increment rule.
- [ ] Verify `securitySchemes` appear where current OpenAI guidance requires them, while preserving any compatibility alias only when needed.
- [ ] Add tests asserting `/widget` contains no admin secrets and the resource URI changes when the widget version changes.
- [ ] Run `npm run check`, `npm run build:web`, and the targeted launch/OAuth tests; expected result: pass.

### Task 3: Bind durable production persistence

**Files:**
- Modify: `server/src/loresight-actions.ts`
- Modify: `server/src/index.ts`
- Modify: `packages/persistence/*`
- Modify: `packages/application/*`
- Create: `scripts/migrate-production.mjs`
- Test: `tests/persistence.test.mjs`, `tests/application-service.test.mjs`, `tests/migrations.test.mjs`

**Interfaces:**
- Consumes the existing application repository contracts.
- Produces restart-safe session creation, command commits, snapshots, event replay, owner isolation, and mutation-id idempotency.

- [ ] Identify every in-memory player read/write in `server/src/loresight-actions.ts` and route it through the application service repository interface.
- [ ] Implement the Postgres adapter for users, sessions, snapshots, events, mutation receipts, world releases, and feedback records.
- [ ] Make command submission one transaction: owner check, expected-version check, mutation receipt lookup, event append, snapshot update, and version increment.
- [ ] Write failing tests for restart recovery, duplicate mutation IDs, stale versions, concurrent owners, and hidden-canon projections.
- [ ] Implement migrations and a one-shot migration script that exits nonzero on failure.
- [ ] Run persistence, application, migration, replay, and projection tests; expected result: pass against a disposable Postgres database.

### Task 4: Complete OAuth/OIDC deployment configuration

**Files:**
- Modify: `server/src/oauth.ts`
- Modify: `server/src/index.ts`
- Modify: `.env.example`
- Modify: `docs/CHATGPT_CONNECTION.md`
- Test: `tests/auth.test.mjs`, `tests/server-oauth.test.mjs`

**Interfaces:**
- Consumes actor scopes from verified access tokens.
- Produces protected-resource metadata, issuer/audience/JWKS validation, scope enforcement, and safe auth errors.

- [ ] Choose the production issuer and register the exact HTTPS redirect/resource URLs with the identity provider.
- [ ] Configure issuer, resource audience, JWKS URI, supported scopes, clock skew, and key-rotation behavior through the secret manager.
- [ ] Test authorization-code + PKCE, missing scope, expired token, wrong issuer, wrong audience, unknown key, and JWKS rotation cases.
- [ ] Confirm `/.well-known/oauth-protected-resource` contains only production-safe metadata.
- [ ] Update connection instructions to use current ChatGPT app wording and the final HTTPS `/mcp` URL.
- [ ] Run auth and server tests; expected result: pass without tokens in logs or fixtures.

### Task 5: Harden the widget for ChatGPT host behavior

**Files:**
- Modify: `web/src/main.tsx`
- Modify: `web/src/classic-if.tsx`
- Modify: `web/src/types.ts`
- Modify: `web/src/global.d.ts`
- Test: `tests/player-accessibility.test.mjs`, `tests/player-view-adapter.test.mjs`

**Interfaces:**
- Consumes structured player views and MCP Apps bridge notifications.
- Produces stable inline/fullscreen rendering, native host actions, keyboard play, local file loading, theme persistence, focus recovery, and safe-area handling.

- [ ] Verify the mounted widget listens for tool-result notifications and updates the existing player without unnecessary remounts.
- [ ] Test inline → fullscreen → inline while preserving session ID, state version, transcript, theme, and pending prompt.
- [ ] Keep local Z-machine bytes in browser memory; add a test that no file payload is sent to `/mcp` or `/api`.
- [ ] Verify focus returns to the active command field after each committed turn and after overlays close.
- [ ] Verify reduced-motion behavior, 200% zoom, touch controls, and safe-area padding in the host surface.
- [ ] Run accessibility/player tests and inspect the built widget in a clean browser context; expected result: no clipped controls or console errors.

### Task 6: Add hosted end-to-end and negative test evidence

**Files:**
- Modify: `scripts/smoke-mcp.mjs`
- Modify: `scripts/validate-submission.mjs`
- Create: `tests/hosted-chatgpt-checklist.md`
- Test: `tests/launch-surface.test.mjs`, hosted Developer Mode run

**Interfaces:**
- Consumes the final HTTPS endpoint and app connector.
- Produces reproducible evidence for reviewer prompts and release approval.

- [ ] Run local `npm run check`, `npm run build`, `npm test`, `npm run smoke`, and both submission validators.
- [ ] Run hosted protocol checks against `/mcp`, `/ready`, resource fetch, tool listing, output schemas, and OAuth challenge behavior.
- [ ] In ChatGPT Developer Mode, test start, library, sample, local file, theme, command, retry, stale state, narration fallback, fullscreen, refresh, and resume.
- [ ] Run negative prompts for weather, unrelated coding, admin operations, hidden canon, and unsupported publishing; expected result: LoreSight is not invoked or refuses safely.
- [ ] Capture sanitized evidence: endpoint, build version, test date, browser/device, result, and issue ID; never include tokens, file contents, or private story data.

### Task 7: Production operations, privacy, and recovery

**Files:**
- Modify: `docs/HOSTED_DEPLOYMENT_RUNBOOK.md`
- Modify: `docs/PRIVACY_AND_DATA_LIFECYCLE.md`
- Modify: `docs/SUBMISSION_READINESS.md`
- Modify: `.env.example`
- Test: `tests/observability.test.mjs`, `tests/service-lifecycle.test.mjs`

**Interfaces:**
- Consumes hosted deployment and persistence from Tasks 3–4.
- Produces health/readiness checks, redacted structured logs, metrics, alerts, backups, restore proof, deletion/export paths, and rollback instructions.

- [ ] Deploy `/mcp`, `/widget`, `/desk`, `/demo`, `/health`, and `/ready`; return 404 for `/admin` unless private access is explicitly configured.
- [ ] Configure secret-manager values for OpenAI, OAuth, database, telemetry, and admin access; verify startup fails closed when required production values are absent.
- [ ] Add request IDs, latency/error/tool metrics, rate-limit metrics, generation fallback counters, and redaction tests.
- [ ] Run a migration backup/restore drill and a canary rollback using the prior widget URI version.
- [ ] Publish privacy, terms, support, deletion/export, narration, and diagnostics disclosures at stable HTTPS URLs.
- [ ] Run lifecycle/observability tests and record the restore/rollback evidence.

### Task 8: Submission and release approval

**Files:**
- Modify: `chatgpt-app-submission.json`
- Modify: `docs/SUBMISSION_READINESS.md`
- Create: `docs/release-evidence/README.md`

**Interfaces:**
- Consumes all hosted gates and evidence from Tasks 1–7.
- Produces a review-ready submission package; publishing remains a human-approved action.

- [ ] Re-check current official OpenAI MCP Apps, authentication, UI, submission, and guideline pages immediately before upload.
- [ ] Capture final screenshots from the hosted build, not localhost.
- [ ] Verify organization ownership, domain verification, app-management permission, privacy/support URLs, and reviewer prompts.
- [ ] Run the complete release command set:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm run check:launch
pnpm run check:submission
pnpm run check:submission:live
pnpm test
pnpm run smoke
```

- [ ] Obtain explicit owner approval for the listing, policies, screenshots, reviewer credentials, and submission click.
- [ ] Submit only after every P0/P1 gap is closed or explicitly accepted in the release record.

## Self-review

- Product scope, tool visibility, resource metadata, OAuth, persistence, widget host behavior, local-file privacy, testing, operations, and submission are each covered by a task.
- No task relies on placeholders such as “TBD” or “add appropriate handling.”
- Existing project invariants remain global constraints.
- The plan does not authorize public publishing automatically; owner approval remains the final gate.

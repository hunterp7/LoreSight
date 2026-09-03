# Hosted Deployment Runbook

Status: provider-neutral runbook ready; hosting, database, identity, domains, and external publication not selected or authorized  
Updated: August 3, 2026  
Audience: deployment owner, backend developer, security reviewer, QA, support, and submission operator

## Deployment shape

Deploy one Node 20+ MCP service behind a stable HTTPS origin. The service serves:

- `POST/GET/DELETE /mcp` — Streamable HTTP MCP;
- `GET /.well-known/oauth-protected-resource` — OAuth resource metadata when configured;
- `GET /health` — process liveness;
- `GET /ready` — readiness (`503` while starting/stopping, `200` when accepting work);
- `/admin` and `/admin/api/*` — private-alpha operations only when separately protected;
- `/widget` and local `/narration` — development preview helpers, not the production ChatGPT data path.

The service uses bounded HTTP/header/keep-alive timeouts and drains on `SIGTERM`/`SIGINT` for up to ten seconds. The platform must stop routing new traffic when `/ready` fails and allow the drain window before force termination.

## Required external decisions

The owner must select:

1. a container or Node hosting provider that supports streaming request bodies/responses and graceful draining;
2. managed Postgres with TLS, point-in-time recovery, connection pooling, and private networking;
3. an established OAuth/OIDC provider supporting authorization code + PKCE, resource audiences, discovery, and the ChatGPT client-registration path;
4. a dedicated HTTPS MCP domain and a dedicated widget domain accepted by current ChatGPT requirements;
5. secret manager, log/metric collector, distributed rate limiter, alert destination, support address, and on-call owner.

Do not infer these accounts or create paid infrastructure without explicit deployment authority.

## Build artifact

Use the committed dependency lock selected for CI, then run:

```bash
npm run check
npm run build
npm test
npm run check:submission
```

The repository currently contains both an older npm lock and the authoritative pnpm lock from recent dependency work. Resolve that mismatch before declaring frozen-install reproducibility; do not ship a build from two competing dependency graphs.

The runtime artifact needs:

- `server/dist`;
- `web/dist/agency-widget.html`;
- `admin/dist` only if private admin is intentionally included;
- compiled package `dist` directories and workspace runtime dependencies;
- `packages/persistence/migrations` for the one-shot migration job;
- no `.env.local`, admin JSON data, screenshots, source drafts, or API keys.

## Environment contract

Start from `.env.example`, but inject real values through the platform secret manager.

| Variable | Required | Purpose |
|---|---:|---|
| `PORT` | platform-specific | HTTP listener |
| `OPENAI_API_KEY` | only after confirmed provider workflow | opt-in narration and disabled-by-default Director adapters |
| `STORYFRAME_DIRECTOR_ENABLED` | production Director only | explicit `true` after live eval approval; otherwise false/omitted |
| `STORYFRAME_DIRECTOR_MODEL` | production Director only | evaluated model ID; current local default is `gpt-5.6-sol` |
| `STORYFRAME_OAUTH_ISSUER` | production player | exact trusted issuer |
| `STORYFRAME_OAUTH_RESOURCE` | production player | canonical HTTPS MCP audience/resource |
| `STORYFRAME_OAUTH_JWKS_URI` | production player | trusted HTTPS signing-key set |
| database URL/credentials | production persistence | to be named by the selected driver adapter |
| `STORYFRAME_ADMIN_TOKEN` | private alpha only | shared admin credential; omit to disable APIs |
| `STORYFRAME_ADMIN_DATA_FILE` | private alpha only | single-process bridge, not multi-instance production |

All three OAuth variables are all-or-none and HTTPS-only. Never expose the OpenAI key or database credentials to the widget, tool arguments, submission artifact, logs, or client environment.

## Release sequence

1. Freeze the intended source revision and dependency lock.
2. Run the local gate and archive sanitized results.
3. Back up the target database and confirm restore ownership.
4. Run a one-shot migration job using `loadStoryframeMigrations` + `runStoryframeMigrations`.
5. Stop if any applied checksum differs; create a new migration rather than editing history.
6. Deploy one canary instance with OAuth and database connectivity.
7. Wait for `/ready`; verify structured `service.ready` and no secret-bearing logs.
8. Run owner A/B isolation, retry, stale-version, recap, hidden-clue, narration-fallback, and complete-ending tests.
9. Run MCP Inspector, then ChatGPT Developer Mode over the final HTTPS origin.
10. Gradually route traffic while watching errors, latency, OAuth denials, conflicts, Director fallback, and database saturation.
11. Re-run `npm run check:submission:live` against the deployed endpoint before any portal upload.

## Rollback

Application rollback and schema rollback are different:

- Roll application code back only to a version compatible with every applied migration.
- Do not automatically reverse immutable migrations or delete the migration ledger.
- If a forward migration is required to repair schema behavior, create it as a new numbered file.
- Keep published world releases immutable; stop selecting a defective release for new sessions rather than mutating it.
- Preserve existing sessions/events and Director performance evidence during incident response.

If owner data deletion occurred after the backup being restored, replay deletion tombstones or the approved equivalent before serving traffic.

## Verification matrix

| Area | Required evidence |
|---|---|
| identity | discovery, PKCE, correct audience, JWKS rotation, revocation, scope downgrade |
| ownership | user B cannot read/mutate/export/delete user A, including guessed opaque IDs |
| concurrency | one of two same-version turns commits; the other receives a safe conflict refresh |
| replay | restart/multi-instance returns the same event-derived state |
| secrecy | unreleased canon/artifacts absent from player, model, widget, logs, and narration input |
| UI | keyboard-only completion, visible focus, reduced motion, 200% zoom, inline/fullscreen/PiP |
| audio | off by default, 50% opt-in start, five local tracks, disclosure, fallback, rate limit |
| operations | request ID correlation, graceful drain, redaction, alert routing, migration checksum stop |
| recovery | database restore drill and post-restore deletion handling |
| submission | seven tools, live output schemas, normative security schemes, final screenshots/policies |

## External stop conditions

Stop and obtain explicit owner direction before creating provider accounts, spending money, changing DNS, uploading reviewer credentials, importing the audit board into Figma, publishing policies, submitting the ChatGPT app, or transferring any local file to an external service.

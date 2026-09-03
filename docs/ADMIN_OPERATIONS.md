# Storyframe Remote Admin and Operations Console

Status: functional private-alpha vertical slice  
Audience: developers, QA leads, world creators, trusted support operators, deployment engineers

## Purpose

The control room exists to answer operational questions with deterministic evidence:

- Are published/test worlds compiling cleanly?
- Which sessions are active, terminal, conflicted, or stuck?
- Why did an intent or reactive rule produce this outcome?
- Did a hidden fact or artifact cross an audience boundary?
- Can an earlier choice be corrected safely without rewriting history?
- Does a proposed Storyframe edit compile before it is saved or published?
- Does a visual clue have a working asset and complete accessible equivalent?

It is not a generic analytics dashboard and it is not a backdoor state editor.

## Surface map

### Overview

- compile readiness for each registered conformance world;
- frame, span, intent, and artifact counts;
- authored-test pass/fail totals;
- bounded frame, intent, and rule coverage plus dead-end count;
- recent legacy and deterministic playtest sessions;
- correction proposal count;
- common incident shortcuts.

### Sessions

- session/world/version/frame/status summary;
- audit findings and source locations;
- currently legal intents for deterministic playtests;
- event timeline and privileged raw state;
- immutable correction proposal form.

Legacy Agency prototype sessions appear here, but the UI labels them non-replayable because they predate the event architecture. The console does not manufacture misleading traces for them.

### Studio

The default Creator Studio slice edits one critical scene in plain language. Authors set the player opening, exact wording, required meaning, optional performance direction, protected claims, and authored fallback while a responsive player preview updates beside it. **What the engine understood** summarizes the contract without IDs. Advanced Storyframe source remains in a disclosure.

**Check this scene** compiles the current source and returns a plain readiness result plus optional technical evidence. **Save draft** stores the private source durably; it does not approve canon, publish a world, or alter a released package.

Coverage executes at most 2,000 distinct mechanical states to depth 16 with seed 42. `complete: false`, any failed test, active dead end, unexpected resolver rejection, or uncovered required content needs investigation. Percentages are a triage summary; operators should inspect the corresponding uncovered ID and path arrays in the compiler result.

### Artifacts

Shows each registered artifact’s presentation mode, asset key, alt text, caption, and complete clue fallback. It is an authoring/accessibility inspection surface, not a media library yet.

### Runbook

Provides first-response guidance for likely narrative and operations failures.

## Local and private remote access

Generate a high-entropy secret using your organization’s secret manager or approved credential tooling. Set it only in the server environment:

```bash
STORYFRAME_ADMIN_PASSWORD="choose-a-private-password" npm start
```

Requirements:

- minimum 24 characters;
- never placed in a URL, source file, screenshot, support ticket, or chat transcript;
- stored only in the browser tab’s `sessionStorage` after login;
- sent as `Authorization: Bearer ...` to same-origin admin APIs;
- rotated immediately if exposed;
- protected by HTTPS for any non-local access.

The server uses constant-time comparison for equal-length credentials. The API is disabled when no token is configured. Under `NODE_ENV=production`, admin API requests are rejected unless the connection is encrypted or the trusted reverse proxy supplies `X-Forwarded-Proto: https`.

## Reverse-proxy deployment

Place the Node service behind a trusted HTTPS reverse proxy or private application gateway. The proxy should:

- terminate TLS using a valid certificate;
- overwrite, not append, `X-Forwarded-Proto`;
- restrict `/admin` and `/admin/api/*` by network identity where possible;
- impose request and authentication-attempt rate limits;
- cap request bodies at or below 512 KB;
- prevent caching of admin HTML/API responses;
- preserve same-origin routing for the UI and API;
- forward the server's `x-request-id` and collect its structured route/status/latency events without logging tokens or full story state.

The current server already sends no-store, nosniff, referrer, frame-ancestor, and restrictive content-security headers for admin assets.

## Authentication maturity

The bearer token is intentionally a private-alpha mechanism. Before multiple operators or public production, replace it with:

- OAuth 2.1/OIDC through an established identity provider;
- MFA for creator/support/admin roles;
- short-lived sessions and revocation;
- scoped roles such as viewer, playtester, creator, support-corrector, publisher, and security auditor;
- world/session ownership authorization on every request;
- durable, append-only operator audit logs;
- two-person approval for publishing and sensitive corrections;
- rate limiting and suspicious-access alerting.

Do not extend the shared token into a homemade multi-user identity system.

## Adjustment policy

### Safe in the current console

- create an isolated conformance playtest;
- submit a currently legal playtest intent with expected state version;
- create, compile, and privately save a Creator Studio draft;
- inspect privileged state and source maps;
- simulate a correction on a new branch;
- record the resulting proposal and state diff.

### Intentionally unavailable

- changing the original event log;
- mutating a published `WorldPack`;
- force-setting arbitrary player flags/resources;
- promoting a correction branch into a player’s canonical save;
- publishing or applying a saved draft as released canon;
- editing legacy prototype sessions that lack deterministic history;
- exposing debug state to ChatGPT or the player widget.

These actions require durable application services, operator identity, authorization, approval, persistence transactions, and rollback/recovery procedures.

## Incident scenarios

### Draft does not compile

1. Run the source in Compiler.
2. Start with the first error.
3. Follow its source range and repair guidance.
4. Compile twice and compare deterministic output.
5. Run canonical paths before approval.

### Draft compiles but tests or coverage fail

1. Open the authored-test failure or the first dead-end/rejection path returned by Compiler.
2. Replay its ordered intent IDs in an isolated playtest.
3. Use the final frame/status and projection-aware assertion message to distinguish mechanics from secrecy failures.
4. If coverage is incomplete, increase a bounded local test budget before changing story content.
5. Add or update a source-owned `TEST` for every repaired defect, compile again, and review uncovered IDs rather than only percentages.

### Player has no legal action

1. Open the exact pinned session/world version.
2. Confirm the session is active.
3. Inspect the `dead-end` audit finding and source-mapped frame.
4. Decide whether the save entered an invalid branch or the world lacks a route.
5. Use a correction proposal for the former; a new world draft/version for the latter.

### A reveal or transition fired unexpectedly

1. Select the responsible event.
2. Inspect its intent and ordered rule traces.
3. Compare condition input state with the source-mapped rule.
4. Check deterministic event divergence.
5. Fix a new world draft if mechanics are wrong.

### Hidden information appeared early

1. Stop release/promotion activity for that world version.
2. Reproduce against player and model projections.
3. Inspect canon and unrevealed-artifact leak findings.
4. Correct projection/compiler flow before resuming tests.
5. Treat exposed production secrets as an incident requiring impact review.

### Visual clue is blank, broken, or inaccessible

1. Confirm `reveal-artifact` committed.
2. Confirm the player projection includes the artifact only after reveal.
3. Validate the asset key, MIME, CSP domain, and responsive dimensions.
4. Read the alt text and full textual clue without looking at the image.
5. If the story cannot proceed from the text alone, repair the artifact contract.

### Tester chose the wrong earlier action

1. Select the exact fork version.
2. Choose a legal replacement intent.
3. Write a reason and expected outcome.
4. Simulate and inspect the state diff.
5. Keep the original unchanged; branch promotion remains a separately authorized future action.

### Stale or repeated request

1. Preserve the first valid commit.
2. Reuse the same mutation ID only when retrying that same deliberate action.
3. Refresh a stale client on version conflict.
4. Never bypass expected-version checks through admin state mutation.

## Private-alpha persistence

The server stores deterministic playtests, correction proposals, and Creator Studio drafts in an atomic JSON snapshot. The default path is:

```text
.storyframe-data/admin.json
```

Override it with an explicit absolute deployment path:

```bash
STORYFRAME_ADMIN_DATA_FILE="/var/lib/storyframe/admin.json" npm start
```

The parent directory is created with owner-only permissions and each save writes a temporary file before atomic rename. On restart, a playtest is restored only when its pinned world ID and version are still registered. Original events remain unchanged; correction proposals are separate records.

Back up the file as application data, never commit it, and do not place it in a publicly served directory. A corrupt or unsupported file fails startup instead of silently discarding evidence.

This is restart-safe single-process persistence for private alpha—not the production repository design. Owner-scoped Postgres repository contracts, schema, row-level security, and a checksummed migration runner now exist, but the admin surface still needs to be bound to a pooled production database. Multiple server instances, concurrent operators, retention, export/deletion, encryption at rest, and disaster recovery remain hosted integration work.

## Verification

```bash
npm run check
npm run build
npm test
STORYFRAME_ADMIN_TOKEN="your-test-token" npm run smoke:admin
```

Visually verify login, desktop/mobile layouts, keyboard navigation, focus visibility, loading/error states, and reduced motion before each hosted release.

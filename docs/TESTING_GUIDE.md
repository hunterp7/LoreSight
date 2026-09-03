# Developer and Tester Guide

Status: compiled application path plus production-boundary hardening  
Audience: contributors, QA, world authors, plugin testers

## Prerequisites

- Node.js 20 or newer
- npm with workspace support
- a modern browser for the React widget
- a public HTTPS tunnel only when connecting the local MCP server to ChatGPT

Install the exact dependency graph:

```bash
npm ci
```

## Fast verification

Run these from the repository root:

```bash
npm run check
npm run build
npm test
```

The current automated suite covers:

- the legacy Agency reference path;
- investigation, survival, and trading worlds through one engine API;
- deterministic seeded outcomes and replay;
- optimistic concurrency, invalid commands, rollback, and mutation idempotency;
- player/model secret filtering and character-ledger audiences;
- trace explanations and authored source targeting;
- deterministic event-divergence detection;
- live narrative dead-end detection;
- immutable correction forks and state diffs.
- indentation-aware Storyframe lexing and typed parsing;
- deterministic compilation and generated source maps;
- compiled investigation, survival, and trading execution;
- compiler repair guidance, reference failures, reachability, and static dead ends.
- compiled spans, thread payoffs, choice groups, invention protection, and authored tests;
- executable authored path assertions plus bounded frame/intent/rule coverage and dead-end discovery;
- visual-artifact reveal, projection separation, source mapping, MIME, and textual fallback requirements;
- admin bearer-token validation and authenticated remote operations smoke.
- frame performance contracts, Director validation, bounded retries, secret rejection, and authored fallback;
- atomic admin-store round trips and restart-safe Creator Studio draft restoration.
- owner-scoped application/persistence, OAuth claim policy, and JOSE deployment configuration;
- checksummed, serialized Postgres migration execution and edited-history rejection;
- static ChatGPT submission/catalog drift checks for all seven tools;
- player choice completeness, focus visibility, live-region/group semantics, and audio control names;
- bounded structured operational logs and safe request-ID propagation.
- per-subject story/narration rate limits, local-preview `429` behavior, and deterministic reset timing.

Every engine rule, condition, effect, projection field, compiler feature, or migration must add or update a focused test.

## Run the debugger walkthrough

```bash
npm run debug:example
```

Expected behavior:

1. A deterministic investigation session commits three turns.
2. The reveal rule fires and moves the active session to `resolution`.
3. The audit reports `dead-end` because that fixture deliberately has no resolution intent.
4. The finding points to `fixtures/investigation.storyframe`, semantic frame `resolution`.
5. A correction simulation forks after version 1 and substitutes a different second intent.
6. The output lists the exact state differences while preserving the original session.

This example is diagnostic evidence, not an automatic fix. The dead-end requires a revised world draft; the alternate second turn demonstrates save-history correction.

## Test the Storyframe compiler

Compile any conformance source:

```bash
npm run storyframe:compile -- worlds/conformance/survival.storyframe
```

Use `--json` to inspect the emitted world and source map. For a negative test, introduce one error in a copied fixture and verify the diagnostic identifies the correct file, line, column, stable code, and actionable repair. Full grammar and expected output are in `STORYFRAME_COMPILER_GUIDE.md`.

### Run authored tests and branch coverage

Compiled `TEST` declarations are world-owned regression checks. They use the public engine resolver and projection boundary:

```ts
const authored = runAuthoredWorldTests(world);
assert.equal(authored.ok, true, JSON.stringify(authored, null, 2));
```

For structural exploration:

```ts
const coverage = exploreStoryBranches(world, {
  maxDepth: 16,
  maxStates: 2_000,
  seed: 42,
});

assert.equal(coverage.complete, true);
assert.deepEqual(coverage.deadEnds, []);
assert.deepEqual(coverage.rejections, []);
```

Do not assert only `100%`. Review uncovered ID arrays and terminal paths. A world may intentionally contain mutually exclusive branch content, and a shallow search may exercise an intent without proving its desired consequence. When `complete` is false, increase a bounded budget or reduce the world to the relevant subgraph; never remove the truncation signal from a report.

Author at least:

- one early-path secrecy test for each protected reveal;
- one canonical completion/failure path per required ending policy;
- one artifact test proving the clue is hidden before and visible after its reveal;
- one regression test for every repaired storyline defect;
- a branch exploration assertion that active dead ends and resolver rejections are empty.

## Test a world path programmatically

```ts
const initial = createSession(world, {
  sessionId: "qa-path-001",
  ownerId: "qa-user",
  seed: 42,
});

const result = resolveTurn({
  world,
  state: initial,
  command: { intentId: "inspect_record" },
  expectedStateVersion: 0,
  mutationId: "qa-path-001-turn-1",
});
```

For each committed turn, retain `result.events` in order and use `result.state` as the next input. Assert rejected results leave state unchanged. Reuse a mutation ID to verify retry behavior; use an old expected version to verify conflict behavior.

After the path:

```ts
const report = auditStoryline(world, initial, events);
assert.equal(report.ok, true);
```

If failure is intentional, assert the exact finding code, event/version, and source semantic ID. Avoid snapshots that only prove a large JSON object changed; assert the mechanic and secrecy boundary that matters.

## Manual MCP and ChatGPT test

For a temporary ChatGPT test, expose the restricted proxy rather than the full
application port. Start `pnpm run chatgpt:proxy` (default `127.0.0.1:8890`),
then tunnel port `8890`. The proxy permits only `/mcp`, `/widget`, `/health`,
and `/`; admin, theme, and preview mutation routes remain local-only.

Build and start the local server:

```bash
npm run build
npm start
```

In a second terminal:

```bash
npm run smoke
```

The health endpoint is `http://localhost:8787/health`; the MCP endpoint is `http://localhost:8787/mcp`.

For ChatGPT:

1. Expose port 8787 through a public HTTPS tunnel.
2. Enable Developer Mode under ChatGPT Apps & Connectors advanced settings.
3. Create an app whose URL ends in `/mcp`.
4. Start a fresh conversation and request Applicant Intake.
5. Exercise the expected tool sequence in `README.md`.
6. Refresh the app connection after tool schema, description, or widget metadata changes.

Verify that:

- the widget never gets ahead of the server `stateVersion`;
- repeating a deliberate UI action reuses its mutation ID only for retries;
- hidden records are absent from serialized tool/widget data before reveal;
- a version conflict refreshes state instead of applying twice;
- the text-only host path remains playable when the widget is unavailable.

## Remote admin smoke

Choose a long local test token and start the server:

```bash
STORYFRAME_ADMIN_TOKEN="replace-with-at-least-24-random-characters" npm start
```

In a second terminal with the same token:

```bash
STORYFRAME_ADMIN_TOKEN="replace-with-at-least-24-random-characters" npm run smoke:admin
```

The smoke verifies an unauthorized rejection, authenticated world overview, deterministic playtest creation, a visual-clue reveal, immutable correction proposal, remote compilation, and private draft save/load/list contracts.

The authenticated overview also reports compiled span count, authored-test pass/fail totals, bounded frame/intent/rule coverage, dead-end count, and uncovered IDs. The remote draft compiler returns full authored-test and coverage reports when compilation succeeds. Treat an incomplete search or failed test as a release-blocking investigation, even if compilation itself is green.

For manual use, open `http://localhost:8787/admin`. Never send the token in a query string. Remote or production-like testing must terminate HTTPS before the Node server.

## Submission contract checks

The static check does not require a running server:

```bash
npm run check:submission
```

It compares the seven-tool import draft with the typed server catalog and validates annotation/test-count contracts. With the server running, use `npm run check:submission:live` to add `tools/list` and output-schema verification.

## UI testing expectations

The production plugin UI will be React-based and use Retro React behind Storyframe wrappers. For every interactive surface test:

- keyboard-only navigation and visible focus;
- reduced-motion mode, especially CRT and marquee effects;
- narrow ChatGPT inline width and expanded layouts;
- loading, empty, stale-version, conflict, retry, and server-error states;
- semantic buttons, headings, lists, and tables independent of visual styling;
- screen-reader labels for meters and terminal-like controls;
- no game rule or hidden canon encoded only in React state.
- every legal authored intent is reachable in the UI; compact layouts may reorganize but never silently truncate choices.

Debugger UI tests must additionally prove that privileged source and secret data never enter the player widget bundle or model-facing tool result.

### Creator Studio first-play checklist

1. Open **Studio** and confirm the player preview precedes the editor at narrow widths.
2. Edit **Scene name** and **What the player reads first**; confirm the preview changes without submitting.
3. Keep **Fine-tune the storytelling** and **Advanced Storyframe source** closed for the first pass.
4. Run **Check this scene** and confirm the plain readiness result appears without a console error.
5. Save the draft, restart the Node process, reopen **Studio**, and confirm both the scene and saved timestamp return.
6. Inspect the DOM contract: one `h1`, ordered scene/player headings, named controls, a polite atomic live region, and zero page-level horizontal overflow.
7. Traverse all buttons, inputs, textareas, and summaries by keyboard and confirm the amber focus outline remains visible.
8. Enable reduced motion and 200% zoom; confirm no content or actions are lost.

## Filing a useful storyline defect

Include:

- world, world version, and engine version;
- session ID in a secure internal channel;
- last known good and first bad state versions;
- expected and actual intent/outcome;
- audit finding code and source semantic ID if available;
- deterministic seed;
- whether the problem reproduces after replay;
- screenshots only as supporting evidence, never as a substitute for event data.

Do not paste hidden canon or personally identifying player text into a public issue.

## Release gate

Before merging runtime work:

1. The selected package manager's frozen install succeeds from its committed lockfile; resolve the current npm/pnpm lockfile mismatch before CI.
2. `npm run check`, `npm run build`, and `npm test` pass.
3. The live MCP smoke passes when adapter code changed.
4. New player/model output is covered by serialized secret-leak assertions.
5. New storyline mechanics have replay and diagnostic trace assertions.
6. Documentation describes new public contracts and tester behavior.
7. Required worlds have non-empty authored tests and an explicitly reviewed branch-coverage report.

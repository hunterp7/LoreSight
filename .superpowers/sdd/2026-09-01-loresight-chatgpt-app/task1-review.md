# Task 1 review — Freeze the public app contract

Review target: `docs/superpowers/plans/2026-09-01-loresight-chatgpt-app.md`, Task 1.

## Verdict

Changes are mostly aligned with the Task 1 public contract, but I do not approve the task as complete because the named targeted test file currently fails and one required static assertion appears incomplete.

## Findings

1. `tests/launch-surface.test.mjs` has stale source-shape assertions and fails.
   - Evidence: `node --test tests/launch-surface.test.mjs tests/server-oauth.test.mjs` reports 7 pass / 2 fail.
   - The failing assertions expect `url.pathname === "/desk"` and `window.location.pathname === "/desk"`.
   - Current implementation uses `["/desk", "/demo"].includes(url.pathname)` in `server/src/index.ts` and `const page = window.location.pathname; const isDeskScene = page === "/desk";` in `web/src/main.tsx`.
   - Task 1 explicitly names `tests/launch-surface.test.mjs`; it should be updated to match the current implementation or replaced by the newer launch-surface script coverage.

2. The required static assertion for forbidden public descriptors is only partial.
   - Task 1 requires a static assertion that no public descriptor exposes `/admin`, private actor fields, hidden canon, or raw filesystem data.
   - `scripts/validate-submission.mjs` currently checks submission/catalog alignment, annotation parity, case counts, and live output schemas, but it does not scan public descriptor title/description/schema/metadata for those forbidden concepts.
   - `tests/launch-surface.test.mjs` checks admin strings in the widget and creator gating, but not the full public tool descriptor surface.

## Confirmed aligned items

- Public tool inventory exists in `server/src/tool-catalog.ts` with `player`, `creator`, and `private` audience typing.
- `generate_story_proposal` is classified as `creator` and is not public by default; registration is gated by `STORYFRAME_CREATOR_TOOLS_ENABLED === "true"`.
- The default submission catalog matches the public player tools and excludes `generate_story_proposal`.
- Every registered public player tool inspected in `server/src/index.ts` has `annotations` from the catalog and an `outputSchema`.
- `chatgpt-app-submission.json` contains exactly five positive and three negative cases.

## Verification run

- `npm run check:submission` — pass; output: `{"ok":true,"mode":"static","tools":12,"positiveTests":5,"negativeTests":3}`
- `npm run check:launch` — pass; output: `{"ok":true,"widget":"self-contained","publicRoutes":["/widget","/desk","/demo"],"serviceRoutes":["/mcp","/health","/ready"],"admin":"production-private"}`
- `npm run build:packages && npm exec -- tsc -p server/tsconfig.json && node --test tests/launch-surface.test.mjs tests/server-oauth.test.mjs` — fail; 7 pass / 2 fail in `tests/launch-surface.test.mjs`

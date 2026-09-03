# Task 3 audit report — LoreSight production persistence

Date: 2026-09-01

## Outcome

No wiring change was made.

The current production-style persistence layer already exists for compiled Storyframe world sessions, but the public LoreSight player tools are still routed through a separate classic-terminal in-memory session map. Repointing those live tools to the existing `@storyframe/application` and `@storyframe/persistence` contracts would not be a safe wiring-only change, because the two paths persist different state models and different user interactions.

## What I checked

### Public LoreSight player path

- `server/src/index.ts` still calls `createSession`, `getSession`, and `submitCommand` from `server/src/loresight-actions.ts` for the public tools:
  - `start_story_session` at lines 245-269
  - `get_story_recap` at lines 364-382
  - `get_story_state` at lines 384-399
  - `submit_story_command` at lines 401-437
  - `open_story_interface` at lines 439-464
- `server/src/loresight-actions.ts` stores session state in `const sessions = new Map<string, LoreSightSession>()` at line 14.
- That file persists only:
  - session id / owner id
  - optional selected story metadata
  - `stateVersion`
  - `status`
  - plain transcript lines
- It does not use the repository layer, world releases, deterministic events, or mutation receipts. `submitCommand()` ignores the incoming `mutationId` entirely because its input does not include one.

### Existing repository and application contracts

- `packages/persistence/src/index.ts` defines `StorySessionRepository`, `WorldReleaseRepository`, and related persistence contracts for compiled Storyframe world state and event logs, not for the classic LoreSight transcript shell.
- `packages/persistence/src/postgres.ts` already contains a Postgres-backed `PostgresStoryframeRepository` with:
  - owner-scoped session reads
  - optimistic versioned session updates
  - append-only event inserts
  - immutable world release persistence
  - director performance persistence
  - lifecycle export/delete support
- `packages/application/src/index.ts` already contains `StoryApplicationService`, which:
  - starts a story from a published world release
  - resolves intents through `engine-core`
  - verifies deterministic replay before projection
  - commits one evented turn through the repository

### Existing Storyframe adapter path

- `server/src/player-view.ts` already wires the Agency conformance world through `StoryApplicationService` and `MemoryStoryframeRepository`.
- That path is currently unused by the public LoreSight MCP tools in `server/src/index.ts`.

## Why I did not rewire it

This is not just an unbound adapter instance.

The current public LoreSight tool flow is a classic interactive-fiction terminal shell:

- the widget handles local file loading and browser-side runtime behavior;
- the server-side session view is a thin LoreSight transcript/session envelope;
- commands are free-form strings, not Storyframe semantic intents;
- there is no existing repository contract for browser-loaded Z-machine runtime snapshots, save data, or transcript persistence in `packages/persistence`;
- there is no application service in `packages/application` for the classic LoreSight terminal model.

Because of that mismatch, replacing the current calls in `server/src/index.ts` with the existing Storyframe persistence/application path would change product behavior rather than safely binding the existing public player path to durable storage.

## Exact blocker

Task 3's launch-plan wording assumes the in-memory public player path can be routed through the existing repository contracts. In this checkout, that assumption is false.

The exact blocker is:

> The existing production persistence contracts model compiled Storyframe world sessions and event logs, while the shipped LoreSight public tool path models a classic terminal transcript session for browser-local Z-machine play. There is no shared persistence contract yet for that public LoreSight session type.

Until a product decision is made, one of these needs to happen before safe production binding:

1. define a durable repository/application contract for classic LoreSight terminal sessions, including mutation receipts and restart-safe snapshots for browser-assisted play; or
2. retire that public classic-terminal path and move the public tools onto the already-structured Storyframe world/session flow.

## Verification run

Ran on 2026-09-01:

`npm run build:packages && node --test tests/persistence.test.mjs tests/application-service.test.mjs tests/migrations.test.mjs`

Result:

- 12 tests passed
- 0 failed

Covered evidence includes:

- repository owner isolation and optimistic turn commits
- immutable world releases and director performances
- migration ledger ordering and immutability checks
- application-service duplicate receipt handling
- replay integrity enforcement

## Recommendation

Do not treat Task 3 as a small wiring task for the current LoreSight public player surface.

The next safe step is an architecture decision:

- either add a first-class persistence contract for the classic LoreSight terminal session model;
- or explicitly migrate the public app surface onto the existing Storyframe application/repository path and adjust the widget contract accordingly.

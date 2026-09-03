# Phased Implementation Plan

## Target repository shape

The exact build system may be adjusted after inspection, but preserve these boundaries:

```text
apps/
  chatgpt-server/       MCP server, auth boundary, tool registration
  player-widget/        ChatGPT MCP Apps React UI
  creator-studio/       Plain-language authoring and playtest UI
packages/
  engine-core/          Pure deterministic runtime
  engine-modules/       Optional mechanics modules
  world-schema/         Runtime and compiled package schemas
  storyframe/           Parser, AST, compiler, source maps, diagnostics
  ai-director/          Tween provider interface, validators, fallbacks
  projections/          Player/model/creator/debug view construction
  persistence/          Save/event/world repositories
  ui-kit/               Shared accessible primitives and semantic icons
worlds/
  the-agency/           First real world package and assets
  conformance/          Investigation, survival, and trading fixtures
```

Avoid creating packages that contain only one thin wrapper. Boundaries should correspond to distinct trust, dependency, or test surfaces.

## Phase 0 — Preserve the spike

- Confirm current check, build, tests, and MCP smoke behavior.
- Record existing tool descriptors and initial state.
- Keep the current prototype available until replacement paths pass.
- Do not treat current Agency types as the generic schema.

Gate: existing behavior is reproducible before extraction begins.

## Phase 1 — Pure engine foundation

Build without React, MCP, database, or model dependencies:

- world, engine, and save version contracts;
- typed state domains;
- commands and semantic intents;
- conditions and effects as a bounded expression AST;
- ordered transactional turn resolution;
- seeded randomness;
- event log and snapshots;
- optimistic concurrency and mutation-id idempotency;
- player/model/creator/debug projections;
- structured character ledger;
- deterministic replay;
- conformance fixtures for investigation, survival, and trading.

Gate:

- same seed + world + commands produces identical events and state;
- repeated mutation ID produces no duplicate effect;
- secrets are absent from unauthorized projections;
- no Agency identifiers occur in core packages;
- three fixture genres run without core exceptions.

## Phase 2 — Storyframe parser and compiler

Implement:

- lexer/parser or indentation-aware parser with precise diagnostics;
- typed AST;
- semantic validation;
- stable generated IDs with source maps;
- canon classes: LOCK, SECRET, BRANCH, OPEN, UNSAID, NEVER;
- FRAME, SPAN, CAST, STATE, THREAD, INTENT, CHOICE, ENDING, TEST;
- conditions/effects compilation;
- TweenContract generation;
- graph reachability and required-thread payoff analysis;
- hidden-fact/model-projection analysis;
- fallback requirements;
- compiler fixture tests and snapshot output.

Prefer an explicit grammar and typed AST over ad hoc regex parsing. Preserve comments, locations, and actionable source ranges.

Gate:

- the three conformance worlds compile from Storyframe;
- malformed input produces human-readable diagnostics with source locations;
- unreachable endings and premature secret reveals fail compilation;
- compile output is deterministic;
- round-trip source mapping is sufficient for editor selection and errors.

## Phase 3 — Agency migration

- Encode Applicant Intake in complete Storyframe source.
- Move exact dialogue, artifacts, endings, canon, and theme into the world package.
- Remove Agency-specific branches from runtime code.
- Reproduce the current tested path and three endings.
- Add character ledgers for Caseworker 43 and Applicant 71-442-B.
- Add player and creator recaps.

Gate:

- current Applicant Intake tests pass against compiled Storyframe;
- final memo remains protected;
- all three endings remain reachable;
- Caseworker recap never leaks intended-recipient information early;
- core package contains no Agency references.

## Phase 4 — AI Director

Introduce a provider interface:

```text
TweenContract + visible state + session ledger
        -> validated Performance
```

- deterministic fake provider for tests;
- authored fallback provider;
- OpenAI Responses API provider behind environment configuration;
- structured output schema;
- canon, entity, secret, and mechanical-claim validation;
- bounded retry/repair;
- performance caching and trace IDs;
- usage and cost instrumentation;
- session-detail persistence by scope.

Do not couple the engine to a single model. Establish representative eval cases before choosing production model tiers.

Gate:

- generation failure falls back without corrupting state;
- invalid performance is never committed;
- generated details remain stable at their declared scope;
- evals detect secret leakage, unknown entities, voice drift, and unsupported consequences.

## Phase 5 — ChatGPT player application

Use the interactive-decoupled MCP Apps pattern:

Suggested tool surface:

- `start_story_session`
- `get_story_state`
- `submit_story_intent`
- `get_character_recap`
- `get_world_recap`
- `open_story_interface`

Only the render tool attaches the UI resource. Data and mutation tools update the mounted widget without unnecessary remounts.

The widget provides:

- current narrative and legal actions;
- characters, places, clues/objects, and timeline;
- character recap;
- save/resume feedback;
- responsive and reduced-motion behavior;
- world-specific theming from semantic tokens.

Gate:

- MCP Inspector and local smoke pass;
- complete Agency playthrough works through ChatGPT Developer Mode;
- repeated/retried tool calls remain safe;
- mobile and desktop UI remain readable;
- no hidden state appears in structured model/player output.

## Phase 6 — Creator Studio vertical slice

Build only the first complete loop:

1. View Applicant Intake as a story spine.
2. Add/edit one critical moment in plain language.
3. Edit the preceding elastic span.
4. Review **What the engine understood**.
5. Approve the proposed semantic change.
6. Generate valid Storyframe source with source maps.
7. Compile and playtest the affected route.
8. Annotate authored versus interpolated output.

The UI hides variables and IDs by default. Advanced Mode exposes Storyframe, compiled output, state, events, projections, and replay.

Gate:

- plain-language edit round-trips without semantic loss;
- no major canon or consequence change is applied without approval;
- compiler errors appear in human language and link to the relevant moment;
- the creator can distinguish authored, generated, and proposed material.

## Phase 7 — Persistence and production hardening

- user/world/session identity;
- durable Postgres-compatible repositories;
- world drafts and immutable releases;
- save snapshots plus ordered events;
- migrations and concurrency tests;
- audit logs;
- privacy deletion/export;
- rate limiting, abuse controls, logging, metrics, and alerting;
- secrets and environment configuration;
- production CSP/domain metadata;
- privacy, support, and terms surfaces.

Gate: restart-safe hosted sessions, observable failures, tested migrations, and review-ready security/privacy behavior.

## Phase 8 — Deployment and submission

- deploy the MCP server to stable HTTPS infrastructure;
- deploy Studio and required assets;
- verify ChatGPT Developer Mode end to end;
- produce app metadata, test prompts, screenshots, logo, privacy URL, support URL, and review instructions;
- run a fresh official-policy check;
- submit only after explicit owner approval.


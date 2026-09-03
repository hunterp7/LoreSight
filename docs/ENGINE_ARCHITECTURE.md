# Narrative Engine Architecture

Status: proposed foundation  
Decision: The Agency is a world pack and conformance test, not engine code.

## Product promise

Create, approve, publish, and play deeply authored turn-based narrative worlds without rebuilding the runtime for each story.

The engine is optimized for games in which the player:

1. observes a situation;
2. chooses or expresses an intent;
3. spends time, resources, information, or relationships;
4. receives deterministic and probabilistic consequences;
5. discovers a changed world;
6. repeats until an ending, failure, or continuation state.

It can support the narrative structures behind survival journeys, trading games, investigations, social simulations, branching adventures, and puzzle-box worlds. It does not claim to support every possible game genre.

## Non-negotiable invariants

1. The engine contains no setting, character, plot, dialogue, or visual identity.
2. A published world package is the only authority for that world's canon.
3. The runtime is deterministic when given the same world version, seed, prior state, and command sequence.
4. AI can interpret intent and perform approved material; it cannot mutate rules or publish canon.
5. Every state transition is validated by the engine and recorded as an event.
6. Saves contain serializable simulation state, never renderer or model state.
7. ChatGPT, a web app, a CLI, or another host can drive the same runtime.
8. Content packages are versioned, validated, and migrated independently of the engine.
9. Creator-authored facts override generated language.
10. Hidden information is filtered before it reaches a model or renderer.

## System boundary

```text
 CREATOR STUDIO
      |
      | drafts, previews, approves
      v
 WORLD COMPILER ---- validates canon, graph, rules, rights, migrations
      |
      | immutable, versioned WorldPack
      v
 HOST ADAPTER -----> COMMAND -----> ENGINE REDUCER -----> EVENTS
 ChatGPT / Web / CLI                   |                     |
      ^                                v                     v
      |                           GAME STATE ----------> EVENT LOG
      |                                |
      +------ VIEW MODEL <-------------+
                  |
                  +---- approved canon slice + narrative slots ----> AI DIRECTOR
                  +---- UI projection -----------------------------> RENDERER
```

The AI Director is downstream of the engine. It can turn an approved result into compelling prose, dialogue, and personalized texture. It cannot decide whether a choice was legal, what resources changed, what became canon, or what secret was revealed.

## Packages

### `engine-core`

A pure TypeScript library with no React, MCP, database, or model dependency.

- command validation
- condition evaluation
- effect resolution
- seeded random number generation
- turn pipeline
- event creation
- state projection
- save serialization
- version compatibility checks

Primary API:

```ts
createSession(world, options): GameState
getAvailableCommands(world, state): CommandDescriptor[]
resolveTurn(world, state, command): TurnResult
projectView(world, state, audience): ViewModel
replay(world, initialState, events): GameState
```

### `engine-modules`

Optional mechanics composed through stable contracts rather than copied into worlds.

- flags and branching
- resources and meters
- clocks, calendars, and deadlines
- inventory and equipment
- locations, routes, and travel
- encounters and weighted tables
- skill checks and seeded chance
- relationships, factions, and reputation
- markets, scarcity, and price movement
- clues, knowledge, and puzzle gates
- quests, objectives, endings, and failure states

The core owns orchestration. Modules own their schemas, validation, reducers, and projections.

### `world-schema`

The portable contract for authored content. A world contains:

```text
manifest        identity, version, ownership, rights, compatibility
canon           entities, facts, voices, secrets, prohibitions
mechanics       enabled modules and starting configuration
scenes          authored situations and presentation slots
choices         explicit commands, conditions, costs, and effects
rules           reactive consequences evaluated after each command
encounters      deterministic or weighted event tables
assets          stable semantic keys for images, audio, documents, UI
endings         terminal and continuation outcomes
migrations      save transforms between compatible world versions
tests           canonical paths, invariants, and unreachable-state checks
presentation    theme tokens and renderer hints, never gameplay rules
```

World objects reference stable IDs. Display names and file paths are never public engine keys.

Worlds are authored in the proprietary Storyframe narrative language and compiled into this schema. See `STORYFRAME_LANGUAGE.md`.

### `world-compiler`

Compilation is the trust boundary between creative drafts and playable releases.

It must reject:

- missing references;
- contradictory locked facts;
- unreachable required scenes;
- choices with impossible conditions;
- secret content exposed to the wrong audience;
- effects targeting disabled modules;
- unbounded loops without an explicit continuation policy;
- incompatible save migrations;
- publishable packages without rights metadata.

It also emits a graph, balance report, content warnings, estimated play range, and a signed package hash.

The compiler translates creator-authored narrative keyframes and elastic AI spans into deterministic frames, legal commands, canon projections, and bounded `TweenContract` objects.

The implemented foundation lives in `packages/storyframe`. Its pipeline is:

```text
source -> line lexer -> indentation AST -> semantic compiler
       -> reference/graph validation -> WorldPack + sourceMap
```

Syntax and semantic diagnostics use the same source-range contract consumed by `story-debugger`, so a runtime failure and a compile-time failure can select the same authored declaration in Creator Studio.

### `creator-studio`

The creator—not the model—owns the world.

- structured editors for setting, characters, factions, timeline, voice, and rules;
- graph and timeline views;
- canon conflict review;
- AI-assisted drafting as proposals;
- side-by-side canon deltas;
- automated playthrough simulation;
- branch coverage and dead-end reports;
- preview sessions pinned to a draft version;
- explicit approval and publishing.

### `host-adapters`

Adapters translate a host into engine commands without changing the simulation.

- ChatGPT MCP app
- standalone web application
- command-line runner
- test/simulation runner
- future mobile or messaging clients

The ChatGPT adapter exposes only the current legal commands and the canon slice needed for the turn. Free-form player language is mapped to a command proposal, then validated by the engine.

### `renderers`

Renderers consume view models. The default renderer is accessible DOM UI optimized for text, documents, maps, inventories, meters, and turn history. A world can supply a theme and asset manifest, but never renderer-side rules.

Artifacts use the same server-authoritative reveal pipeline as canon. A `reveal-artifact` effect commits an operation and adds the artifact ID to state. Player/model projections contain no artifact fields before that reveal. Afterward, the player receives approved presentation metadata and asset key while the model receives the textual clue without the binary asset reference.

### `admin-console`

The remote operations UI is a separate React application served at `/admin`. It consumes a same-origin, privileged HTTP API and never shares its state or bundle with the ChatGPT player widget.

The implemented alpha supports:

- compiled-world health and source diagnostics;
- legacy session visibility with an explicit non-replayable warning;
- deterministic conformance playtest creation and legal intent submission;
- event timeline, causal audit findings, state and source inspection;
- in-memory draft compilation;
- immutable correction simulation and proposal recording;
- artifact contract and accessibility inspection;
- incident runbooks for common narrative failures.

The alpha bearer token is suitable for local development and tightly controlled private environments behind HTTPS. Public production requires OAuth/OIDC identity, MFA, role/scoped authorization, durable audit persistence, revocation, and rate limiting.

### `story-debugger`

A host-independent diagnostic library layered on the engine, projections, and compiler source maps.

- explains why an intent is or is not available;
- describes committed state operations and reactive-rule outcomes;
- replays event logs and detects deterministic divergence;
- checks active states for narrative dead ends;
- rechecks player/model projections for unrevealed-canon leakage;
- resolves runtime semantic IDs back to authored source ranges;
- forks a session at an exact version and simulates a replacement turn;
- emits state diffs without changing the original save.

The debugger is privileged application functionality. Its reports can contain creator/debug source locations and state, so they must never be placed in a player or model projection. See `STORY_DEBUGGING.md` for its contracts and operating workflow.

### `ai-director`

The Director is a provider-neutral, downstream performance boundary. It combines the current compiled frame contract with the model-safe projection and a narrative-progress ledger, validates untrusted structured output, and selects authored fallback text after bounded failure. Its progress and accepted session details are application persistence, not engine mechanics. See `AI_DIRECTOR.md`.

## Turn resolution

Every turn follows one ordered transaction:

1. Normalize the submitted command.
2. Confirm the command exists in the current view.
3. Evaluate prerequisites and costs.
4. Resolve declared effects.
5. Run enabled mechanics modules in a stable order.
6. Evaluate reactive world rules.
7. Advance clocks and encounter tables when applicable.
8. Determine newly visible information and endings.
9. Validate state invariants.
10. Commit events and increment the state version.
11. Produce separate player, model, creator, and debug projections.

Failure before commit leaves state unchanged. Each command carries a client mutation ID so retries cannot apply a turn twice.

The committed event also contains a `TurnTrace`. The trace is mechanical evidence, not generated prose. Because it is produced inside the same transaction as the operations, a tester can later identify the selected intent, evaluated condition, rule outcomes, random rolls, and resulting state operations without reconstructing reasoning from chat text.

## Canon governance

Canon is structured authority, not a long prompt.

### Canon classes

- `locked`: an approved fact the runtime and AI cannot contradict.
- `branch`: a fact established only on a particular save branch.
- `secret`: canonical but withheld until its reveal condition is satisfied.
- `open`: a deliberately unspecified area where session-level invention is allowed.
- `proposed`: AI- or creator-drafted material with no authority until approved.
- `deprecated`: retained for migrations and history but unavailable to new sessions.

### Creative ownership workflow

```text
Draft -> Validate -> Simulate -> Review canon delta -> Approve -> Publish immutable version
```

AI-created names, characters, relationships, history, locations, dialogue rules, or metaphysical claims enter as proposals. Nothing is promoted because it appeared during play. The creator can edit, reject, lock, branch, or leave any element open.

Published versions are immutable. A change creates a new semantic version and an explicit save migration. Existing sessions remain pinned unless the creator marks the migration compatible.

## AI Director contract

The AI Director receives:

- current scene and approved narrative slots;
- player-visible state only;
- relevant locked and branch canon;
- character voice contracts;
- explicit open spaces it may embellish;
- prohibited claims and style constraints;
- the engine's completed turn result.

It returns structured performance output:

- narration;
- dialogue attributed to approved speakers;
- optional sensory detail;
- references to presented commands;
- proposal telemetry for interesting emergent ideas.

Its output is checked for unknown entities, secret leakage, canon contradictions, and unsupported mechanical claims. The engine result remains valid even if generation fails; the renderer can fall back to authored text.

## Personalization

Personalization is an overlay, never a rewrite of the shared world package.

- player profile: preferred name, tone, intensity, accessibility, play length;
- scenario overlay: selected premise variables and creator-approved substitutions;
- memory overlay: facts established in the player's save;
- presentation overlay: text density, visuals, audio, and interaction preferences.

Sensitive personal data should be opt-in, minimized, separable from saves, and deletable. A world must remain playable without it.

## Third-party intellectual property

The engine supports rights metadata but does not manufacture permission.

World packages declare one of:

- `original`;
- `public-domain` with source and jurisdiction notes;
- `licensed` with scope and expiration metadata;
- `user-supplied-private` for a non-published personal draft.

Unlicensed third-party worlds are not eligible for public discovery, creator monetization, official assets, merchandise, or export as a distributable pack. A private designation is risk containment, not a legal conclusion or a promise of fair use.

The product should market personalized *premises and original worlds*, not “play inside any franchise.” Licensed IP can become a premium distribution lane later.

## Persistence and replay

The canonical save is:

```text
worldId + worldVersion + engineVersion + seed + current snapshot + ordered events
```

Snapshots make loading fast; events make outcomes explainable and replayable. Personal prose does not need to be replayed to reconstruct state. Saves use optimistic concurrency with `stateVersion` and idempotency with `mutationId`.

## Testing strategy

Every engine release must pass:

1. pure reducer unit tests;
2. deterministic replay tests;
3. schema and reference validation;
4. world conformance packs;
5. property tests for invalid and repeated commands;
6. secret-leak projection tests;
7. save migration tests;
8. simulated playthrough and branch coverage;
9. host adapter contract tests;
10. renderer accessibility and responsive checks.

The Agency becomes the first conformance world. Additional synthetic test worlds should isolate trading, travel, survival, puzzles, relationships, and clock mechanics so the engine is not accidentally optimized around one narrative.

## Deliberate exclusions from version 1

- real-time action or physics;
- unconstrained model-authored rules during a live session;
- multiplayer synchronization;
- a public marketplace;
- automatic publishing of generated worlds;
- unrestricted third-party IP distribution;
- visual game logic embedded in React components;

## Implementation sequence

1. Freeze new Agency-specific features.
2. Extract a pure engine contract with flags, resources, clocks, inventory, clues, and seeded checks.
3. Encode Applicant Intake as a declarative world package.
4. Prove identical outcomes through deterministic replay tests.
5. Add two tiny conformance worlds: a travel/survival loop and a trading/economy loop.
6. Replace Agency-specific MCP tools with generic session, command, view, and render tools.
7. Build the first creator-facing canon editor only after the compiler is stable.

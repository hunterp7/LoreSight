# Storyframe Architecture and Development Plan

Status: active implementation plan; Phases 0–4 complete, Phase 5 provider adapter implemented, Phase 6 hosted integration and production launch remain  
Prepared: August 1, 2026; implementation status updated August 3, 2026  
Target: reusable Storyframe engine, ChatGPT plugin with MCP Apps UI, and later Creator Studio

## 1. Executive recommendation

Build Storyframe as a host-independent deterministic narrative platform, then expose it to ChatGPT through a thin MCP adapter and a mounted React widget.

The primary ChatGPT archetype is **interactive-decoupled**:

- data and mutation tools operate on server-authoritative sessions;
- one render tool attaches the UI resource;
- the widget remains mounted and receives versioned state updates;
- the engine, compiler, projections, persistence, and AI Director do not depend on MCP or React.

The existing Agency prototype should remain runnable as a behavioral reference until the generic Agency world reproduces its complete path. It should not be expanded into the platform architecture.

The delivery sequence is:

```text
Preserve spike
    -> pure engine and projections
    -> Storyframe compiler
    -> Agency conformance migration
    -> ChatGPT adapter and player widget
    -> AI Director
    -> durable identity and persistence
    -> Creator Studio slice
    -> production deployment and submission
```

This order deliberately proves mechanics, replay, and secrecy before adding model generation, production identity, or creator-facing polish.

### Implementation checkpoint — August 3, 2026

The repository has moved beyond the initial backlog:

- Phases 0–4 are implemented locally: deterministic runtime, safe projections, Storyframe compiler, compiled Agency application path, generic MCP tools, React player, retry handling, narration, and smoke coverage.
- Phase 5 includes stable narrative beats, model-safe inputs, bounded validation/repair, explicit progress, authored fallback, content-free attempt/result telemetry, and a fail-closed semantic-evaluator boundary. Disabled-by-default OpenAI Responses generation and semantic-evaluation adapters with strict Structured Outputs and content-free token/latency telemetry now live in `server/src/director.ts`; hosted telemetry, extended entity/mechanics evals, and approved live evidence remain.
- The first Phase 7 authoring slice is implemented early in the private admin: a plain-language critical-scene editor, progressive disclosure, live CRT preview, compiler interpretation, private draft save/restore, playtests, audits, and immutable correction proposals.
- A restart-safe atomic JSON store now protects private-alpha drafts, playtests, and correction proposals. This is a development bridge, not the Phase 6 production persistence target.
- Phase 6 now includes owner-scoped application services, immutable release/session/performance/audit repositories, a Postgres migration and driver-neutral adapter, OAuth protected-resource metadata, JOSE/JWKS bearer verification, and request/tool scope enforcement. Live identity-provider and database integration remain deployment work.
- Deployment hardening now includes a checksummed/serialized migration ledger, a shared seven-tool submission catalog with offline drift validation, player accessibility contracts, safe request correlation/structured logs, and bounded local turn/narration abuse guards.
- The admin first-play experience has been simplified around three tasks—check the story, create a scene, and fix a problem—with semantic Pixelarticons and consistent visual-artifact rules.

The next production sequence is now:

```text
Validate Director semantic evaluator and live eval set
    -> Bind managed OAuth/OIDC and Postgres providers
    -> Hosted MCP Inspector and ChatGPT Developer Mode verification
    -> Privacy/support/recovery evidence
    -> Explicitly authorized submission and launch gate
```

## 2. Intake assessment

### What already works

- Node/TypeScript MCP server using Streamable HTTP.
- React widget delivered as an MCP Apps UI resource.
- Seven generic Storyframe player tools, including safe character/world recaps and opt-in narration.
- A decoupled render tool (`open_story_interface`) and compiled Applicant Intake conformance path.
- Basic deterministic path tests and an MCP smoke script.
- Strong product, canon, compiler-language, creator-UX, and architecture specifications.
- A first Storyframe source example for Applicant Intake.

### What remains private-alpha or deployment-only

- The admin still uses a restart-safe single-process JSON store instead of the production repository.
- The player application path uses the owner-scoped repository contract but is not yet bound to managed Postgres.
- OAuth verification is implemented but not connected to a selected live identity provider.
- The OpenAI Director provider, semantic evaluator, and content-free usage telemetry are implemented but disabled by default; extended evals, hosted metrics/cost joins, and approved live evidence remain.
- Local rate limits and JSON logs are single-process; hosted deployments require distributed controls and a protected collector.
- Public URLs, policies, screenshots, backup/restore evidence, reviewer credentials, and submission authority remain external launch gates.

### Closed security and correctness gaps

The initial spike blockers now have explicit regression coverage:

1. **Hidden artifact leakage:** player and model projections physically omit unrevealed artifacts and secret canon; the final Agency memorandum has dedicated compile, projection, and runtime tests.
2. **Incorrect idempotency claims:** mutation receipts are part of deterministic state, and repeated mutation IDs return the original receipt without applying a second turn.
3. **Non-deterministic core inputs:** session IDs, owner identity, seed, mutation IDs, and clock values enter through application/host boundaries; the pure reducer remains replayable.
4. **Concurrency protection:** mutation tools require `expectedStateVersion` and `mutationId`; repository commits use optimistic version checks.
5. **Forgeable identity:** application services derive owner scope from the verified actor context, and repository reads/writes reject cross-owner access.

The remaining risks are hosted integrations rather than missing local boundaries: live IdP configuration, multi-instance Postgres proof, distributed rate limits, secret rotation, backups/restore, and policy/submission evidence.

## 3. Target system architecture

```text
ChatGPT / Codex host
        |
        | MCP Streamable HTTP + OAuth 2.1
        v
+-------------------------+
| apps/chatgpt-server     |
| tool schemas, auth, CSP |
+------------+------------+
             |
             | application commands and safe projections
             v
+-------------------------+       +-------------------------+
| application services    |------>| persistence adapters    |
| sessions, turns, recaps |       | Postgres + object store |
+------------+------------+       +-------------------------+
             |
             v
+-------------------------+       +-------------------------+
| packages/engine-core    |<------| compiled WorldPack      |
| pure reducer + events   |       | immutable and versioned |
+------------+------------+       +------------+------------+
             ^                                  ^
             |                                  |
+------------+------------+       +------------+------------+
| packages/projections    |       | packages/storyframe     |
| audience-safe views     |       | parser/compiler/maps    |
+-------------------------+       +------------+------------+
                                                ^
                                                |
                                     +----------+-----------+
                                     | Creator Studio      |
                                     | propose/review/test |
                                     +---------------------+

Player widget <--- MCP Apps bridge ---> ChatGPT host
      |
      +--- renders only player-safe structuredContent
      +--- calls mutation tools with mutationId + expectedStateVersion

AI Director
      |
      +--- receives model-safe projection + TweenContract
      +--- returns validated Performance or authored fallback
      +--- never mutates engine state directly
```

### Trust boundaries

| Boundary | Trusted responsibility | Must not cross it |
|---|---|---|
| Storyframe compiler | Validate source and emit immutable `WorldPack` | Ambiguous mechanics, unresolved references, secret exposure paths |
| Engine core | Resolve legal commands deterministically | MCP, React, database, model calls, world-specific branches |
| Projections | Physically construct audience-safe views | Hidden fields with visibility flags, raw world packages, auth tokens |
| Application service | Transactions, identity, repositories, concurrency | Host-specific presentation rules |
| MCP adapter | Auth, tool schemas, annotations, UI metadata | Game rules or direct database manipulation |
| Widget | Presentation and user intent capture | Canonical state or legality decisions |
| AI Director | Bounded performance inside a `TweenContract` | Mechanical consequences, secrets, canon publication |

## 4. Repository shape

Use npm workspaces initially to minimize migration cost from the current npm project. Introduce a heavier monorepo orchestrator only if build scale justifies it.

```text
apps/
  chatgpt-server/       MCP endpoint, auth context, tools, UI resources
  player-widget/        React MCP Apps widget using Retro React
  creator-studio/       Later plain-language authoring/playtest app
packages/
  engine-core/          Pure turn reducer, events, replay, RNG
  engine-modules/       Optional clocks, markets, routes, clues, etc.
  world-schema/         Source-independent runtime schemas
  storyframe/           Parser, AST, compiler, source maps, diagnostics
  projections/          Player/model/creator/debug view builders
  application/          Session orchestration and use cases
  persistence/          Repository interfaces and Postgres adapters
  ai-director/          Provider interface, validation, fallbacks, eval hooks
  ui-kit/               Shared accessible UI primitives and tokens
worlds/
  the-agency/
  conformance/investigation/
  conformance/survival/
  conformance/trading/
tests/
  contract/
  integration/
  e2e/
legacy/
  agency-prototype/     Temporary; remove only after migration gate passes
```

Do not create every directory immediately. Phase 1 should create only boundaries needed for the pure runtime and its tests while leaving the prototype operational.

## 5. Core contracts

### Engine inputs

```ts
interface ResolveTurnInput {
  world: WorldPack;
  state: GameState;
  command: Command;
  expectedStateVersion: number;
  mutationId: string;
}

interface Command {
  intentId: string;
  parameters: Record<string, JsonValue>;
}
```

The host supplies session identity, clock values, and the initial seed. The reducer receives only serializable values.

### Engine output

```ts
type ResolveTurnResult =
  | {
      status: "committed";
      state: GameState;
      events: DomainEvent[];
      stateVersion: number;
    }
  | {
      status: "duplicate";
      original: CommittedMutation;
    }
  | {
      status: "rejected";
      reason: RejectionReason;
      stateVersion: number;
    };
```

A rejected turn produces no events and no state change. A duplicate returns the original committed result. Every successful turn increments the state version exactly once.

### Persistence model

The canonical save is:

```text
ownerId + sessionId + worldId + worldVersion + engineVersion
+ seed + latest snapshot + ordered events + committed mutation results
```

Persist narrative performance separately from mechanical events so deterministic replay does not require regenerating prose.

### Projection model

Construct fresh objects for four audiences:

- `player`: visible story state and legal actions;
- `model`: the smallest visible canon and ledger slice needed to perform the next turn;
- `creator`: full approved authoring context and provenance;
- `debug`: full runtime state, available only under privileged authorization.

Projection tests must assert forbidden keys and values are absent from serialized JSON, not merely marked hidden.

## 6. ChatGPT plugin architecture

### Recommended tool surface

| Tool | Purpose | Impact annotations | UI |
|---|---|---|---|
| `start_story_session` | Start a specific published world release or return the prior result for the same mutation ID | write, non-destructive, closed-world, idempotent | none |
| `get_story_state` | Resume or inspect a session and current legal actions | read-only, non-destructive, closed-world | none |
| `submit_story_intent` | Commit one currently legal player intent | write, non-destructive, closed-world, idempotent | callable by model and app |
| `get_character_recap` | Retrieve an audience-safe structured character ledger projection | read-only, non-destructive, closed-world | none |
| `get_world_recap` | Retrieve visible places, clues, objects, threads, and timeline | read-only, non-destructive, closed-world | none |
| `open_story_interface` | Render the current player interface after data is available | read-only, non-destructive, closed-world | attaches the UI resource |

Descriptions should begin with “Use this when…” and distinguish reads from writes. Every state mutation accepts `mutationId` and `expectedStateVersion`. Tool handlers authorize session ownership before loading data.

### Result partitioning

- `structuredContent`: concise, player/model-safe state, legal intent descriptors, version, and stable IDs.
- `content`: short narration the host can use without the widget.
- `_meta`: non-sensitive widget-only presentation data that does not need model attention.

Never use `_meta` as an authorization boundary. Secrets and unrelated personal data should not be returned at all.

### Widget behavior

- Use the MCP Apps `ui/*` bridge and `tools/call` as the portable baseline.
- Treat wrapper helpers as implementation conveniences rather than the public architecture.
- Render the first snapshot from host-delivered `structuredContent`.
- Apply later snapshots only when `stateVersion` is newer.
- Generate a new mutation ID for each deliberate action and reuse it on retries.
- On a version conflict, refresh state and present an understandable recovery message.
- Request fullscreen or picture-in-picture only when the player explicitly expands the experience and the capability exists.
- Keep an authored text-only path so the game remains playable without custom UI.

### Resource metadata

- Version widget URIs when HTML, JavaScript, or CSS changes incompatibly.
- Set exact `connectDomains` and `resourceDomains`; default both to empty when assets and calls are same-origin/bridge-only.
- Set `_meta.ui.domain` for production submission.
- Set `openai/widgetDescription` and the MCP-standard `_meta.ui.resourceUri`.
- Keep the compatibility `openai/outputTemplate` alias only while required for host compatibility.

## 7. Identity, authorization, and privacy

### Development modes

1. **Local prototype:** anonymous ephemeral sessions, clearly labeled and never used for sensitive saves.
2. **Private hosted alpha:** established identity provider plus OAuth 2.1; durable saves tied to the resolved subject.
3. **Public plugin:** OAuth 2.1 conforming to MCP authorization, production HTTPS metadata, least-privilege scopes, domain verification, privacy/export/deletion paths.

The application must stop accepting `playerId` as authority. The MCP request context resolves `ownerId`; tool inputs contain only opaque session IDs the authorized owner may access.

Prefer an established identity provider. The resource server must validate token signature, issuer, audience/resource, expiry, and scopes on every request. Do not build a custom authorization server unless product requirements force it.

Suggested scopes:

- `story:sessions:read`
- `story:sessions:write`
- later `story:worlds:read`
- later `story:worlds:write`
- later `story:worlds:publish` as a separate high-trust permission

Store personalization separately from world state, minimize free-form personal data, and implement export/deletion before public launch.

## 8. Development phases and gates

### Phase 0 — Reproduce and freeze the spike

Deliverables:

- install locked dependencies;
- record `check`, `build`, unit-test, and live smoke results;
- snapshot existing MCP tool descriptors and the successful Agency path;
- add a regression test demonstrating the current hidden-payload leak, then mark it as a required migration fix;
- move no files yet unless necessary to make the baseline reproducible.

Gate: the existing experience is reproducible and its known limitations are captured.

### Phase 1 — Pure runtime foundation

Deliverables:

- workspace configuration;
- `world-schema`, `engine-core`, `projections`, and shared fixtures;
- typed conditions/effects AST;
- transactional reducer and seeded RNG;
- event log, snapshots, replay, optimistic concurrency, mutation ledger;
- player/model/creator/debug projections;
- structured character ledgers;
- investigation, survival, and trading conformance worlds.

Gate: all three genres run through the same API; replay is deterministic; repeated mutation IDs do not reapply effects; unauthorized projections contain no secret values; core packages contain no Agency identifiers.

### Phase 2 — Storyframe compiler

Deliverables:

- indentation-aware lexer/parser with a typed AST;
- source locations, comments, source maps, and stable semantic IDs;
- deterministic compiled `WorldPack` output;
- canon, graph, thread, effect, reachability, and secret-flow validation;
- human-readable diagnostics with repair guidance;
- compilation of all three conformance worlds.

Gate: valid fixtures compile deterministically; invalid references, unreachable required endings, ambiguous invention scopes, and premature reveals fail with source-located diagnostics.

### Phase 3 — Agency migration

Deliverables:

- complete Agency world package with content and presentation separated;
- generic runtime execution of the existing case and all three endings;
- ledger-based player and creator recaps;
- golden parity tests against the spike;
- removal of Agency branches from runtime packages.

Gate: behavior matches the accepted story path, the final memo is physically absent before reveal, and the prototype can be retired without losing coverage.

### Phase 4 — ChatGPT vertical slice

Deliverables:

- generic MCP tools listed above;
- standards-first React widget;
- version conflict and retry handling;
- text-only fallback path;
- MCP Inspector and smoke tests;
- Developer Mode end-to-end Agency playthrough.

Gate: complete playthrough in ChatGPT, safe retries, no remount-per-mutation behavior, responsive/accessible UI, and no hidden state in tool or widget payloads.

### Phase 5 — AI Director

Deliverables:

- provider-neutral `TweenContract -> Performance` interface;
- deterministic fake and authored fallback providers;
- structured validation and bounded repair;
- secret, entity, canon, voice, and mechanical-claim evaluators;
- provider usage/cost tracing and performance caching;
- OpenAI Responses API adapter behind server configuration.

Gate: invalid generations never persist or alter mechanics; provider failure remains playable; representative evals meet thresholds selected before production model choice.

### Phase 6 — Durable hosted alpha

Deliverables:

- Postgres repositories and migrations;
- OAuth 2.1 integration through an established provider;
- owner/session authorization;
- immutable world releases;
- restart-safe saves and replay;
- rate limits, structured logs, metrics, tracing, backup/restore runbook.

Gate: authenticated sessions survive restart and deploy, concurrent writes are tested, migrations are reversible or recoverable, and unauthorized cross-user access fails.

### Phase 7 — Creator Studio vertical slice

Deliver only the flow already defined in the context pack: inspect the Agency spine, edit one critical moment and preceding span, review the semantic interpretation, approve, compile, and playtest with provenance labels.

Gate: the edit round-trips without semantic loss and no material canon/consequence/invention change becomes authoritative without explicit creator approval.

### Phase 8 — Production and submission

Deliverables:

- stable public HTTPS `/mcp` endpoint with Streamable HTTP;
- production widget domain and exact CSP;
- privacy, support, terms, deletion, and export surfaces;
- domain and developer/business identity verification;
- accurate annotations and submission justifications;
- listing copy, logo, screenshots, starter prompts, review credentials when required;
- five positive and three negative review test cases;
- fresh policy and official-document review.

Gate: hosted Developer Mode verification passes, the production endpoint is observable and restart-safe, owner approval is explicit, and the plugin portal submission package is complete.

## 9. Deployment reference architecture

Keep the application portable with a containerized Node service and managed Postgres rather than coupling core code to one platform.

```text
Public HTTPS /mcp + /health + OAuth metadata
                 |
          Node application service
          |         |          |
       Postgres   object     telemetry
       events &   storage    logs/traces/
       snapshots  for assets metrics
```

Recommended deployment properties:

- one same-origin server for MCP and the bundled player widget initially;
- a separate Creator Studio web deployment only when Studio work begins;
- at least two application instances before public launch;
- database connection pooling and migrations as a release step;
- readiness separate from liveness;
- request and tool-call trace IDs propagated into domain events and AI usage records;
- no sticky-session dependency;
- CSP generated from an explicit production allowlist;
- secrets held in the hosting provider's secret manager;
- temporary tunnels limited to development, never submission.

Select the hosting vendor during Phase 6 using a short proof against: streaming behavior, OAuth metadata routing, Postgres integration, zero-downtime deploys, logs/traces, region choice, backups, operational ownership, and projected cost.

## 10. Validation strategy

### Per change

- typecheck affected packages;
- unit tests for each condition, effect, reducer transition, compiler rule, and projection;
- deterministic serialization snapshots where schemas are public;
- lint/format and package-boundary checks.

### Per milestone

- deterministic replay across process boundaries;
- property tests for invalid commands, duplicate mutations, and state-version conflicts;
- serialized secret-value scans for every audience;
- conformance simulations across all three synthetic genres;
- MCP descriptor and transport contract tests;
- widget accessibility, narrow/mobile, high-contrast, and reduced-motion checks;
- full Agency playthrough with intentional retries and stale versions;
- failure injection for database, provider timeout, invalid AI output, and fallback execution.

### Before deployment

- migration rehearsal against a production-like database;
- backup restore test;
- OAuth negative tests and cross-account authorization tests;
- CSP and security-header inspection;
- load test focused on tool latency and streaming connections;
- privacy export/deletion exercise;
- hosted Developer Mode walkthrough and fresh submission-policy check.

## 11. Initial backlog

The first implementation increment should be Phase 0 plus the smallest Phase 1 skeleton:

1. Copy the context pack into the working repository without altering its content.
2. Capture the prototype baseline and tool descriptors.
3. Add npm workspaces while preserving existing scripts.
4. Create `world-schema`, `engine-core`, and `projections` public entry points.
5. Define JSON-safe IDs, versions, state, command, condition, effect, event, save, and projection contracts.
6. Implement a minimal reducer supporting flags, bounded resources, and transitions.
7. Add state-version and mutation-id semantics before adding more mechanics.
8. Add secret-omission and replay tests before porting Agency content.
9. Add the three tiny conformance fixtures.
10. Stop at the Phase 1 gate and review the public contracts before beginning the compiler.

## 12. Decision register

### Accepted from the context pack

- pure deterministic engine before renderer;
- immutable published world versions;
- event log plus snapshots;
- capabilities rather than genre branches;
- AI downstream of deterministic mechanics;
- hidden data removed before projections;
- Storyframe source as an advanced, compiled authoring representation;
- explicit creator approval for semantic changes;
- original/licensed/public-domain rights metadata for public worlds.

### Proposed by this plan

- npm workspaces for the first extraction;
- an `application` package between host adapters and core/persistence;
- Retro React behind Storyframe `ui-kit` wrappers for the React player widget;
- same-origin MCP server and widget for the first hosted release;
- containerized Node plus managed Postgres as the portable deployment baseline;
- established OAuth 2.1 provider before durable personal saves;
- opaque session IDs authorized from request identity, never trusted player IDs;
- AI Director after generic ChatGPT mechanics, unless a compiler span requires an earlier fake-only contract.

### Decisions still needed

- initial release mode: private alpha versus immediate public directory target;
- identity provider and production hosting vendor;
- whether the first Creator Studio is single-owner only or needs collaboration roles;
- whether user-created worlds exist in the first hosted alpha or only the curated Agency world;
- asset storage/CDN choice after final asset sizes and CSP domains are known;
- production model tiers only after Storyframe evals exist.

None of these unresolved choices blocks Phase 0 or Phase 1.

## 13. Current official references

The plan was checked against current OpenAI documentation on August 1, 2026:

- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Define tools](https://developers.openai.com/plugins/plan/tools)
- [Plugin reference](https://developers.openai.com/plugins/reference)
- [Authentication](https://developers.openai.com/plugins/build/auth)
- [Examples](https://developers.openai.com/plugins/build/examples)
- [Submit plugins](https://developers.openai.com/plugins/deploy/submission)
- [Plugin guidelines](https://developers.openai.com/plugins/app-guidelines)

The current documentation uses **plugin** for the submitted bundle and describes the UI as an optional MCP Apps component. The implementation should use MCP Apps standard fields and bridge methods first, with ChatGPT-specific `window.openai` capabilities only when no standard equivalent exists.

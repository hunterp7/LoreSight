# Phase 1 Foundation Status

Status: gate passed  
Completed: August 1, 2026

## Delivered

- npm-compatible workspace layout with a reproducible lockfile
- `@storyframe/world-schema` host-independent contracts
- `@storyframe/engine-core` pure transactional runtime
- `@storyframe/projections` player, model, creator, and debug views
- `@storyframe/test-fixtures` investigation, survival, and trading worlds
- seeded deterministic checks
- ordered committed-turn events and deterministic replay
- monotonic `stateVersion` and `turn`
- expected-version concurrency rejection
- mutation-ID idempotency receipts
- bounded flags, resources, clocks, relationships, inventory, clues, knowledge, locations, canon reveals, transitions, endings, and character-ledger effects
- physical omission of inaccessible canon, state fields, owner identity, and ledger facts from player/model projections
- continued operation of the Agency-specific MCP prototype during migration

## Public APIs established

`@storyframe/engine-core`:

- `createSession(world, options)`
- `getAvailableIntents(world, state)`
- `evaluateCondition(condition, state)`
- `resolveTurn(input)`
- `applyCommittedEvent(world, state, event)`
- `replay(world, initialState, events)`
- `validateState(world, state)`

`@storyframe/projections`:

- `projectPlayerView(world, state)`
- `projectModelView(world, state)`
- `projectCreatorView(world, state)`
- `projectDebugView(world, state)`
- `projectView(world, state, audience)`

## Gate evidence

- Same seed, world, state, command, and mutation ID produce identical events and state.
- Replaying committed events reconstructs the same final state.
- Reusing a mutation ID returns a duplicate receipt without applying effects again.
- Stale expected versions and unknown intents leave state unchanged.
- An effect that would violate a bounded-state invariant rolls the whole turn back.
- Secret canon values, secret IDs, creator-only ledger entries, hidden state, and owner identity are absent from serialized player/model projections.
- Investigation, survival, and trading execute through the same reducer API.
- `engine-core` contains no Agency-specific identifiers.
- The legacy Agency build, tests, and six-tool live MCP smoke continue to pass.

## Validation results

| Command | Result |
|---|---|
| `npm ci` | Pass; 0 reported vulnerabilities |
| `npm run check` | Pass |
| `npm run build` | Pass |
| `npm test` | 12 passed, 0 failed |
| `npm run smoke` | Pass against local `/mcp` |

## Phase 2 entry gate

Phase 2 may begin with the Storyframe lexer/parser, typed AST, source locations, stable semantic ID generation, and deterministic compiler output. The hand-authored conformance fixtures must become compiler inputs without changing the Phase 1 runtime contracts or their mechanical results.

The compiler must stop before Agency migration until all three conformance worlds compile and the invalid-source, reachability, thread-payoff, ambiguous-invention, and secret-flow diagnostic tests are green.

# Codex Master Kickoff Prompt

Copy the prompt below into a fresh Codex thread opened at the repository root.

---

You are building Storyframe, a deployable turn-based narrative engine, Creator Studio, and ChatGPT plugin. The existing repository contains a working but Agency-specific MCP prototype plus architecture and UX specifications.

Read `AGENTS.md` and every file it requires before editing. Then inspect the repository and report the current architecture in no more than ten bullets.

Implement **Phase 1 only** from `handoff/03_IMPLEMENTATION_PLAN.md` unless completing it safely requires a narrowly related Phase 2 contract. Do not polish the existing Agency UI, add new Agency story content, deploy externally, or introduce authentication yet.

Required outcome:

1. Establish a workspace structure for pure `engine-core`, `world-schema`, and shared test fixtures while keeping the existing MCP prototype runnable during migration.
2. Define typed, host-independent contracts for world identity/version, game state, commands, conditions, effects, events, projections, character ledgers, saves, and deterministic seeded random operations.
3. Implement a pure reducer with transactional turn resolution, monotonic `stateVersion`, optimistic concurrency, and mutation-id idempotency.
4. Implement player/model/creator/debug projections that physically omit inaccessible secrets.
5. Add tiny synthetic conformance fixtures for investigation, travel/survival, and trading/economy mechanics. Do not use Agency-specific exceptions in the core.
6. Add deterministic replay, invalid-command, repeated-mutation, secret-projection, and character-ledger audience tests.
7. Keep `npm run check`, `npm run build`, and `npm test` passing. Preserve or intentionally adapt the existing smoke test.
8. Update documentation only where implementation establishes a concrete decision.

Before coding, state:

- the primary architecture you will implement;
- files/packages you will add or change;
- the minimum public APIs;
- the validation plan;
- any conflict you found in the supplied specifications.

After coding, provide:

- the outcome;
- tests and runtime validation performed;
- remaining architectural risks;
- the exact gate for beginning Phase 2.

Treat AI output as untrusted. Do not make live OpenAI API calls in Phase 1. Use a provider interface and deterministic fakes where future AI interpolation must be represented.

---

## Follow-up prompt after Phase 1 passes

Implement Phase 2 from `handoff/03_IMPLEMENTATION_PLAN.md`: the Storyframe parser/compiler and diagnostics. Preserve all Phase 1 invariants. Compile fixtures rather than hand-constructing their runtime packages where practical. Stop before migrating the production Agency adapter unless the compiler conformance gate is green.


# Repository Instructions


## Read before changing code

Read these files in order:

1. `handoff/00_START_HERE.md`
2. `docs/ARCHITECTURE_DECISIONS.md`
3. `docs/ENGINE_ARCHITECTURE.md`
4. `docs/STORYFRAME_LANGUAGE.md`
5. `docs/CREATOR_STUDIO_UX.md`
6. `docs/CANON.md`
7. `handoff/03_IMPLEMENTATION_PLAN.md`
8. `handoff/05_ACCEPTANCE_CRITERIA.md`

## Product invariants

- The engine contains no story-specific characters, setting, dialogue, IDs, or rules.
- Creators author meaning; AI may draft and perform only inside approved boundaries.
- Natural-language authoring produces a proposed semantic contract. Major changes require creator approval.
- Published world versions are immutable.
- `OPEN` means AI may invent. `UNSAID` means AI may not answer.
- Hidden facts must be removed before model or player projection, not merely hidden by prompts.
- Simulation state is server-authoritative, serializable, deterministic, and independent of React or MCP.
- Every committed turn produces events and a monotonic state version.
- Repeated mutation IDs must not apply a turn twice.
- AI generation failure must not make a world unplayable; use authored fallbacks.
- Character recaps are projections of structured ledgers, never summaries of raw chat history.

## Working method

- Work phase by phase. Do not begin Creator Studio polish before the core/compiler conformance gate passes.
- Prefer small, typed packages with explicit public APIs.
- Use stable semantic IDs; filenames and display labels are not engine keys.
- Keep game mechanics out of renderers and host adapters.
- Keep OpenAI/MCP-specific code out of `engine-core` and the Storyframe compiler.
- Treat AI output as untrusted structured input and validate it before display or persistence.
- Add or update tests with every new rule, state transition, compiler feature, or projection.
- Do not silently change canon. Put proposed world changes in a visible diff for creator approval.
- Preserve existing user work and unrelated changes.

## Current implementation status

The current `server/` and `web/` folders implement the LoreSight ChatGPT MCP host loop and terminal UI. Keep the MCP action surface generic; do not add story-specific semantics to server tools.

Use the existing deterministic fixtures as a behavioral reference while extracting reusable packages. Keep the player and admin flows working as the runtime evolves.

## Required verification

At minimum, keep these commands working during the transition:

```bash
npm run check
npm run build
npm test
```

When the MCP server is running, also run:

```bash
npm run smoke
```

New packages must add:

- compiler fixture tests;
- deterministic replay tests;
- secret-projection tests;
- invalid-command and idempotency tests;
- multiple synthetic conformance worlds covering survival, trading, travel, puzzles, and clocks;
- character-ledger audience tests.

## Documentation and current APIs

Before changing ChatGPT plugin/MCP integration, re-check the current official OpenAI plugin documentation. Do not rely on old Apps SDK terminology or wrapper APIs when current MCP Apps guidance differs.

Current baseline references are listed in `handoff/06_DEPLOYMENT_AND_OPENAI.md`.



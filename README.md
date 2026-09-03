# LoreSight — Interactive Fiction for ChatGPT

LoreSight is a ChatGPT-native interactive-fiction player and authoring platform. It loads standard Z-machine stories, keeps the original command-line interaction model, and adds a CRT presentation, story library, optional narration, and authoring tools.

## Codex handoff

Start with `AGENTS.md`, then read `handoff/00_START_HERE.md`. The `handoff/` folder contains the master Codex prompt, phased implementation plan, graphics brief, acceptance criteria, deployment guidance, and decision log.

The player chooses a story, types classic interactive-fiction commands, and can ask ChatGPT for a recap, controls, or optional narration without changing the story's canonical text.

## Architecture

The target architecture and binding decisions are documented before the next refactor:

- `docs/ENGINE_ARCHITECTURE.md` — engine, world-pack, canon, AI-director, persistence, and testing contracts
- `docs/ARCHITECTURE_DECISIONS.md` — concise binding decisions
- `docs/STORYFRAME_LANGUAGE.md` — proprietary narrative keyframe and AI interpolation language
- `docs/STORYFRAME_COMPILER_GUIDE.md` — executable grammar, compiler API, diagnostics, and author/tester workflow
- `docs/COMPILER_ARCHITECTURE.md` — lexer, AST, semantic compiler, validation, and source-map internals
- `docs/CREATOR_STUDIO_UX.md` — plain-language editor model that abstracts LoreSight and engine state
- `docs/STORY_DEBUGGING.md` — trace, audit, immutable correction-branch, and debugger UI architecture
- `docs/TESTING_GUIDE.md` — developer and tester workflows, commands, and expected results
- `docs/OPERATIONAL_OBSERVABILITY.md` — safe request correlation, structured logs, migration operation, and incident workflow
- `docs/FEEDBACK_AND_DIAGNOSTICS.md` — user-submitted feedback, privacy-bounded client diagnostics, storage, and operator access
- `docs/PRIVACY_AND_DATA_LIFECYCLE.md` — data inventory, owner export/deletion contracts, narration disclosure, and launch gates
- `docs/HOSTED_DEPLOYMENT_RUNBOOK.md` — provider-neutral release, migration, verification, rollback, and external stop conditions
- `docs/PUBLIC_LAUNCH_QUICKSTART.md` — shortest npm, tunnel, Render, and OpenAI directory path for LoreSight
- `docs/ADMIN_OPERATIONS.md` — remote access, operational scenarios, correction proposals, and deployment security
- `docs/CHATGPT_PLAYER_ADAPTER.md` — generic player projection, decoupled tools, retries, host state, and tester scenarios
- `docs/PLAYER_SHELLS_AND_THEMING.md` — default CRT, authored surrounds, safe theme tokens, Pixelarticons, and QA workflow
- `docs/VISUAL_ARTIFACTS.md` — text-first evidence model, authoring, projection, asset, and accessibility rules
- `docs/PRODUCTION_PERSISTENCE_AND_AUTH.md` — Postgres schema, application transactions, OAuth resource boundary, deployment, and QA workflow
- `docs/OPENAI_DIRECTOR_PROVIDER.md` — Responses API adapter, strict output contract, safe telemetry, configuration, and live-eval workflow
- `docs/SUBMISSION_READINESS.md` — generated import artifact, review checks, test coverage, and launch blockers
- `worlds/conformance/` — deterministic authoring fixtures used by the admin test suite

Foundation and Phase 2 narrative-tooling packages now available:

- `packages/world-schema/` — host-independent world, state, command, effect, event, save, and ledger contracts
- `packages/engine-core/` — pure transactional reducer, seeded checks, idempotency, and replay
- `packages/projections/` — physically separate player, model, creator, and debug views
- `packages/ai-director/` — provider-neutral performance generation, validation, beat progress, bounded repair, and authored fallbacks
- `packages/application/` — owner-scoped use cases, replay verification, optimistic commits, and safe projections
- `packages/persistence/` — repository contracts, Postgres migration/queries, immutable releases, events, performances, and audit history
- `packages/auth/` — OAuth resource-server claim, audience, lifetime, and scope enforcement
- `packages/story-debugger/` — explainable traces, storyline audits, authored-test execution, bounded branch coverage, correction branches, and state diffs
- `packages/storyframe/` — lexer/parser and semantic compiler for mechanics, TweenContracts, threads, choices, authored tests, diagnostics, graph validation, and source maps
- `admin/` — authenticated React operations console using LoreSight wrappers over Retro React
- `packages/test-fixtures/` — investigation, survival, and trading conformance worlds

- `server/` — TypeScript MCP server and authoritative story engine
- `web/` — React personnel-terminal widget
- `docs/CANON.md` — immutable world and character rules
- `docs/PRODUCT.md` — release scope and commercial boundary
- `tests/` — deterministic story-path tests

The server owns canonical state. ChatGPT maps free-form responses to bounded semantic intents. The widget renders a filtered LoreSight player view and calls the single generic mutation tool through the MCP Apps bridge; it never consumes raw game state.

The deterministic game remains playable without an OpenAI API key. `OPENAI_API_KEY` is required only for opt-in generated narration and the disabled-by-default OpenAI Director provider; authored fallback text remains available when generation is disabled or fails.

The production plugin widget is React-based and uses [Retro React](https://github.com/retro-react/retro-react) only behind Storyframe-owned UI wrappers. Retro React 1.6 powers both the player primitives and private-alpha admin wrappers while Storyframe owns accessibility, theme tokens, MCP state, and game behavior.

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm test
pnpm start
```

The repository uses pnpm 11.19.0 (declared in `package.json`) as the reproducible
install path. The two public player surfaces are available at `/widget` for the
ChatGPT host and `/desk` for the standalone browser experience; the admin and
launch-pad routes are private operations surfaces.

The MCP endpoint is available at:

```text
http://localhost:8787/mcp
```

Health check:

```text
http://localhost:8787/health
```

With the server running, validate the live MCP handshake in a second terminal:

```bash
npm run smoke
```

Run the narrative debugger walkthrough:

```bash
npm run debug:example
```

It deliberately reaches a diagnostic dead end, identifies its authored source frame, then forks the immutable save and simulates a replacement turn. See `docs/STORY_DEBUGGING.md` for interpreting the report.

Compile a Storyframe world and print a summary:

```bash
npm run storyframe:compile -- worlds/conformance/investigation.storyframe
```

Print the deterministic `WorldPack` JSON:

```bash
npm run storyframe:compile -- worlds/conformance/investigation.storyframe --json
```

## Remote operations console

Configure a long private-alpha token before starting the server:

```bash
STORYFRAME_ADMIN_TOKEN="replace-with-at-least-24-random-characters" npm run dev
```

Open `http://localhost:8787/admin`. The API remains disabled when the token is absent, and production mode rejects admin API traffic that is not forwarded over HTTPS.

The console's plain-language information hierarchy and semantic Pixelarticons rules are documented in `docs/ADMIN_UI_AND_GRAPHICS.md`.

For player-UI design feedback, open `http://localhost:8787/widget`. The standalone conceptual preview can switch between ChatGPT inline, fullscreen, and PiP layouts and uses a labeled local simulation when no MCP Apps host is present. See `docs/PLAYER_UI_CONCEPT.md`.

For a safe, fifth-grade-readable deployment walkthrough, open `http://localhost:8787/launch-pad`. Every action on that page is a simulation: it explains the matching command but cannot run commands, spend money, alter infrastructure, or publish LoreSight.

For the password-protected dashboard that runs approved local checks and shows live output, open `http://localhost:8787/admin?view=launch`.

The CRT player also includes opt-in generated narration and five locally bundled binaural MP3 tracks. Audio starts only after a user gesture and initializes at 50% volume. Setup, playback behavior, security boundaries, licensing, and tester instructions are documented in `docs/AUDIO_GUIDE.md`.

The current bearer-token mode is for local development and controlled private access. Public production requires OAuth/OIDC, MFA, roles, durable audit history, revocation, and rate limiting. See `docs/ADMIN_OPERATIONS.md`.

## Test in ChatGPT

1. Start the server locally.
2. Expose port `8787` through a public HTTPS tunnel such as `ngrok http 8787`.
3. In ChatGPT, open **Settings → Apps & Connectors → Advanced settings** and enable Developer Mode.
4. Create a new app and enter the tunnel URL ending in `/mcp`.
5. Start a new conversation and ask: “Open LoreSight and show me the story library.”
6. Refresh the app connection after changing tool schemas, descriptions, or widget metadata.

## Expected tool sequence

1. `start_story_session`
2. `list_story_library` when the player wants to browse available stories
3. `open_story_interface` with the returned session ID
4. `submit_story_command` for a typed command, guarded by the returned state version
5. `get_story_state` or `get_story_recap` when the player asks for current status

The model should keep the user's active story in view, use the terminal for commands, and never invent story state that the interpreter has not returned.

## Current limitations

- State is held in memory and is lost when the process restarts.
- `sessionId` is passed between tools rather than derived from authenticated identity.
- Z-machine execution currently lives in the mounted browser interpreter; the MCP command action is the synchronization seam for moving execution server-side later.
- Public deployment, authentication, durable storage, privacy/support pages, and directory submission artifacts are not yet configured.

## Official implementation references

- [MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)
- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [Add UI to an MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Define tools](https://developers.openai.com/plugins/plan/tools)
- [Plugin guidelines](https://developers.openai.com/plugins/app-guidelines)

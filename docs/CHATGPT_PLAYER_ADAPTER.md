# ChatGPT Player Adapter

Status: compiled-world application path implemented  
Updated: August 3, 2026  
Audience: ChatGPT app developers, engine developers, QA, and operators

## Purpose

The player adapter is the trust boundary between an authoritative story runtime and the React widget. The widget never receives a raw save, creator/debug projection, unreleased artifact, rule graph, or world source map. It receives a generic `StoryframePlayerView` that contains only the current player-visible presentation and legal actions.

`server/src/player-view.ts` now compiles `worlds/the-agency/applicant-intake.storyframe` and drives it through `StoryApplicationService`, `engine-core`, safe projections, an event log, mutation receipts, and an owner-scoped repository. The legacy engine remains only as a separately labelled admin reference until its old operational records are retired.

## App shape

Storyframe uses the interactive-decoupled MCP Apps pattern:

```text
ChatGPT conversation
  -> start_story_session / get_story_state / submit_story_intent
  -> authoritative runtime
  -> player adapter and release filtering
  -> StoryframePlayerView

open_story_interface
  -> attaches ui://widget/storyframe-player-v5.html once
  -> mounted React widget calls submit_story_intent
  -> returned PlayerView replaces the rendered snapshot
```

Only `open_story_interface` declares `_meta.ui.resourceUri`. Data and mutation tools never attach a widget, which prevents a fresh iframe from being created for every turn.

## Tool contract

| Tool | Purpose | Mutates | Available to widget | Attaches UI |
|---|---|---:|---:|---:|
| `start_story_session` | Begin a supported world | Yes | No | No |
| `get_story_state` | Retrieve current player projection | No | No | No |
| `get_character_recap` | Retrieve player-visible character facts | No | No | No |
| `get_world_recap` | Retrieve the current visible moment, facts, and clues | No | No | No |
| `submit_story_intent` | Apply one currently legal semantic intent | Yes | Yes | No |
| `open_story_interface` | Render the persistent CRT for a session | No | No | Yes |
| `generate_story_narration` | Generate opt-in narration for visible copy | No | Yes | No |

Descriptions, schemas, and annotations are part of the public ChatGPT behavior. New tools should use generic narrative language unless they are intentionally world-specific application capabilities.

## PlayerView contract

`StoryframePlayerView` has four top-level concerns:

- `session`: stable session/world identity, monotonic `stateVersion`, and terminal status;
- `presentation`: world-supplied title, current narrative, objective, progress, layout hint, atmosphere, and footer copy;
- `availableIntents`: semantic IDs with player-facing titles, descriptions, and renderer kind;
- `artifacts`: released, text-complete evidence only, with reviewed state and optional accessible visual presentation.

An optional `ending` is present only after completion. The contract deliberately does not contain the legacy `stage`, `playerId`, `availableActions`, hidden `visible` flags, response history, creator diagnostics, or unreleased artifact definitions.

The widget branches on generic presentation hints (`focus`, `investigation`, `decision`, `complete`) and intent kinds (`primary`, `inspect`, `decision`). World-specific copy and ASCII artifact content are created by the adapter, not hard-coded into React.

## Mutation safety

Every component action sends:

- `sessionId` — authoritative session target;
- `intentId` — semantic action selected from `availableIntents`;
- `expectedStateVersion` — snapshot version the player acted on;
- `mutationId` — UUID generated once for that submission.

The adapter checks duplicate mutation IDs before checking state version. A retry with the same mutation ID returns the original view with `status: duplicate` and never advances the story twice. A stale but new action returns `status: rejected`, `code: version-conflict`, and the latest authoritative player view. React replaces its snapshot and shows a short recovery message.

Mutation receipts now live inside deterministic `GameState` and replay with committed events. The local server uses `MemoryStoryframeRepository`; the production Postgres implementation preserves the same contract across restart and multiple app instances once it is bound at deployment.

## Widget-only state

Selected artifact and preferred display mode are non-authoritative UI preferences. In ChatGPT they are mirrored to `window.openai.setWidgetState` after meaningful changes and restored from `window.openai.widgetState` on mount.

These values never determine whether an artifact is released, whether an intent is legal, or what ending occurred. Hosts without the ChatGPT widget-state extension use normal in-memory React state.

## Failure and recovery behavior

- **Busy:** action controls are disabled while a component tool call is pending.
- **Version conflict:** latest server view is applied and an inline recovery message is shown.
- **Unavailable intent:** authoritative view is retained and the rejection is explained.
- **Transport failure:** the current view stays readable and a retry message appears.
- **Narration failure:** textual play continues and local background tracks remain available.
- **Standalone preview:** the labeled browser simulation applies the same view contract locally; it is never authoritative production state.

## Developer workflow

1. Run `npm run check`, `npm run build`, and `npm test`.
2. Start the MCP server and run `npm run smoke` in another terminal.
3. Confirm tool discovery returns exactly one UI-linked tool: `open_story_interface`.
4. Open `http://127.0.0.1:8787/widget` for fast visual feedback.
5. In ChatGPT Developer Mode, call `start_story_session`, then `open_story_interface` with the returned session ID.
6. Exercise a full story through buttons and conversational intents. Refresh the app connection after descriptor or resource-URI changes.

## Tester scenarios

1. **Initial disclosure:** verify only the first three released clues exist in the payload; the final note is absent, not hidden with CSS.
2. **Retry:** resend the same `submit_story_intent` body and mutation ID; verify the status is `duplicate` and `stateVersion` does not increment.
3. **Conflict:** submit two different actions from the same state version; verify the second returns `version-conflict` plus the latest view.
4. **Persistent iframe:** confirm component actions update the mounted CRT without creating another widget card.
5. **Host state:** select a clue and display mode, trigger a host re-render, and confirm both preferences return without affecting story state.
6. **Accessibility:** complete the case using keyboard controls, inspect the ASCII clue through its accessible label, and repeat with reduced motion.

## Security rules

- Treat every tool argument as untrusted.
- Authorize the session before resolving a production action; host metadata is not authorization.
- Project secrets out before constructing `structuredContent`.
- Keep creator/debug data out of player tool results and widget state.
- Keep API credentials server-side; `_meta` is widget-only but is not a secret store.
- Rate-limit narration and mutation endpoints before public deployment.

## Next migration work

1. Add generic character and world recap tools from existing safe projections.
2. Bind the implemented Postgres queries and migration to the selected managed database and migration runner.
3. Configure the implemented OAuth/JWKS actor context with the production identity provider.
4. Retire the legacy Agency engine after admin/history migration no longer depends on it.
5. Exercise host sizing, state restoration, OAuth, and PiP lifecycle in real ChatGPT Developer Mode over the final HTTPS origin.

# ChatGPT-aligned inline actions

Status: Phase 2 implemented; Phase 3 in progress  
Scope: the action surface below the inline LoreSight CRT card

## Decision

LoreSight should replace its bespoke `.native-action-bar` styling with
ChatGPT-aligned button components from `@openai/apps-sdk-ui`, rendered inside
the MCP Apps iframe. The two inline primary actions will be:

1. **Library** — opens the LoreSight library through `open_story_library`.
2. **Load** — opens the local Z-machine file flow through `load_story_file`.

The CRT remains the story surface. The action row remains outside the CRT
screen, as a compact card action area.

“Native ChatGPT button” needs a precise meaning here. The Apps SDK does not
provide a supported API for inserting arbitrary controls into ChatGPT’s
surrounding transcript UI. `@openai/apps-sdk-ui` provides ready-made controls
that match ChatGPT’s container, but they still render inside the app iframe.
ChatGPT owns the surrounding composer, system close affordance, and card
chrome. We should not attempt DOM escape hatches or iframe overlays.

## Why this fits the current Apps SDK

The current app is an `interactive-decoupled` React widget: the server exposes
generic MCP tools and a single persistent UI resource, while the widget owns
temporary presentation state. The migration keeps that architecture intact:

```text
ChatGPT conversation
        │ model invokes or user taps app action
        ▼
MCP tool: open_story_library / load_story_file
        │ concise structuredContent: { action }
        ▼
LoreSight iframe
  Apps SDK UI Button → MCP Apps tools/call
  local preview fallback → CustomEvent
        ▼
CRT state remains mounted; library/file picker opens
```

The official guidance recommends the shared MCP Apps bridge first, with
`window.openai` compatibility extensions only where they add value. It also
limits inline cards to one primary and one optional secondary action and
discourages nested navigation or duplicated ChatGPT inputs.

## Current state and target state

| Area | Current | Target |
| --- | --- | --- |
| Rendering | Custom HTML buttons with `.native-action-bar` CSS | `@openai/apps-sdk-ui` buttons in a small action group |
| Primary actions | Library, Load, Play sample, plus utilities | Library + Load only in inline mode |
| Invocation | Follow-up message plus local event | MCP Apps `tools/call`; `ui/message` only for conversational follow-up |
| Preview behavior | Custom events are the main local path | Custom events are an explicit no-host fallback |
| Fullscreen utilities | Mixed into the same rail | CRT/gamepad and host-aware controls remain fullscreen-specific |
| State | App-local theme/session UI state | Same widget state, with action status and busy state included where useful |

Play sample, Settings, Controls, Restart, and display-mode switching should not
compete with the two inline CTAs. They remain available through conversation,
fullscreen controls, or the appropriate in-widget/settings surface. If product
testing proves Play sample must stay visible on the landing card, it should be
a separate non-primary affordance only after the two-button version is tested.

## Implementation phases

### Phase 0 — Contract and capability spike

- Confirm the installed `@openai/apps-sdk-ui` version and its actual Button,
  ButtonGroup, and loading/disabled-state exports.
- Do not assume component names from examples; compile a tiny isolated React
  spike first.
- Confirm the current `@modelcontextprotocol/ext-apps` bridge can issue
  `tools/call` from the widget and receive `ui/notifications/tool-result`.
- Define an `ActionCapability` adapter that feature-detects the shared bridge,
  `window.openai.callTool`, and local preview mode.

Deliverable: a type-checked button spike and a bridge test fixture; no product
UI replacement yet.

### Phase 1 — Action adapter

Implemented in `web/src/app-actions.ts` with typed actions:

```ts
type LoreSightAction = "library" | "load";

invokeLoreSightAction(action: LoreSightAction, app: App | null): Promise<"mcp" | "openai" | "local">;
```

Routing order:

1. MCP Apps `tools/call` for `open_story_library` or `load_story_file`.
2. `window.openai.callTool` as the ChatGPT compatibility alias.
3. Local `storyframe:*` event dispatch for browser preview and compatible hosts.

The adapter dispatches the resolved action event exactly once and keeps the
CRT mounted. Button state is owned by the player so the action is disabled
while its tool call is pending. Errors fall through to the explicit local
preview path instead of replacing the story.

### Phase 2 — Replace the inline rail

- The inline Library and Load actions now use `@openai/apps-sdk-ui`'s `Button`
  component with primary/secondary variants, loading states, focus handling,
  and ChatGPT-aligned sizing. The action contract remains isolated from MCP and
  story runtime code.
- Render exactly two buttons in inline landing state: Library (primary) and
  Load (secondary).
- Use accessible names and explicit `aria-busy`/disabled behavior during tool
  calls.
- Keep no CRT-screen duplicate buttons for these actions.
- Remove the bespoke `.native-action-bar` visual rules after the new component
  is verified.

The component should accept semantic callbacks rather than know about
`open_story_library`, local file input, or renderer internals.

### Phase 3 — Server and metadata alignment

- Retain `open_story_library` and `load_story_file` as generic MCP actions.
- Verify their output schemas exactly match the returned `{ action }` payload.
- Add concise `openai/toolInvocation/invoking` and `invoked` status metadata if
  supported by the current server package.
- Keep action tools UI-callable through standard `_meta.ui.visibility` and do
  not attach the widget resource to action tools; only render/open tools own
  the persistent UI resource.
- Preserve server authority: local file bytes stay in the widget; story
  simulation state stays on the server/runtime boundary.

### Phase 4 — State and host behavior

- Preserve the mounted CRT and active story state after Library/Load actions.
- Persist only non-authoritative UI preferences with `window.openai.widgetState`.
- Do not put story progress, command history, or authoritative saves in widget
  state.
- Keep `window.openai.sendFollowUpMessage` only for an explicit conversational
  “ask LoreSight to…” action; it is not a substitute for button invocation.
- In fullscreen, respect the existing host `maxHeight` and `safeArea` layout
  handling. Do not duplicate ChatGPT’s composer.

### Phase 5 — Remove compatibility scaffolding after acceptance

- Keep the local event fallback behind a clearly named `isLocalPreview` path.
- Remove the old toolbar class names and “native” terminology that implies
  host-level buttons.
- Rename the documentation to “ChatGPT-aligned inline actions” and record
  the host/iframe boundary.

## Verification plan

### Automated

- Type-check the Apps SDK UI import and build the widget bundle.
- Unit-test action routing for shared bridge, `window.openai.callTool`, and
  local preview fallback.
- Test duplicate tool-result + local-event delivery opens each surface once.
- Test disabled/loading/error states and keyboard activation.
- Assert inline markup contains exactly two primary action controls and no
  legacy `.native-action-bar` production class.
- Run the repository gates: `npm run check`, `npm run build`, `npm test`.

### ChatGPT Developer Mode

1. Restart the MCP server so its widget resource is reloaded.
2. Refresh the app in ChatGPT Developer Mode.
3. Invoke LoreSight and verify the CRT card has only Library and Load below it.
4. Tap Library; verify the model-visible tool call is
   `open_story_library` and the mounted widget opens its library without
   remounting the CRT.
5. Tap Load; verify the local file picker opens and no file bytes are sent to
   the server before the user selects a file.
6. Test keyboard focus, disabled states, tool errors, mobile width, dark/light
   host themes, and transition to fullscreen.
7. Confirm the ChatGPT composer remains available and is not duplicated by
   LoreSight.

## Acceptance criteria

- The action row visually belongs to the ChatGPT card container, not the CRT
  glass or a second application toolbar.
- Inline has no more than two primary actions: Library and Load.
- Both actions work through MCP Apps hosts and local preview.
- The CRT transcript, scroll position, focus, and active story survive action
  completion.
- No unsupported DOM access, transcript-level button injection, or duplicated
  ChatGPT composer is introduced.
- The server remains generic and contains no renderer-specific or story-specific
  action logic.
- Existing fullscreen host-safe-area behavior remains intact.

## Official references

- [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Inline card UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines#inline-card)
- [Apps SDK component library](https://openai.github.io/apps-sdk-ui/)
- [Component bridge capabilities](https://developers.openai.com/plugins/reference#capabilities)

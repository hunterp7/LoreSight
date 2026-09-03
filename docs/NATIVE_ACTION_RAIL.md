# Native action rail

The LoreSight widget treats the CRT as a story surface, not an application
toolbar. Core actions are rendered in `.native-action-bar`, outside
`PlayerShell`, so ChatGPT's inline-card host can keep actions visually and
semantically separate from the interpreter canvas.

## Action model

- `Load story` calls the generic `load_story_file` MCP tool through the MCP Apps
  `tools/call` bridge, then dispatches `storyframe:load-file` to open the local
  `.z*` file picker. `window.openai.callTool` is the compatibility path.
- `Play sample` dispatches `storyframe:load-sample` and boots the bundled story.
- `Library` calls the generic `open_story_library` MCP tool through the MCP Apps
  `tools/call` bridge, then dispatches `storyframe:open-library` for the local
  library view. `window.openai.callTool` is the compatibility path.
- `Restart` dispatches `storyframe:restart` after a story has loaded.
- `Settings` opens the host-level settings surface.
- `Inline` / `Fullscreen` calls `window.openai.requestDisplayMode` when available.

Settings, Controls, and Story Library now share the same `CrtPageOverlay`
container. Opening any of these level-two pages changes the external action
rail to the same Back action; Back clears the corresponding page state in the
parent player and the overlay closes without remounting the CRT. Library is
lifted into the parent player state for this purpose, so its navigation is
consistent with Settings and Controls.

`Load story` and `Library` are the two primary calls to action. The remaining
controls are deliberately lower-emphasis utilities, matching the
Apps SDK inline-card guidance to keep primary actions focused and avoid
nesting application navigation inside the card.

The action adapter no longer sends follow-up messages for button clicks. The
button invokes the tool directly, which is the supported Apps SDK action path;
the local event is only a preview/legacy-host fallback. `sendFollowUpMessage`
remains available for explicit conversational requests, not UI button wiring.

## Integration boundary

`ClassicIfSurface` listens for the action events but does not paint those
controls. This keeps the same actions available in local preview and in a
ChatGPT host while allowing the renderer to use the complete glass area for
story text, cursor, scrolling, and visual effects.

When the widget is fullscreen, the rail is positioned as a host-like fixed
surface at the bottom of the viewport. In inline mode it sits directly below
the CRT card, matching the native action placement used by ChatGPT inline
cards.

## Validation

The local browser smoke test verified that the production bundle renders zero
`.crt-top-toolbar` buttons, renders the external action rail, and that
`Play sample` transitions the interpreter to `.has-runtime` while preserving
the rail.

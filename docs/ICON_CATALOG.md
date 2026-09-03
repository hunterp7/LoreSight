# LoreSight icon catalog

This inventory records the iconography in the player and admin surfaces and the
corresponding `pixelarticons` choice. Icons are reserved for navigation,
actions, and recognizable objects; interactive-fiction commands such as `N`,
`SEARCH`, and `OPEN` remain text because the command itself is the affordance.

## Player

| Surface | Current treatment | Pixelarticons replacement | Decision |
| --- | --- | --- | --- |
| Back floating action | Unicode left arrow (`←`) | `ArrowLeft` | Implemented; keeps the compact CRT silhouette while improving rendering and accessible sizing. |
| Fullscreen / inline floating action | Unicode diagonal arrows (`↗`, `↙`) | `Expand` | Implemented; one stable resize glyph avoids inconsistent Unicode fonts between hosts. |
| Bubble menu toggle | Two CSS bars | `Menu` | Implemented; uses the library's pixel geometry and inherits the CRT ink color. |
| Story objects | Mixed hand-selected SVG icons | Existing `game-object-icon.tsx` map | Already implemented with `pixelarticons`: `Archive`, `AudioWaveform`, `Backpack`, `BookOpen`, `ClipboardNote`, `Coins`, `FileText`, `Grid3x3`, `Image`, `MapPin`, `Package`, `Potion`, `ScrollVertical`, `ToolCase`, and `User`. |
| Gamepad commands | Text labels (`N`, `LOOK`, `TAKE`, etc.) | None | Keep text; replacing command words with pictures would reduce discoverability for IF players and keyboard users. |
| Prompt and cursor | `>` and block cursor | None | Keep terminal semantics; these are renderer output, not UI icons. |
| Authored shell ornament | `◆` | None | Decorative, non-interactive ornament; not an affordance. |

## Admin

The admin icon registry in `admin/src/icons.tsx` already uses `pixelarticons`
for all of its navigation and status symbols. Current mappings include:

| Meaning | Icon |
| --- | --- |
| Home | `Home` |
| Playtests | `TestTube` |
| Studio / drafts | `FileText` |
| Clues / imagery | `Image` |
| Help | `BookOpen` |
| Themes / repair | `Undo` |
| Connect | `Globe` |
| Check, error, lock, refresh, search | `Check`, `WarningDiamond`, `Lock`, `Reload`, `Search` |
| Artifact types | `Archive`, `FileText`, `MapPin`, `Notes`, `Image`, `Undo` |

## Review notes

- `@openai/apps-sdk-ui` supplies host-compatible UI primitives and CSS, but it
  is not used as the icon source.
- No second icon package is needed. Keeping one pixel icon vocabulary prevents
  mixed stroke weights across the CRT and admin surfaces.
- Future additions should first check `node_modules/pixelarticons/react` and
  add a semantic mapping to this document before introducing a custom glyph.

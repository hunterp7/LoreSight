# Physical bezel controls

The supplied CRT artwork includes a four-button action deck in its lower bezel. The artwork is intentionally kept as a visual asset; interaction is provided by a semantic HTML overlay in `web/src/player-shell.tsx`.

## Interaction contract

| Position | Accessible action | Event | Host behavior |
| --- | --- | --- | --- |
| 1 | Imagine a new story | `storyframe:open-create` | Opens the Create surface |
| 2 | Remix a story | `storyframe:open-remix` | Opens the Remix surface |
| 3 | Play Z-machine files | `storyframe:open-load` | Opens the local `.z*` file picker |
| 4 | Browse Library | `storyframe:open-library` | Opens the story catalog |

The overlay is rendered only in inline mode. Fullscreen uses the glass-only shell and intentionally suppresses the physical deck. Each button handles pointer down/cancel/up for a pressed state and plays a short synthesized click tone on activation. Audio is best-effort: browser autoplay or device policies may mute it without preventing the action.

## Geometry

The hit targets use percentages of the `1487 × 1058` bezel artwork (`left: 4.6%`, `right: 4.6%`, `bottom: 1.1%`, `height: 15.2%`) and a four-column grid. This keeps them aligned as the monitor scales while preserving the artwork's aspect ratio.

When the bezel artwork is replaced, update the percentage geometry against the new source image and rerun the inline physical-button test in the interaction matrix.

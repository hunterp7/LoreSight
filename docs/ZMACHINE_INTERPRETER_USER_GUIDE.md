# Z-machine interpreter user guide

The player is a retro terminal for playing Z-machine interactive fiction. The interpreter is always the active story surface; the host only changes how much of the CRT presentation is visible.

## How to use it

1. Open the player preview at `http://localhost:8787/widget`.
2. Choose `Inline` for the framed CRT monitor or `Fullscreen` for the screen-only view.
3. Choose a screen color: `Orange`, `Green`, or `Blue`.
4. Click `Load story` and choose a local Z-machine story file.
5. Type commands at the `>` prompt and press Enter.

## What to expect

- Inline shows the complete CRT housing around the transcript.
- Fullscreen fills the viewport with the curved screen treatment and keeps only the transcript and command field.
- The color choice changes phosphor color, glow, scanlines, and screen tint while preserving contrast and layout.
- The prompt accepts normal text commands.
- If a story requests a single key, typing one character is enough.
- Restart returns the story to its original start state.

## Helpful tester notes

- Use the debug section if you need to confirm what the engine thinks is happening.
- If a story seems to stall, check whether it is waiting for a line command or a single key.
- The first pass is optimized for playability and diagnosis, not every possible Glk feature.

## Known gaps

- Browser save/restore is not complete yet.
- File prompts are not interactive in this preview and will auto-cancel.
- Some stories with heavier Glk requirements may need follow-up work.

## URLs

- Player widget: `http://localhost:8787/widget`
- Admin UI: `http://localhost:8787/admin`

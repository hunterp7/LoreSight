# Z-machine interpreter architecture

This project now has a separate classic interactive fiction surface in addition to the existing Storyframe narrative view.

The goal of this layer is to make the Z-machine runtime feel like a real game surface first, while keeping the modern enhancements as optional overlays rather than replacing the original fiction format.

## What runs where

- The story runtime lives in the browser bundle under `web/src/classic-if.tsx`.
- The interpreter engine is selected through the `InterpreterAdapter` seam in `web/src/interpreter-adapter.ts`.
- The current adapter is `ifvms`, wrapped by a small browser Glk bridge.
- A future `emglken`/Parchment adapter can be introduced without changing the CRT surface, transcript model, or keyboard routing.
- The CRT shell stays mostly presentational in `web/src/player-shell.tsx` and `web/src/styles.css`.

## Runtime model

The browser bridge owns the game session state:

- loaded story metadata
- transcript lines
- current input request
- command history
- simple status line output
- debug fields for testers

The interpreter is restarted from the original uploaded story buffer when the user chooses Restart. That gives us a reliable baseline even before save/restore support is added.

## Adapter migration plan

The first adapter boundary is intentionally small: VM creation, bridge ownership, and runtime capability metadata. The next adapter should target Parchment's underlying `emglken` runtime rather than embedding Parchment's Svelte player. Its Glk events will be normalized into the existing transcript/request model, allowing LoreSight to retain its WebGL CRT presentation and augmentation layers. Parchment remains the behavioral reference for broader Glk, save/restore, audio, and non-Z-Code format support while licensing for bundled upstream interpreters is reviewed.

## Supported story inputs

The current browser player accepts local story files:

- `.z3`
- `.z5`
- `.z8`
- `.zblorb`
- `.blorb`
- `.blb`

The upload path is local-only and intended for testing, authoring, and enthusiast play.

## UI decisions

- The classic IF mode is designed to be readable first, not technically dense.
- The prompt, transcript, and debug panel are visible but lightweight.
- The default CRT shell is still used so the scene feels like a retro terminal rather than a generic app.
- The status line is surfaced separately so games that use it remain legible.

## Current limitations

The first shipping pass is intentionally narrow:

- save/restore prompts are not fully wired to browser file handling yet
- file prompts auto-cancel in the browser preview
- the bridge is focused on line input, char input, text output, and basic status rendering
- advanced Glk features are stubbed or ignored until a story needs them

That keeps the first playable path stable while we harden the rest.

## Local preview URLs

- Player widget: `http://localhost:8787/widget`
- Admin UI: `http://localhost:8787/admin`

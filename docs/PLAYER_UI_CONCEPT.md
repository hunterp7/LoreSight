# Storyframe ChatGPT Player UI Concept

Status: interactive decoupled player implemented for local feedback  
Updated: August 2, 2026  
Audience: product, design, world creators, frontend developers, and playtesters

## Product position

The primary experience remains a conversation with ChatGPT. The widget is a persistent, server-authored story surface that makes current state, consequential choices, and occasional visual evidence easier to understand. It must not become a second chat transcript, a generic dashboard, or the authority for game mechanics.

The current concept uses The Agency as a visual conformance world. Its layout is intended to become a generic Storyframe player shell whose color accent, terminology, artifact treatment, and world title come from compiled presentation metadata.

## Chosen ChatGPT app shape

The app is an interactive, decoupled React widget:

- generic intent-focused MCP tools remain usable without UI;
- `open_story_interface` is the only render tool and the only tool linked to the CRT resource;
- the widget receives concise server snapshots through `structuredContent`;
- component actions call bounded MCP tools and replace local state only with returned server state;
- `stateVersion` remains the monotonic update token;
- a standalone local simulation supports rapid design feedback without becoming a production state source.

The generic integration is implemented through `StoryframePlayerView`; its current adapter maps the legacy Agency session until the complete compiled-world migration replaces that backend.

## Presentation hierarchy

### First-minute comprehension

The opening teaches the fiction before exposing its systems. It uses only two world-specific concepts—`The Agency` and `your case`—and presents two plain-language choices at a time. The first two questions occupy a single column with no clue rail, ticker, record terminology, staff titles, department names, or procedural language. Clues appear only after those questions establish why the player should care.

Later screens may deepen the vocabulary, but UI labels stay ordinary (`clue`, `note`, `open`, `keep`, `give back`). Authored terminology belongs inside the clue itself and should be introduced in context, not used as navigation the player must translate.

### Inline

Inline is a focused narrative card inside the conversation. It contains:

- world/case identity;
- current stage and compact progress;
- one current narrative moment;
- one objective;
- no more than two primary actions: the next contextual action and Expand.

It deliberately has no tabs, nested scrolling, evidence browser, product store, or multi-pane navigation.

### Picture-in-picture

PiP is a minimal persistent story pulse while the player continues speaking with ChatGPT. It contains the case identity, current story headline, latest Caseworker line, and an Expand action. It should close automatically when the session becomes terminal once host lifecycle support is connected.

### Fullscreen

Fullscreen is the deeper case-file surface. ChatGPT's composer remains the natural-language control plane. The widget adds:

- the active narrative moment and contextual mechanical actions;
- a released-evidence index;
- one selected text-first evidence document;
- final disposition choices when the engine reaches resolution;
- the same state version and server ownership boundary as inline mode.

Fullscreen deepens the current story task; it does not reproduce Creator Studio, admin operations, settings, or a world marketplace.

## Visual direction

The concept places a “misfiled institutional dossier” interface inside a physical CRT monitor. The monitor establishes the fiction; the screen content stays text-led and task-focused:

- fullscreen renders the complete set, including the rear housing, speakers, bronze screen trim, GPT1408 badge, hardware controls, power light, and swivel base;
- inline and PiP crop the set down to the bezel and glass so the visual metaphor does not consume the host surface;
- the display is strictly monochrome amber: one phosphor color, one dark field, and opacity—not hue—to establish hierarchy;
- evidence stays textual and is drawn as character-cell record buffers rather than paper facsimiles;
- occasional clues use ASCII, box-drawing characters, single-color iconography, or minimal vector lines that could plausibly be produced by the terminal;
- light/dark host adaptation applies outside the set, while the fictional screen retains its authored palette;
- Retro React `Button` and decorative `Marquee` remain behind Storyframe wrappers.

The physical design is derived from the supplied Figma frame, `Untitled`, node `11:6`. Three exact SVG details are stored locally in `web/src/assets`: the glass cutout, headphone port, and power LED. The remaining chassis is responsive CSS so it can adapt to ChatGPT presentation modes without raster scaling or shipping a single large screenshot. These assets are bundled as data URLs into the self-contained widget HTML.

The physical surround is now a replaceable `PlayerShell`. Worlds may retain the default CRT or provide a constrained authored surround through presentation metadata. The amber terminal, story hierarchy, interaction semantics, and accessibility rules remain stable inside either shell. The local preview exposes both options for feedback; see `PLAYER_SHELLS_AND_THEMING.md`.

The display adds restrained phosphor bloom and scanlines, but readability wins over simulation fidelity. The marquee contains atmosphere only. Progress, warnings, objectives, and diagnostic state remain static and accessible. Reduced-motion mode removes the moving marquee entirely.

## Text-first artifact behavior

Visual clues remain occasional. Every artifact:

1. is absent before the server reveal;
2. has a textual summary and complete document body;
3. may add an authored image, map, diagram, or document facsimile;
4. provides alternative text and a caption;
5. stays understandable with the visual removed.

The elevator chronology is the concept artifact. It is an ASCII transit trace with a complete accessible label, caption, and adjacent textual evidence. A future icon or vector clue must use the same amber foreground token and remain understandable as text alone.

Pixelarticons supplies single-color semantic icons for records, products, items, maps, characters, audio, and other game objects. These icons supplement nearby text and provide an imagery fallback when an artifact has no authored character-cell or image treatment.

## State and security boundaries

- React never decides whether evidence is visible or an ending is legal.
- Direct UI actions call `submit_story_intent` with session identity, semantic intent ID, expected version, and mutation ID.
- Returned server state replaces the rendered snapshot.
- Hidden canon, unrevealed artifacts, creator source maps, and debug state must never enter widget payloads.
- Standalone simulation is labeled and exists only for local design testing.
- The widget consumes `StoryframePlayerView`, never `CreatorView` or raw `GameState`.

## Feedback questions

Use the concept to answer:

1. Does the active story moment feel primary enough, or should the widget recede further behind conversation?
2. Is fullscreen evidence review worth leaving the inline conversation flow?
3. Should selecting a released record also mark it reviewed, or should opening and confirming be separate actions?
4. Does PiP add useful continuity during a long story, or does it compete with ChatGPT responses?
5. Does the full physical CRT belong only in fullscreen, or should inline retain more of its hardware identity?
6. Do final choices belong in the widget, conversation, or both with one shared confirmation boundary?

## Local feedback workflow

Start the development server, then open:

```text
http://127.0.0.1:8787/widget
```

The standalone toolbar switches between inline, fullscreen, and PiP simulations. Open records in fullscreen, verify the reveal of the final memorandum after the first three records, and exercise one final disposition. Reload to reset the local simulation.

In an actual ChatGPT host, the preview toolbar disappears. The widget requests display-mode changes through the host and continues to use the MCP Apps bridge for tool calls and tool-result notifications.

## Next implementation slice

Completed in this slice:

- generic `PlayerView` plus presentation metadata;
- one decoupled render tool;
- Agency-to-player adapter with no world fields in React;
- host persistence for selected evidence and display mode;
- retry-safe mutation IDs, expected versions, and stale-view recovery;
- busy, rejected, transport, and narration fallback states.

Next: replace the compatibility adapter with compiled-world sessions, then run real ChatGPT Developer Mode tests over HTTPS before treating host sizing or PiP lifecycle as complete.

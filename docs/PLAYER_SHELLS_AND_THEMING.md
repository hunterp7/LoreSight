# Player Shells and Author Theming

Status: React shell boundary, runtime contract, and optional WebGL CRT layer implemented  
Updated: August 3, 2026  
Audience: world authors, Creator Studio designers, frontend developers, and QA

## Design principle

The story terminal and its physical surround are separate layers:

```text
PlayerShell
  ├─ DefaultCrtShell
  └─ AuthoredShell
       └─ TerminalViewport
            └─ stable story UI, artifacts, actions, and audio
```

The inner terminal owns legibility, interaction, accessibility, player state, and ChatGPT host behavior. The outer shell establishes world identity. A world may keep Storyframe's default CRT or supply a constrained authored surround. Changing shells cannot alter game mechanics, released evidence, legal intents, narration, or state version.

## Cool-retro-term renderer

The default CRT uses `cool-retro-term-renderer` as the full glass surface. It renders the transcript with the library's Terminus font, phosphor treatment, curvature, scanlines, low-intensity bloom, flicker, and noise. The story controls and command field remain as a DOM layer above the canvas. The DOM transcript remains in the accessibility tree and is used automatically when WebGL is unavailable. The illustrated inner trim and cutout are not rendered around the WebGL surface.

The loading state follows Figma node `19:183`: the glass shows only `LoreSight` and `Load a .z3, .z5, .z8, or .zblorb file to begin.` in the renderer, with the active package phosphor color over black. The bezel's `Load File` control opens the local story picker; the old in-screen load button is intentionally hidden during loading.

The loading copy is now sent through the WebGL renderer as well; the DOM copy is only an invisible accessibility fallback. Runtime transcript text follows the same renderer path. Bezel controls use proportional positions tied to the 820×610 monitor coordinate system, so they stay aligned as the monitor scales.

The WebGL canvas fills the complete dark screen well (the 652×442 screen-trim area), not the smaller inner cutout. Renderer text is wrapped to the active glyph grid before painting. A transparent DOM scroll track sits inside the glass and selects the visible row window: new output follows the bottom when the reader is already at the end, while wheel/touch scrolling back preserves earlier context without moving the monitor or canvas. This mirrors cool-retro-term's active viewport behavior while retaining accessible, bounded history navigation. Storyframe also maps the active line/character request to `TerminalText.setCursorPosition`, `setCursorVisible`, and `setCursorBlinking`, so the phosphor cursor follows the end of the live prompt instead of remaining at row 0, column 0. Glyph scale changes recalculate the grid before the next update, so bottom-following remains correct as the monitor is resized.

The layer is intentionally restrained rather than using the package defaults: `bloom: 0.12`, `flickering: 0.015`, with static noise, glowing line, and rasterization disabled. Glyph scale defaults to `0.312` (a 30% increase over the original `0.24`) while the canvas remains full-size. This keeps text readable while preserving the cool-retro-term character. The package is GPL-3.0 licensed; review that license before production distribution or consider isolating the renderer behind an optional build target.

Theme buttons map to the renderer's documented palette values: Orange uses the package's Amber example (`#ffb000`), Green uses its default Green profile (`#0ccc68`), and Blue uses the public custom-color API (`#00aaff`) because the package does not ship a named blue preset. All three use a black renderer background.

## Temporary renderer lab

Local preview exposes a collapsed **Renderer lab** under the theme toggles. It controls curvature, bloom, brightness, flicker, ambient light, RGB shift, sync distortion, jitter, burn-in, noise, glow line, scanline intensity, and glyph scale. **Reset** restores the current defaults. **Lock values** saves the profile in browser local storage so it survives a refresh while the lab is being evaluated. This panel is intentionally not rendered when the app is connected to ChatGPT.

The current locked profile is now the code default: curvature `0.36`, bloom `0.25`, brightness `0.50`, flicker `0.015`, ambient `0.67`, jitter `0.27`, noise `0.18`, glow line `0.22`, scanline intensity `0.79`, and glyph scale `0.312`.

The renderer transcript surface accepts wheel scrolling with bounded history navigation. Primary and secondary command actions remain native DOM controls layered over WebGL for keyboard and screen-reader support, but use single-color phosphor styling so they read as terminal controls.

## Runtime contract

Compiled worlds can set `WorldPack.presentation.playerFrame`. The same value is projected to `StoryframePlayerView.presentation.frame`:

```ts
{
  kind: "authored",
  preset: "institutional",
  label: "Continuity archive",
  mark: "71 / 442",
  colors: {
    surround: "#161b22",
    surface: "#26313a",
    edge: "#89a89a",
    accent: "#d7b56d"
  }
}
```

`kind: "default-crt"` selects the original cream CRT housing. If the authored frame is absent or invalid, the player should fall back to the default CRT rather than blocking play.

### Presets

- `institutional`: structured bands and restrained side ornaments;
- `ornate`: asymmetrical rounded corners for ceremonial or fantastical worlds;
- `industrial`: heavier edges and terminal well;
- `minimal`: label band plus a thin surround, suited to inline-first worlds.

Presets control only outer-shell composition. They cannot rearrange the story's central controls.

### Safe tokens

The initial contract accepts four six-digit hexadecimal colors, one short label, and one short mark. It deliberately rejects raw CSS, class names, HTML, image URLs, fonts, scripts, and arbitrary layout values.

This protects terminal contrast, responsive behavior, reduced-motion guarantees, the widget Content Security Policy, and future theme migration. The server output schema validates hexadecimal values. The compiler and Creator Studio must apply the same bounds before publishing authored themes.

## Creator workflow

The intended Creator Studio flow is:

1. Choose **Default CRT** or **Create a world surround**.
2. Select one structural preset.
3. Set the surround, surface, edge, and accent colors.
4. Enter an optional short world label and identifying mark.
5. Preview inline and fullscreen, plus mobile, dark host, and reduced-motion behavior.
6. Run contrast and overflow checks.
7. Review the presentation delta and publish it with the immutable world version.

The local conceptual preview currently exposes **Default CRT** and **Author theme** controls. This is a design-feedback mechanism; it does not mutate or publish world metadata.

Storyframe source syntax and Creator Studio controls for `playerFrame` are not yet implemented. Until they are, the typed `WorldPack` contract is the integration boundary.

## Pixelarticons vocabulary

Storyframe uses the MIT-licensed `pixelarticons` React package for single-color imagery inside the terminal. Icons inherit the phosphor color through `currentColor`, remain sharp on the 24-pixel grid, and are imported per icon to keep the bundle tree-shakeable.

The mapper in `web/src/game-object-icon.tsx` currently covers:

| Object kind | Visual family |
|---|---|
| record, document | file text |
| log | vertical scroll |
| memorandum | clipboard note |
| product | package |
| item, inventory | backpack |
| book | open book |
| image | image frame |
| diagram | pixel grid |
| map, location | map pin |
| currency | coins |
| tool | tool case |
| potion | bottle |
| character | person |
| audio | waveform |
| unknown | archive fallback |

Icons supplement text. They never replace object names, item counts, clue bodies, button labels, alt text, or captions. Decorative list icons are hidden from assistive technology because the adjacent visible text already names the object.

## Artifact visuals

An artifact can provide complete textual evidence, summary and caption, an accessible visual label, character-cell content, a semantic Pixelarticon fallback, and later an approved authored image asset.

If `visual.textLines` exists, the terminal renders the character-cell clue. Otherwise it can render a large semantic icon with the authored accessible label. Required deductions must remain possible from textual evidence alone.

## Responsive rules

- Inline uses the physical CRT cabinet and its hardware details.
- The inline cabinet uses the supplied Macintosh 1 bezel artwork (`animations/before-state.svg`) at its native 680×720 aspect ratio. The WebGL terminal is positioned over the artwork's glass cutout so the cabinet scales as one locked unit.
- Selecting **Load story**, **Play sample**, or any **Story library** entry dispatches the floppy-insert sequence from `animations/floppy-insert-animation.svg`. The animation is pointer-transparent and does not interrupt keyboard focus; the selected story still boots through the normal Z-machine path.
- On the landing state, the screen offers two compact actions: **Load story** opens a local story picker and **Play sample** starts the bundled sample; both are rendered as native terminal controls and scaled to 70% of the standard action size.
- The bezel exposes the sample trigger plus brightness minus/plus controls; the separate **Load File** bezel control is intentionally omitted so there is one clear load affordance.
- Fullscreen removes the cabinet and expands the inner screen to the viewport height; only the transcript and command field remain visible.
- The default CRT supports three phosphor palettes: orange, green, and blue. Palette tokens apply to text, borders, glow, screen tint, and scanlines consistently.
- Mobile preserves the same two-mode contract and reduces cabinet padding where needed.
- Reduced motion still disables the atmospheric marquee regardless of shell.
- Author theming never increases the number of visible primary actions.

## QA checklist

1. Switch between **Default CRT** and **Author theme** without losing story progress.
2. Verify the terminal's size and content hierarchy remain stable.
3. Test all four presets with extreme but valid color combinations.
4. Reject non-hex colors, URLs, markup, and labels above their schema bounds.
5. Verify unknown object kinds receive the archive fallback icon.
6. Confirm artifacts retain visible names and complete text with CSS or icons disabled.
7. Check keyboard focus, 200% zoom, reduced motion, and mobile layouts.
8. Confirm authored shells do not add resource or frame domains to the widget CSP.

## Next implementation work

1. Add Storyframe grammar and compiler validation for `PRESENTATION PLAYER_FRAME`.
2. Add Creator Studio preset/color controls with automatic contrast feedback.
3. Load the frame from a compiled Agency `WorldPack` instead of the compatibility adapter.
4. Add authored icon-key selection from an approved semantic catalog.
5. Add visual regression fixtures for every preset and ChatGPT display mode.

## Story library

`web/src/story-catalog.ts` is a checked-in metadata snapshot of the playable releases listed by [jeffnyman/zcode_catalog](https://github.com/jeffnyman/zcode_catalog). It keeps canonical titles, Z-code format, category, and an upstream raw-file URL for each entry. The binary files are not copied into the widget bundle; selecting a title fetches that release on demand and sends it through the same Z-machine boot path as an uploaded file.

The landing screen exposes **Story library** alongside **Load story** and **Play sample**. The list is intentionally scrollable and uses the same single-color terminal treatment. The catalog currently includes 48 canonical classic and Inform entries. Keep attribution and upstream licensing visible when adding more sources, and prefer metadata-only entries for works that should not be redistributed by the app.

## CRT settings

`web/src/crt-themes.ts` contains the built-in phosphor profiles plus the third-party profiles documented by Cool Retro Term: Matrix, Kindle, Clean, Vertigo, Toucan, Apple II Blue/Green/Purple, Commodore 64 Default/White, MU/TH/UR, Night Owl, and Terminator Vision. Each profile carries its ink color, screen background, and renderer values for curvature, bloom, brightness, flicker, ambient light, sync, jitter, burn-in, noise, chroma, glow, rasterization, and glyph scale. The source theme page documents these same variables and profile JSON values. ([Cool Retro Term theme profiles](https://github.com/Swordfish90/cool-retro-term/wiki/Third-Party-Themes))

The in-monitor **Settings** page is rendered by the WebGL terminal surface and provides all 15 renderer controls plus theme selection. Native sliders and buttons are transparent interaction affordances layered over the same screen so keyboard and assistive-technology input remain usable; labels and current values are also emitted into the WebGL text stream. Selecting a profile applies its complete visual preset and persists through the existing widget-state/local-storage path. Settings and Controls share the `CrtPageOverlay` shell so their placement, Back hit target, and interaction layering stay consistent.

The **Controls** page is now an HTML pane inside the glass, matching Settings rather than being painted as a dense renderer-text block. It groups movement, observation, and item commands into readable rows with keyboard equivalents and descriptions. The native action rail exposes **Controls** and changes to a single **Back** action while the page is open; the same `storyframe:open-controls` event is available to host actions.

## Fullscreen gamepad

Desktop Fullscreen adds a touch-friendly gamepad at the bottom of the glass, modeled on the Figma `Full screen modal` frame (`node-id=50-2931`). The left cluster is a 3×3 directional pad (including diagonals and Look) with U/D/IN/OUT below it. The right cluster sends Examine, Inventory, Take/Get, Drop, Search, Open, Close, Lock, Unlock, and Put commands. Each button routes through `BrowserGlkBridge.submitLine()` during line input and `submitChar()` during character input, so the UI uses the same interpreter path as physical keyboard input. Buttons are hidden on narrow/mobile surfaces to preserve reading space; keyboard input remains available everywhere.

### ChatGPT fullscreen fit

The fullscreen shell follows the [Apps SDK fullscreen model](https://developers.openai.com/plugins/concepts/ui-guidelines#fullscreen): ChatGPT owns the system close affordance and keeps its composer overlaid, while LoreSight owns only the immersive CRT surface. The widget reads `window.openai.maxHeight`, `window.openai.safeArea`, and `window.openai.theme` from the [component bridge capabilities](https://developers.openai.com/plugins/reference#capabilities) and maps them to CSS variables. The CRT and transcript are constrained to the host-reported height; the toolbar is inset below the top safe area; the fullscreen gamepad and action rail reserve the bottom safe area plus a composer/action-rail buffer. LoreSight does not render a second chat composer, so users can continue conversational tool calls through ChatGPT's native composer without the game controls being hidden behind it. The layout re-syncs on host resize/global-change events and retains a viewport fallback for local preview.

The admin Theme Lab at `/admin?view=themes` uses the same `CoolRetroRenderer` and the same 604:390 glass aspect ratio as the production inline screen. Each profile preview is a real WebGL render filled with representative transcript text and a live prompt; the controls below it edit only that profile until **Commit all themes** is pressed.

Theme Lab commits are written to browser storage for immediate local preview and also to the server theme-profile store when the admin API is configured. The player reads server profiles first for the active theme, then falls back to local drafts and built-in defaults. This keeps curvature and glyph scale changes available across separate admin/player tabs and future reloads.

## Z-machine prompt handling

The Glk bridge buffers text until a line break so it can reproduce terminal output efficiently. Before a story requests line or character input, the bridge flushes that pending text into the transcript. This is important for Inform stories whose question or tutorial prompt is written immediately before `glk_request_line_event`; without the flush, the input field appeared while the actual question remained invisible. The bridge also filters the catalog view to releases supported by the current runtime (Z-code 3, 4, 5, 8, and compatible Blorb files).

Once a story starts, the WebGL terminal remains fixed in the glass while its inner scroll track is interactive. The reader follows new transcript output when already at the bottom; scrolling upward pauses that follow mode until the reader returns to the end. Gameplay is keyboard-only: the focused terminal captures text, Backspace, history arrows, Enter, and single-key prompts directly, with no visible input field or Send button.

The WebGL canvas fills the complete glass. There is no persistent command bar; the focused terminal accepts keyboard input directly, and the transparent in-glass scroll track allows earlier transcript rows without scrolling the monitor itself off screen.

### Customer theme controls

The customer-facing Settings page lets a player choose any built-in CRT profile, tune its renderer sliders, and press **Save appearance**. Theme selection is stored under `storyframe.crtTheme.v1`; each player's saved renderer values are stored independently under `storyframe.userThemeEffects.v1` (with the older renderer map retained as a migration fallback). A save also updates ChatGPT widget state and requests persistent browser storage when supported. This means changing Green does not overwrite Amber, and a reload restores both the selected profile and its saved controls. Remote server profiles are applied as defaults, while explicit player saves always win. The same React state is passed to Inline and Fullscreen, so switching display modes preserves the active theme and effects. The native theme picker is intentionally kept alongside the compact color swatches for reliable keyboard, pointer, and assistive-technology access.

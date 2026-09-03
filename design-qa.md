# LoreSight design QA

Date: 2026-08-14
Viewport: 1280 × 720 CSS px, device scale factor 1
State: landing screen and menu-open state
Source artifacts:

- `/Users/Hunter/Downloads/ascii-art.png` (705 × 120 px)
- `/Users/Hunter/Desktop/Screenshot 2026-08-14 at 1.08.14 AM.png` (668 × 382 px, React Bits Bubble Menu reference)
- `/var/folders/hx/wgf1xk6n0rn5y_s3whvlt6kh0000gp/T/codex-clipboard-6118ad6e-f775-4fb7-9770-d42c1ad32fd5.png` (447 × 447 px, shallow keyboard-key form reference)
- `/var/folders/hx/wgf1xk6n0rn5y_s3whvlt6kh0000gp/T/TemporaryItems/NSIRD_screencaptureui_oUOBkY/Screenshot 2026-08-14 at 10.34.45 PM.png` (1244 × 662 px, short-viewport clipping and front-key revision reference)
- `web/src/assets/loresight-crt-bezel-clean.png` (1486 × 1058 px, authoritative bezel material and texture source)

Implementation evidence:

- `/private/tmp/loresight-implementation-qa.png` (1487 × 1058 px, landing)
- `/private/tmp/loresight-menu-qa.png` (1487 × 1058 px, menu open)
- `/private/tmp/loresight-buttons-qa.png` (848 × 629 px, compact menu and physical navigation layout)
- `/private/tmp/loresight-rail-final-qa.png` (848 × 629 px, final realistic five-button rail)
- `/private/tmp/loresight-perspective-qa.png` (848 × 629 px, final console-perspective pass)
- `/private/tmp/loresight-clean-keyboard-rail-qa.png` (648 × 660 px, clean bezel shelf and compact five-key rail)
- `/private/tmp/loresight-bezel-textured-keys-final-qa.png` (1280 × 720 px, final bezel-material keyboard rail)
- `/private/tmp/loresight-keycap-comparison-final.png` (1200 × 440 px, focused source/reference and implementation comparison)
- `/private/tmp/loresight-design-qa-comparison.png` (combined source/reference and implementation comparison)
- `/private/tmp/loresight-menu-before-qa.png` (1280 × 720 px, pre-fix menu state)
- `/private/tmp/loresight-menu-after-qa-final.png` (1280 × 720 px, final browser-rendered menu state)
- `/private/tmp/loresight-menu-comparison-qa-final.png` (1336 × 382 px, normalized side-by-side menu comparison)
- `/private/tmp/loresight-black-keys-contained-menu-final-state.png` (1280 × 720 px, final black-key rail and contained two-row menu)
- `/private/tmp/loresight-menu-buttons-comparison-final.png` (2488 × 662 px, normalized before/after full-view comparison)

## Checks performed

- Loaded `http://127.0.0.1:8787/widget` in a real headless Chromium viewport.
- Verified the landing renderer has no transcript, no cursor, and displays the supplied dot-matrix artwork as a centered phosphor mask.
- Verified the physical navigation labels render in the requested order: Library, Play/Remix, Load, New, Settings.
- Clicked the menu toggle and verified six menu items render: Settings, Controls, Library, Play/Remix, New, Load.
- Measured the menu overlay: x=446.45, y=75.69, width=595.58, height=304.44; this matches the `.screen-trim` glass bounds at the tested viewport.
- Verified overlay background is `rgba(0, 0, 0, 0.8)`, `overflow: hidden`, and border radius 12px.
- Verified menu item animations complete and all six labels remain inside the glass clipping region.
- Verified the menu toggle is the only control in the glass top-right area; at 1487 × 1058 it measured x=1005.61, y=72.91, 38 × 38.
- Verified the smaller fullscreen control is an outline button anchored to the glass bottom-right; it measured x=1011.61, y=345.30, 30 × 30, with a transparent fill. Fullscreen transition was also exercised at 1200 × 800 and returned the control to the viewport bottom-right.
- Captured browser console output: no errors.
- At the compact 848 × 629 viewport, all five physical navigation buttons occupy one row (138.78px each) with no overlap; all six glass menu pills remain within the glass bounds.
- Final rail pass: the bezel raster itself has a continuous empty lower shelf with no synthetic cover panel. The five live keys now share the screen ring's black material texture with a common highlight, bevel, and pressed-depth model. Browser capture shows no console errors.
- Perspective pass: the final five controls use a 5° button-face tilt and a shallow 69% rail height so they read as low-profile keyboard keys seated directly in the shelf rather than tall DOM cards.
- Material-key pass: each key uses a different horizontal slice of `loresight-bezel-key-texture.png`, an 80 × 700 px crop taken directly from the clean bezel shelf. All five keys therefore share the device's actual grain and color while avoiding a visibly repeated texture stamp.
- Interaction pass: activated the physical Settings key in the in-app browser, confirmed the Settings surface opened and the key reported active, then used the shared Back control to return to the landing state.
- Latest menu pass: opened the menu, allowed the `back.out(1.5)` staggered animation to complete, activated Controls, confirmed the Controls region opened, returned with Back, and exercised the menu open/close toggle again.
- Normalization: the 668 × 382 source was compared against the implementation glass crop (645 × 356 CSS px) normalized to 668 × 382 at device scale factor 1. The full 1280 × 720 implementation capture was retained separately for framing and containment review.
- Short-viewport pass: compared the supplied 1244 × 662 clipping capture with the final 1280 × 720 browser capture normalized to 1244 × 662. Both menu rows and all six labels are visible inside the glass in the final state.
- Front-key pass: confirmed the five keys use exact text-only menu labels, activated the physical Settings key, verified the Settings region opened, and returned through the shared Back control.

## Comparison history

1. Initial capture found the source Unicode artwork was garbled by the renderer font atlas. Replaced that text path with a pixel-accurate alpha mask generated from the supplied PNG, then recaptured at the same viewport.
2. Initial menu capture found the portal overlay was positioned at the viewport bottom because `inset: auto` was applied after `left`/`top`, resetting those coordinates. Moved `inset` before explicit coordinates, restarted the server, and recaptured the same viewport. The overlay now tracks the glass exactly.
3. Rail comparison found the original four baked buttons remained visible beneath the live controls and the controls lacked the source’s realistic color/bevel treatment. Added a recessed mask panel, five color-specific button skins, shared perspective, and active depth state; recaptured at 848 × 629 and confirmed the source buttons are no longer visible.
4. Perspective comparison found the first live rail pass still read as flat. Increased the shared console-plane and button-face perspective, added consistent trapezoidal clipping, and recaptured at 848 × 629. The final screenshot shows the controls seated in one physical plane with no baked buttons visible.
5. Clean-shelf comparison found that masking the original four-button raster with a rounded CSS panel still read as a separate tray. Replaced the source bezel with a non-destructive clean-shelf asset, removed the pseudo-element mask, reduced the live key rail height, and recaptured the landing state. The five controls now mount independently into the illustrated lower shelf.
6. The first same-material pass matched the bezel texture but read too flat at compact inline scale. Increased the key height from 64% to 69%, added a two-pixel top bevel and lower lip, reduced the face tilt to 5°, and retained a soft three-pixel contact shadow. The final focused comparison shows the keyboard-key form without the reference image's deep dark cast shadow.
7. Menu QA found the existing six pills were too short, too bold, and separated by large horizontal and vertical gaps. Removed the column padding and gaps, increased the pill height, switched to a regular-weight sans face, widened the pills slightly, and tightened the alternating vertical offsets.
8. The first corrected pass established edge contact but remained visibly flatter than the source. Increased the final pill height from 112px to 132px and the display type ceiling from 32px to 37.6px. The normalized final comparison shows two dense, staggered rows with soft near-circular pills, fitted labels, and neighboring edges that meet without obstructing interaction.
9. The supplied short-viewport capture exposed a P1 containment failure: viewport-width sizing made the first row consume most of the glass height and pushed the second row below the clip. Replaced the wrapped flex sizing with a two-row grid whose height is capped at 76% of the actual glass overlay; each pill now derives its height and font scale from the glass container rather than the viewport width.
10. The requested hardware revision found the beige keys too rounded, too short, and visually separate from the black screen ring. Cropped a real 700 × 28 px texture strip from the production ring, removed decorative glyphs, halved the radii to 5/4px, increased the rail and key occupancy to 82%, and retained shallow pressed depth. Final evidence shows five evenly distributed black keys integrated into the lower shelf.

## Required fidelity surfaces

- Fonts and typography: menu labels use regular-weight Arial/Helvetica scaled from the glass height, matching the source's light sans presentation. Play/Remix remains on one line and no label clips. Hardware keys use short text-only labels with no competing glyphs.
- Spacing and layout rhythm: the menu uses a three-by-two bounded grid, zero structural gap, four pixels of intentional pill overhang, alternating rotation, and small row offsets. Both rows remain inside the glass at the tested short desktop viewport. The five taller keys evenly occupy the lower shelf.
- Colors and visual tokens: menu pills retain the reference's white fill and black text; the 80% black glass overlay preserves contrast against any CRT theme. Front keys use the sampled near-black ring texture with warm beige labels and restrained bronze edges. Theme-specific colors remain hover-only.
- Image quality and asset fidelity: the supplied reference and browser implementation are compared in one normalized image. The black key material is a lossless crop of the production screen-ring raster rather than a synthetic flat fill; the menu remains the installed React Bits component with production labels and behavior.
- Copy and content: all six intended menu destinations remain present—Settings, Controls, Library, Play/Remix, New, Load—and each label maps to its existing action.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none.

final result: passed

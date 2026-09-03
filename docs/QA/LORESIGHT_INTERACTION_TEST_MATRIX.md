# LoreSight interaction test matrix

Date: 2026-08-11  
Environment: local dev server at `http://127.0.0.1:8787`  
Primary surface: `/widget`  
Admin surface: `/admin`

## Coverage rules

The matrix treats every user-visible action as a test boundary: native action rail buttons, preview mode controls, inner CRT pages, keyboard input, gamepad buttons, settings sliders, story-library entries, creator forms, admin navigation, admin tabs, and connection controls. A test is **pass** only when the control is reachable, its destination/state is correct, and the resulting UI remains usable.

## Player test cases

| ID | Path | Expected result | Result |
| --- | --- | --- | --- |
| P-01 | Open `/widget` | Inline CRT, live terminal, action rail, and preview controls render | PASS; baseline captured |
| P-02 | Preview `fullscreen` → `inline` | Renderer changes mode without losing story state | PASS; mode switch works |
| P-03 | Preview `inline` → `fullscreen` | Glass-only renderer fills viewport; native controls remain available | PASS; controls visible |
| P-04 | Preview `Settings` → `Back` | Settings opens in inner container; Back returns to prior surface | PASS |
| P-05 | Select each production theme | Theme name, color, and profile values update | PASS for Amber, Green, Blue and bundled profiles |
| P-06 | Adjust renderer slider | Thumb and displayed value stay synchronized | **FAIL**; thumb changes but numeric status remains stale |
| P-07 | Save appearance → reload | Saved appearance persists for the selected theme | **FAIL**; changed brightness reverted after reload |
| P-08 | Native `Imagine a new story` | Create form opens | PASS |
| P-09 | Submit create form | Host request notice appears with entered prompt/tone | PASS in local preview; host generation not exercised |
| P-10 | Native `Remix a story` | Remix form opens with source selector | PASS |
| P-11 | Select remix source `Upload…` | File chooser appears and selected source is represented in form | **FAIL**; selector changes, but no file input/chooser appears |
| P-12 | Submit remix form | Host request notice appears with source and prompt | **PARTIAL**; notice works, source is not included in dispatched detail |
| P-13 | Native `Play Z-machine files` | Local file chooser opens | PASS; filechooser event observed |
| P-14 | Native `Browse Library` | Story library opens in one column with Back | PASS |
| P-15 | Click every catalog entry (43 entries) | Entry loads, transcript remains usable, Back remains available | PASS; 43/43 exercised |
| P-16 | Native `Play sample` | Bundled sample loads and transcript shows prompt | PASS |
| P-17 | Native `Restart` after sample | Same story restarts with a live input request | **FAIL**; transcript resets to `Loaded Figaro`, but keyboard/gamepad commands no longer advance it |
| P-18 | Keyboard letters + Enter | Typed command appears and submits to interpreter | PASS on freshly loaded story |
| P-19 | Backspace/history/Page Up/Page Down | Editing/history/scroll shortcuts operate | PASS for transcript scroll; command history needs longer story regression coverage |
| P-20 | Scroll transcript after 14 commands | Scroll area grows, autoscrolls to newest line, and manual scroll returns to prior context | PASS; `scrollHeight 1610`, `clientHeight 304`, manual scroll moved `scrollTop 1306 → 606` |
| P-21 | Fullscreen Controls | Controls page opens with readable movement/observe/items reference and Back | PASS |
| P-22 | Fullscreen gamepad movement/action buttons | Buttons submit equivalent commands and produce interpreter output | **FAIL after Restart**; buttons were clickable but no transcript advance occurred |
| P-23 | Fullscreen Settings | Same settings surface and values as inline | PASS structurally |
| P-24 | Fullscreen/inline state continuity | Story state and transcript remain continuous across mode changes | PASS before restart regression |

## Admin test cases

| ID | Path | Expected result | Result |
| --- | --- | --- | --- |
| A-01 | `/admin` with invalid password | Error is visible; workspace remains closed | PASS |
| A-02 | `/admin` with configured password | Workspace opens | PASS |
| A-03 | Home → Playtests → Studio → Clues → Help → Themes → Connect → Home | Each nav destination has the correct heading/content and active state | PASS; all seven destinations exercised |
| A-04 | Studio Story tab | Scene editor fields, check, save, and preview render | PASS structurally |
| A-05 | Studio Enhancements tab | Shell/audio/visual/motion/help controls and preview render | PASS structurally |
| A-06 | Studio enhancement select/save/reset | Values update, save/reset return expected state | PASS; Story validation/save, Enhancements save/reset exercised |
| A-07 | Theme Lab preview cards | Each theme has a production-shaped preview and independent controls | PASS structurally; previews are present |
| A-08 | Theme Lab slider | Thumb and numeric value stay synchronized | **FAIL**; same stale numeric status as player Settings |
| A-09 | Commit all themes → reload player | Committed values reach production player and persist | PASS for commit acknowledgement; brightness persistence needs repair and rerun |
| A-10 | Connect URL generator | Root tunnel URL normalizes to `/mcp`, Copy enables, links point to intended destinations | PASS with `https://example.trycloudflare.com/mcp` |
| A-11 | Open ChatGPT connections | Link points to `https://chatgpt.com/plugins` | PASS |
| A-12 | Open local preview | Link points to `/widget` | PASS |

## Evidence index

- Inline baseline and stale physical-deck copy: [`docs/QA/evidence/inline-baseline.png`](/Users/Hunter/Documents/Codex/StoryFrame/docs/QA/evidence/inline-baseline.png)
- Player Settings slider mismatch: [`docs/QA/evidence/player-slider-mismatch.png`](/Users/Hunter/Documents/Codex/StoryFrame/docs/QA/evidence/player-slider-mismatch.png)
- Restart/input failure: [`docs/QA/evidence/restart-input-failure.png`](/Users/Hunter/Documents/Codex/StoryFrame/docs/QA/evidence/restart-input-failure.png)
- Transcript manual scroll: [`docs/QA/evidence/transcript-scroll.png`](/Users/Hunter/Documents/Codex/StoryFrame/docs/QA/evidence/transcript-scroll.png)
- Remix upload gap: [`docs/QA/evidence/remix-upload-gap.png`](/Users/Hunter/Documents/Codex/StoryFrame/docs/QA/evidence/remix-upload-gap.png)
- Admin Enhancements viewport: [`docs/QA/evidence/admin-enhancements.png`](/Users/Hunter/Documents/Codex/StoryFrame/docs/QA/evidence/admin-enhancements.png)
- Admin Theme Lab slider mismatch: [`docs/QA/evidence/admin-theme-slider.png`](/Users/Hunter/Documents/Codex/StoryFrame/docs/QA/evidence/admin-theme-slider.png)

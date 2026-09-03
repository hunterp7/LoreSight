# Admin UI and graphics guide

Status: implemented private-alpha interaction and icon rules  
Audience: story authors, testers, designers, and developers

## Product goal

The admin console should feel like a calm story workshop, not an engine dashboard. A first-time tester should be able to start a playtest, follow a path, recognize a problem, and try an alternate path without knowing Storyframe's internal data model.

The default navigation uses five plain-language destinations:

1. **Home** — choose a story and start testing.
2. **Playtests** — continue or review recorded story paths.
3. **Studio** — shape one critical scene, then tune the presentation layer in a separate tab before saving a private draft.
4. **Clues** — inspect visual and textual story artifacts.
5. **Help** — choose a recognizable problem and follow its response.

Engine language such as frame IDs, intent IDs, state versions, coverage, and raw state belongs inside a collapsed **Technical details** disclosure. It should appear in the primary interface only when the author must act on it.

## Language rules

- Say **scene** instead of frame when speaking to authors.
- Say **choice** instead of intent.
- Say **story check** instead of audit.
- Say **story problem** instead of finding or incident.
- Say **alternate path** instead of retrospective correction proposal.
- Say **step** instead of state version, except inside technical details.
- Name the result before explaining the system operation: “This draft is ready to test,” not “Compilation succeeded.”
- Keep one short explanatory sentence under a heading. Put procedural detail in Help or a disclosure.
- Never expose identifiers as a card's primary label when a human title exists.

## Icon system

Admin icons come from `pixelarticons` and are selected through `admin/src/icons.tsx`. Feature components use semantic names such as `playtests`, `draft`, `clues`, or `repair`; they do not import arbitrary icons directly. This creates one stable mapping that can be changed without rewriting screens.

### Display rules

1. **Icons reinforce text; they never replace it.** The only exceptions are conventional utility controls such as Refresh, which still require an accessible label and tooltip.
2. **One icon per concept.** Playtests always use the test-tube icon, alternate paths always use undo, and draft checking always uses a document/check pairing.
3. **One icon per control.** Do not decorate both sides of a button or combine several icons into a rebus.
4. **Decorative icons are hidden from assistive technology.** Adjacent text provides the accessible name. The SVG uses `aria-hidden="true"` and `focusable="false"`.
5. **Size follows context.** Navigation and buttons use 18px; section leads use 24px; empty states use 32px; clue previews may use 52px.
6. **Color communicates sparingly.** Green means ready or connected, amber means an action needs attention, and red means the author must fix something. Ordinary navigation icons inherit the surrounding text color.
7. **Motion is exceptional.** Icons do not loop, pulse, spin, or bounce. A future transition may animate a wrapper only after a meaningful state change and must honor reduced-motion settings.
8. **Density is capped.** A card should normally show no more than one emblem plus icons inside its controls. Paragraphs, badges, and data rows do not receive decorative icons.

### Semantic map

| Meaning | Semantic key | Pixel icon | Typical use |
|---|---|---|---|
| Home | `home` | Home | Primary navigation |
| Playtest | `playtests` | TestTube | Navigation and saved runs |
| Start/continue | `play` | Play | Primary playtest action |
| Draft | `draft` | FileText | Draft checking |
| Clue or visual | `clues` | Image | Artifact navigation |
| Repair path | `repair` | Undo | Alternate-path workflow |
| Healthy | `check` | Check | Successful checks |
| Problem | `error` | WarningDiamond | Actionable story problems |
| Help | `help` | BookOpen | Guidance and runbook entries |
| Refresh | `refresh` | Reload | Conventional icon-only utility |

Artifacts use a separate kind-to-icon map in the same module. Unknown kinds safely fall back to Archive. Artifact meaning must still be present in the title, summary, alt text, and text fallback.

## Disclosure and information hierarchy

The default surface shows a human title, authored scene context, the next useful action, and a small status cue. A playtest is not comprehensible unless the tester can read the current scene before choosing an action.

The following remain collapsed until requested:

- world IDs and source IDs;
- exact coverage percentages;
- raw story state;
- engine event identifiers;
- source ranges and diagnostic codes;
- full compiler payloads.

This is progressive disclosure, not removal. Developers and support staff retain access to exact evidence without imposing it on every author.

## Author and tester workflow

1. Open **Home** and choose a ready story.
2. Select **Start playtest**.
3. Read the current scene, then make a choice under **What would you like to try?**
4. Confirm that revealed clues and **Your path** explain what changed.
5. Open **Try a different path** to test a replacement without changing the original run.
6. Use **Clues** to confirm a visual artifact has meaningful textual support.
7. Open **Technical details** only when sharing exact evidence with a developer.

### Studio workflow

1. Write the scene name and opening text while watching the player preview.
2. Separate exact wording from meaning that may be performed flexibly.
3. Open **Fine-tune the storytelling** only to add dramatic direction, protected claims, or backup narration.
4. Read **What the engine understood** before checking the scene.
5. Select **Check this scene** and fix the first human-readable problem, if any.
6. Select **Save draft** to retain private work across restarts. Saving does not publish or approve canon.
7. Use **Advanced Storyframe source** only when a precise source-level change is necessary.
8. Switch to **Enhancements** when you want to choose the shell, audio, imagery, motion, or player-help posture for the same draft.

## Adding an icon

1. Confirm the concept is repeated in more than one place or materially improves scanning.
2. Add a direct, tree-shakeable Pixelarticons import to `admin/src/icons.tsx`.
3. Add a semantic key and mapping. Do not name the key after the icon's drawing when the product meaning differs.
4. Use `AdminIcon` or `iconLabel`; do not import the SVG directly in feature code.
5. Add the mapping to this document.
6. Verify desktop and mobile layouts, keyboard focus, contrast, and the icon's adjacent accessible label.

## QA checklist

- A new tester can identify the primary action on Home in under five seconds.
- All five navigation labels remain visible without horizontal scrolling at narrow widths.
- The current scene appears before session management on narrow screens.
- A new playtest hides empty history and alternate-path controls.
- A committed choice uses its human title and shows any newly revealed clue in context.
- Opening a playtest and committing a choice produce a concise polite live-region announcement.
- No unexplained engine term appears outside Technical details.
- Icon-only controls have `aria-label` and `title`.
- Icons never carry clue meaning alone.
- At 390px wide there is no horizontal page overflow.
- Keyboard focus is visible on buttons, fields, summaries, and navigation.
- Reduced-motion preferences disable nonessential transitions.

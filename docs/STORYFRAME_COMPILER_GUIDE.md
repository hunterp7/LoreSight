# Storyframe Compiler Guide

Status: executable subset v0.1  
Audience: world authors, QA testers, and application developers

## Compile a world

From the repository root:

```bash
npm run storyframe:compile -- worlds/conformance/investigation.storyframe
```

Successful summary:

```text
Compiled conformance.compiled-investigation v1.0.0
  2 frames/endings
  1 elastic span declaration
  5 intents
  1 reactive rules
  3 canon facts
  2 authored tests passed, 0 failed
  coverage: 100% frames, 100% intents, 100% rules
  0 active dead ends; search complete
  ... source-map entries
```

To inspect the exact runtime package:

```bash
npm run storyframe:compile -- worlds/conformance/investigation.storyframe --json
```

Compilation exits nonzero on any error. Each diagnostic prints file, line, column, stable code, explanation, and a suggested repair.

## Layout rules

- Use two spaces per indentation level.
- Never use tabs.
- Top-level declarations start in column 1.
- Use `#` for line comments.
- Semantic IDs begin with a letter and use letters, digits, `_`, `.`, or `-`.
- IDs are engine keys; display text belongs in `title`, `name`, or `description`.

## Minimal playable world

```storyframe
WORLD example.hello v1.0.0
  title: Hello World
  owner: Example Creator
  rights: original
  engine: 0.1.0

FRAME beginning

ENDING finished

STATE
  frame: beginning

INTENT finish_story
  title: Finish
  description: End the example story.
  frames: beginning
  effects:
    - go finished
    - complete
```

## World metadata

```storyframe
WORLD semantic.world-id v1.2.3
  title: Player-visible title
  owner: Rights owner
  rights: original
  engine: 0.1.0
```

Supported rights classifications are `original`, `public-domain`, `licensed`, and `user-supplied-private`.

## Frames and endings

```storyframe
FRAME market
  title: Lantern Market
  text:
    - Lanterns sway above a crowded night market.
    - You have ten credits and one chance to trade.
  establish:
    - The market is about to close.
  suggest:
    - Keep the stalls vivid but the prose concise.
  never:
    - Invent a purchase that the engine did not commit.
  fallback:
    - The final bell is near. Choose whether to trade.

ENDING departed
  title: Market Closed
```

An `ENDING` is a terminal frame for static graph analysis. Entering it does not itself set session status; an intent/rule should also use `complete` or `fail` when the save must become terminal.

`text` accepts one inline value or a multiline list and is the immediate scene shown to players and testers. If any structured performance field is present, the frame compiles a `FramePerformanceContract`:

- `exact`: required wording that must appear verbatim;
- `establish`: required meaning whose wording may vary;
- `suggest`: optional dramatic guidance;
- `never`: prohibited claims or implications;
- `fallback`: complete authored output used when generation is absent or invalid.

Structured frames require at least one `exact` or `establish` line. They also require `fallback` or `text`. Compiled beat IDs follow `frame_id.authority.index`, remain deterministic, and map back to the source frame.

## State

```storyframe
STATE
  frame: market
  location: lantern-market
  flag permit = false audiences creator, debug
  clue invoice = false audiences player, model, creator, debug
  knowledge vendor_name = false audiences player, model, creator, debug
  resource credits = 10 range 0..100 audiences player, model, creator, debug
  clock day = 0 range 0..10 audiences player, model, creator, debug
  relationship guild = 0 range -5..5 audiences player, model, creator, debug
  inventory spice = 0 audiences player, model, creator, debug
  reveal artifact public_notice
  reveal canon public_policy
```

Numeric initial values must fall inside their inclusive range. Inventory is a non-negative integer. Audience lists may contain `player`, `model`, `creator`, and `debug`.

`reveal artifact` and `reveal canon` declare information available at session start. The referenced artifact or canon fact must exist. Use this for opening evidence or public policy that should be physically present in player/model projections from version zero; do not use visibility flags in renderer data.

## Canon and cast

```storyframe
CANON market
  LOCK market_is_neutral: The market recognizes no permanent faction.
  SECRET hidden_owner: The guild owns the market charter.
    model directive: Do not identify the owner before reveal.
  UNSAID founder_identity: The founder's identity remains unresolved.
    audiences: creator, debug

CAST quartermaster
  name: The Quartermaster
  role: Licensed provisions broker
```

Supported canon classes are `LOCK`, `SECRET`, `BRANCH`, `OPEN`, `UNSAID`, and `NEVER`. Classification becomes the corresponding runtime canon class. A secret is physically excluded from player/model projections until a `reveal canon` effect commits.

## Conditions

Use `when:` on an intent or rule:

```storyframe
when: always
when: flag permit is true
when: resource credits >= 4
when: clock day < 8
when: relationship guild > 1
when: inventory spice >= 1
when: clue invoice present
when: knowledge vendor_name absent
when: clue_count >= 3
when: frame market
when: location lantern-market
when: canon hidden_owner revealed
when: status active
```

Numeric operators are `==`, `!=`, `>`, `>=`, `<`, and `<=`. Referenced state, frame, and canon IDs must exist.

Compound `all`, `any`, and `not` syntax is not yet enabled in source even though the runtime schema supports it.

## Intents and effects

```storyframe
INTENT buy_spice
  title: Buy spice
  description: Spend four credits to buy one unit.
  frames: market
  when: resource credits >= 4
  effects:
    - adjust resource credits by -4
    - add inventory spice 1
```

Supported effect forms:

```storyframe
- set flag permit = true
- adjust resource credits by -4
- advance clock day by 1
- adjust relationship guild by 1
- add inventory spice 1
- remove inventory spice 1
- add clue invoice
- add knowledge vendor_name
- reveal canon hidden_owner
- set location outpost
- go destination_frame
- complete
- fail
```

Every target except location must be declared. `go` targets a declared frame or ending.

## Seeded checks

Chance uses integer basis points from 0 to 10,000:

```storyframe
effects:
  - check roadside_cache chance 5000
    success:
      - adjust resource supplies by 1
    failure:
      - adjust resource health by -1
```

Both branches are required. The engine seed makes the result replayable.

## Text-first visual artifacts

Declare an occasional image, diagram, map, or document as authored evidence:

```storyframe
ARTIFACT red_thread_photo
  kind: image
  title: Cabinet Thread Photograph
  summary: A close photograph shows fibers beneath the cabinet seal.
  caption: Evidence photograph 3-B, contrast normalized.
  alt: A monochrome cabinet seal crossed by one bright red thread.
  text:
    - The fiber passes underneath the seal rather than resting on top.
    - The wax fracture predates the dust around the latch.
  presentation: inspect
  audiences: player, model, creator, debug
  clue: red_thread
  asset: artifacts/red-thread-photo.svg
  mime: image/svg+xml
```

Reveal it mechanically:

```storyframe
effects:
  - add clue red_thread
  - reveal artifact red_thread_photo
```

Kinds are `document`, `image`, `diagram`, and `map`. Presentation is normally `inspect`; use `inline` only for a rare story-critical interruption. Visual kinds require an asset key and approved MIME type. Every kind requires `alt` and `text`, because the clue must remain playable when images are blocked, slow, or inaccessible.

## Reactive rules

```storyframe
RULE reveal_after_three_clues
  once: true
  when: clue_count >= 3
  effects:
    - reveal canon culprit
    - go resolution
```

Rules run after each committed intent in source order. `once: true` records a one-shot trigger in state.

## Elastic spans and TweenContracts

Use a `SPAN` for a bounded, mostly textual passage between authored keyframes. The declaration compiles into a `TweenContract`; it does not authorize free-form changes to game state or canon.

```storyframe
SPAN verification_span -> resolution
  purpose: Let the player connect the evidence before closing the case.
  turns: 1..2
  required beats:
    - Connect the thread, seal, and false date.
    - Preserve the unresolved patron identity.
  curve: certainty 2 -> 5, urgency 3 -> 1
  may invent:
    - sensory details inside the archive
    - concise evidence transitions
  may not invent:
    - new suspects
    - new evidence
    - the patron identity
  persist inventions: turn
  hide:
    - canon patron_identity
  offer: review_case_summary
  exit when: required_beats complete
  fallback:
    - The clues now describe one deliberate sequence of events.
```

The target after `->` must be a frame, ending, or another declared span. Turn ranges are inclusive and positive. Both invention lists are mandatory; use a literal list item such as `nothing` when a side is intentionally empty. Persistence is `turn`, `scene`, `session`, or `proposal`. Protected canon/artifact IDs must exist, cannot be re-authorized through `may invent`, and their exact protected text cannot appear in fallback lines.

Every offered intent must exist and include the span ID in its `frames` list. The current deterministic engine enters a span through ordinary transition effects and leaves through an offered intent. `required beats`, curves, invention rules, and fallback are compiled control data for the upcoming AI Director; the engine never treats them as implicit mechanical effects.

## Threads and choices

Threads express an authored promise and payoff across frames or spans:

```storyframe
THREAD forged_ledger
  plant at investigate
  echo with red_thread, broken_seal, false_date
  reveal at verification_span
  pay_off at resolution
  never resolve patron_identity
```

A required thread must have both `plant at` and `pay_off at`. Use `optional: true` only when absence of a payoff is an intentional branch outcome. Plant, reveal, and payoff frame references are validated. Echo and never-resolve IDs are retained as explicit narrative constraints; deeper entity-domain and condition-aware payoff validation remains future work.

Choices group existing legal intents for Creator Studio and presentation tooling:

```storyframe
CHOICE investigation_methods
  frames: investigate
  offer: inspect_red_thread, inspect_broken_seal, inspect_false_date
```

Choice frames and intent IDs must exist. A choice does not duplicate mechanics: each offered intent remains the sole definition of conditions and effects.

## Authored executable tests

Tests compile into the world and execute through the same `engine-core` resolver used by real sessions:

```storyframe
TEST first_clue_preserves_culprit
  seed: 42
  play: inspect_red_thread
  assert hidden: canon culprit
  assert revealed: artifact red_thread_photo
  assert frame: investigate
  assert status: active
```

`play` is an ordered `->` sequence of intent IDs. The seed defaults to `42` and must be a safe integer. Repeat `assert hidden` or `assert revealed` for canon and artifacts. Frame and status assertions inspect the final state; status is `active`, `complete`, or `failed`.

Programmatic runners:

```ts
const authored = runAuthoredWorldTests(world);
const coverage = exploreStoryBranches(world, {
  maxDepth: 16,
  maxStates: 2_000,
  seed: 42,
});
```

The authored runner reports the exact failed step or assertion. Branch exploration executes every currently legal intent from every distinct bounded mechanical state, reporting reached frames/spans, exercised intents, fired rules, terminal paths, active dead ends, unexpected rejections, and truncated paths. `complete: false` means the configured depth or state budget was insufficient; it does not mean uncovered content is safe.

## Reading diagnostics

Prioritize the first error; later errors may be recovery consequences.

Common codes:

| Code | Meaning | Repair |
|---|---|---|
| `tabs-not-allowed` | Indentation contains a tab | Replace it with two spaces |
| `invalid-indentation-width` | Indent is not divisible by two | Align to a two-space level |
| `indentation-jump` | A nested line skipped its parent level | Add the parent or reduce indentation |
| `unknown-declaration` | Unsupported top-level keyword | Use a documented declaration |
| `missing-property` | Required manifest/intent data is absent | Add the named property |
| `duplicate-semantic-id` | Same declaration kind repeats an ID | Rename one declaration |
| `invalid-condition` | Condition does not match explicit grammar | Rewrite using a supported form |
| `unknown-condition-target` | Condition references an undeclared ID | Declare or correct the target |
| `invalid-effect` | Effect does not match explicit grammar | Rewrite using a supported form |
| `unknown-effect-target` | Effect references an undeclared ID | Declare or correct the target |
| `unknown-frame-reference` | Intent lists a missing frame | Declare or correct the frame |
| `unreachable-frame` | Static graph has no path from initial frame | Add a transition or remove it |
| `static-dead-end` | Non-terminal frame has no possible intent | Add an intent or make it an ending |
| `missing-artifact-text-fallback` | Artifact has no complete textual equivalent | Add a `text` block containing the clue |
| `frame-without-required-performance` | A structured frame has guidance but no required meaning | Add at least one `exact` or `establish` line |
| `missing-frame-fallback` | A structured frame cannot survive generation failure | Add `fallback` or complete `text` lines |
| `missing-visual-asset` | Visual kind has no asset key or MIME | Add stable `asset` and approved `mime` values |
| `ambiguous-invention-scope` | A span omits an explicit allow or deny list | Add both lists, using `nothing` when appropriate |
| `invention-protection-conflict` | A span may invent protected content | Move the subject to `may not invent` |
| `missing-span-fallback` | Generation failure would leave no authored performance | Add complete text-only fallback lines |
| `span-intent-frame-mismatch` | An offered intent is unavailable inside its span | Add the span to the intent’s `frames` list |
| `missing-thread-payoff` | A required thread has no authored payoff | Add `pay_off at` or explicitly make it optional |
| `invalid-test-assertion` | An authored test assertion is not executable | Use hidden/revealed canon or artifact, frame, or status |

## Tester workflow

1. Compile the source and require zero errors.
2. Compile it a second time with the same source ID; serialized output must match exactly.
3. Verify source-map entries for changed declarations.
4. Start the compiled world through `engine-core`.
5. Exercise canonical success, failure, and reveal paths.
6. Replay collected events from the same initial snapshot.
7. Run `auditStoryline` on the path.
8. Serialize player/model projections and assert secret values are absent before reveal.
9. Add malformed fixtures for every new grammar feature.
10. Run authored tests and require `ok: true`.
11. Run bounded branch exploration; investigate every dead end, rejection, uncovered declaration, and incomplete search.

Repository-wide verification remains:

```bash
npm run check
npm run build
npm test
```

## Current limitations

- Span contracts compile, but AI-generated performances, beat-completion state, retry validation, and fallback selection are not yet connected to an AI Director.
- Frame performance contracts compile with stable beat IDs, but Director generation and runtime completion tracking are not yet connected.
- Static graph reachability is conservative. The branch explorer handles actual conditions within a bounded search, but it is not a proof for unbounded numeric worlds.
- Thread plant/payoff references are checked structurally; causal reveal timing and echo-domain validation are not yet symbolic.
- Choice groups do not change intent availability and currently serve authoring/presentation structure.
- The Agency source is still a design fixture, not yet accepted by this executable subset.

Treat these as visible compiler work, not permission to omit authored meaning from a published package.

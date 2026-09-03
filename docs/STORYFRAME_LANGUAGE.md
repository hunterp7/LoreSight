# Storyframe Narrative Language

Status: language design v0.1  
Working name only; no trademark clearance has been performed.

## The concept

Storyframe is a proprietary narrative keyframe language for the engine.

The creator authors the moments where meaning, causality, revelation, choice, and canon must be exact. Between those keyframes, the AI Director generates bounded connective play. This is analogous to animation: the artist establishes key poses; the system interpolates motion without changing what the movement means.

The generated material is not ungoverned “filler.” Every elastic span has a dramatic purpose, a turn budget, permitted inventions, forbidden conclusions, tone curves, and a required exit condition.

```text
FRAME ----------- ELASTIC SPAN ----------- FRAME
exact             AI performs within        exact
authored          a compiled contract        authored
```

## Why this is proprietary

The syntax alone is not a meaningful moat. The defensible system is the combination of:

- the narrative language;
- its compiler and static analysis;
- canon and secret-leak validation;
- deterministic mechanics bindings;
- narrative interpolation contracts;
- simulation and branch-coverage tooling;
- creator approval and versioning workflow;
- runtime quality evaluations accumulated across many worlds.

## Language primitives

### `WORLD`

Declares identity, ownership, compatibility, rights, and default presentation.

### `CANON`

Declares authoritative facts and negative space.

- `LOCK`: always true and directly usable.
- `SECRET`: true, but visible only after a reveal condition.
- `BRANCH`: established only within a particular playthrough.
- `OPEN`: AI may invent session-level detail within a stated boundary.
- `UNSAID`: intentionally unresolved; AI may not answer it.
- `NEVER`: prohibited claim, event, phrase, or implication.

`UNSAID` is critical. A mystery is not an invitation for a model to solve it.

### `CAST`

Defines characters as performance contracts rather than biographies alone.

- identity and role;
- known facts;
- goals and fears;
- voice dimensions;
- knowledge boundaries;
- permitted evolution;
- prohibited behavior;
- relationships and branch-dependent changes.

### `STATE`

Declares typed simulation variables such as flags, resources, clocks, inventory, relationships, clues, locations, and player knowledge.

### `THREAD`

Defines a narrative promise across multiple frames.

- where it is planted;
- permitted echoes;
- escalation requirements;
- deadline or optionality;
- where and how it pays off;
- what must remain unresolved.

This lets the compiler detect forgotten mysteries and unearned revelations.

### `FRAME`

A creator-controlled narrative keyframe. A frame defines what must be true when the player reaches it, what changes, what is revealed, and which choices are meaningful.

Frames can contain exact authored language, but they do not have to. The creator may lock the dramatic facts and let the AI perform the surface.

The compiler supports multiline player-facing text plus a scene performance contract with stable beat IDs:

```storyframe
FRAME archive_inspection
  title: Archive inspection
  text:
    - The cabinet is still sealed, but three details do not agree.
    - Choose what to inspect first.
  exact:
    - The archive was locked overnight.
  establish:
    - Three pieces of physical evidence conflict with the record.
  suggest:
    - Keep the room quiet and the evidence visually precise.
  never:
    - Identify the culprit before the reveal.
  fallback:
    - The thread, wax, and clock cannot all be telling the same story.
```

`text` remains the immediate player/tester scene projection. `exact`, `establish`, and `suggest` compile into stable, authority-labelled beats; `never` becomes a prohibited-claim list. A structured frame requires at least one `exact` or `establish` line and a complete `fallback` (or `text`) so generation failure never blocks play.

### `SPAN`

An elastic region between frames. A span grants a precise interpolation license to the AI Director.

It specifies:

- dramatic purpose;
- minimum and maximum turns;
- required beats that may occur in flexible order;
- tone, tension, humor, and pacing curves;
- permitted characters, locations, objects, and invention scopes;
- facts the player may learn;
- secrets that must remain inaccessible;
- exit condition and target frames;
- fallback authored text if generation fails.

### `INTENT`

A semantic player action. Hosts map buttons or free-form player language to an intent ID. The engine—not the model—validates whether it is currently legal.

### `CHOICE`

A set of available intents with conditions, costs, effects, and transitions. Choice labels may be rendered directly or performed conversationally.

### `ENDING`

A terminal or continuation frame with exact mechanical and canonical consequences.

### `TEST`

An authored expectation for compilation and simulation: required paths, forbidden reveals, invariant state, minimum branch coverage, or an exact sequence.

## Example

```storyframe
WORLD agency.applicant-intake v0.2
  title: The Agency — Applicant Intake
  owner: Hunter Priester
  rights: original
  engine: ^1.0

CANON agency
  LOCK lives_are_assignments:
    Human lives are temporary placements administered by the Agency.

  LOCK institutional_voice:
    The Agency describes catastrophe as routine administrative variance.

  SECRET intended_recipient:
    Applicant 71-442-B was assigned the player's current life.
    reveal only when clue_count >= 3

  UNSAID agency_origin:
    The origin and ultimate authority of the Agency remain unknown.

  NEVER direct_evil:
    The Agency never calls itself evil, supernatural, or malevolent.

CAST caseworker_43
  role: Interim Continuity Liaison
  wants: complete intake without acknowledging systemic failure
  voice: warm 4, procedural 5, confident 5, candid 1
  knows: intake_record, visible_clues, agency_public_policy
  does_not_know: agency_origin, warning_author
  never: invent relatives; openly condemn the Agency; explain the origin

STATE
  flag disputed_mortality = false
  clue clue_count = 0
  meter resistance = 0 range 0..5
  clock intake_deadline = 8 turns

THREAD stolen_life
  plant at mortality_review
  echo with misplaced_memory, duplicate_number
  reveal at original_assignee
  pay_off at disposition
  never resolve warning_author

FRAME mortality_review
  purpose: Make the player question whether being alive establishes ownership.
  present: caseworker_43
  establish:
    - The Agency's record says the player is between lives.
    - The player is visibly still alive.
  exact caseworker_43:
    "On a scale from one to ten, how completely did you die?"
  offer: confirm_alive, express_uncertainty, refuse_status
  on any:
    set disputed_mortality = true
    go memory_span

SPAN memory_span -> evidence_release
  purpose: Convert a bureaucratic mistake into doubt about personal memory.
  turns: 2..4
  required beats:
    - Caseworker 43 questions whether remembered childhood is firsthand evidence.
    - One harmless detail from the player's answer returns subtly misclassified.
  curve: humor 4 -> 2, dread 1 -> 5, intimacy 1 -> 3
  may invent:
    - temporary form numbers
    - procedural questions
    - unnamed office sounds
    - session-only sensory echoes derived from player input
  may not invent:
    - named employees
    - previous relatives
    - new Agency departments
    - the intended recipient
    - the Agency's origin
  persist inventions: session
  exit when: required_beats complete and disputed_mortality
  fallback:
    "Your memories have been accepted as supporting documentation against themselves."

FRAME evidence_release
  require: disputed_mortality
  reveal: personnel_a17, elevator_1974, childhood_kit
  objective: Examine the released records.
  offer: examine_visible_artifact

FRAME original_assignee
  require: clue_count >= 3
  reveal secret intended_recipient
  establish branch current_life_disputed = true
  exact artifact original_assignee_memo
  offer: retain_life, return_life, join_agency

ENDING retain_life
  require: current_life_disputed
  establish branch current_occupant_retained = true
  exact certificate continued_existence

TEST no_early_recipient_reveal
  play: mortality_review -> memory_span
  assert hidden: intended_recipient

TEST all_endings_reachable
  assert reachable: retain_life, return_life, join_agency
```

## Keyframe strictness

Each field has an authority level:

- `exact`: output must be used verbatim except accessibility transformations.
- `establish`: the meaning must become true; wording may vary.
- `reveal`: an existing secret becomes player-visible.
- `suggest`: optional dramatic guidance.
- `offer`: legal intent IDs exposed to the player.
- `never`: rejected if generated output states or strongly implies it.

This allows a creator to choose precision selectively. A climactic line may be exact while the physical description around it remains elastic.

## Interpolation budget

Every span compiles into a machine-readable `TweenContract`:

```ts
interface TweenContract {
  spanId: string;
  turnRange: { min: number; max: number };
  purpose: string;
  remainingBeats: RequiredBeat[];
  curves: NarrativeCurve[];
  visibleCanon: CanonFact[];
  hiddenCanonIds: string[];
  allowedEntities: string[];
  inventionRules: InventionRule[];
  forbiddenClaims: Constraint[];
  availableIntents: IntentDescriptor[];
  stateView: PlayerVisibleState;
  establishedSessionDetails: SessionDetail[];
  fallback: AuthoredPerformance;
}
```

The AI Director returns a structured `Performance`, not an unrestricted continuation:

```ts
interface Performance {
  narration: string;
  dialogue: Array<{ speakerId: string; text: string }>;
  completedBeatIds: string[];
  surfacedIntentIds: string[];
  proposedSessionDetails: SessionDetail[];
  referencedCanonIds: string[];
}
```

The validator can reject and retry a performance without rolling back game state. If generation repeatedly fails, the authored fallback preserves playability.

## Generated-detail memory

Interpolation must not produce continuity amnesia. Approved generated details enter a scoped ledger:

- `turn`: available only during the current response;
- `scene`: stable until the player leaves the scene;
- `session`: stable for the entire save;
- `proposal`: shown to the creator after play, never treated as canon automatically.

World-level persistence does not exist for generated material. Promotion to canon always requires creator approval and a new world version.

## Creator shorthand

The source language is the advanced surface, but the Creator Studio can generate it from visual controls:

- keyframes on a narrative timeline;
- draggable spans between them;
- tension and humor curves;
- reveal and payoff connections;
- locked/open/unsaid canon toggles;
- character voice sliders;
- choice and consequence maps;
- plain-language “must,” “may,” and “never” fields.

The creator can move fluidly between visual editing, Storyframe source, and compiled graph views without losing information.

## Compiler output

Storyframe source compiles into a versioned `WorldPack`, including:

- deterministic frames and transitions;
- validated intents, conditions, and effects;
- AI TweenContracts;
- separate player/model/creator projections;
- canon visibility rules;
- graph and thread indexes;
- fallback performances;
- conformance tests;
- source maps back to creator-authored lines.

The runtime never parses creative prose directly. It loads only validated compiler output.

The default authoring experience does not require creators to write Storyframe source. The Creator Studio captures plain-language intent and visual relationships, proposes a Storyframe translation, and requires semantic approval before compilation. See `CREATOR_STUDIO_UX.md`.

## Compiler failures

Compilation must fail when:

- a frame references an unknown entity or intent;
- an exact reveal contradicts locked canon;
- a secret can reach the model before its condition;
- a span has no purpose or exit condition;
- a required thread has no payoff;
- a choice has mechanical effects that are not declared;
- generated invention scope is ambiguous;
- an ending is unreachable;
- all routes through a required keyframe are blocked;
- a model would need hidden facts to perform the span.

## Executable compiler subset

The Phase 2 compiler implements a deterministic mechanics and bounded-narrative subset of the broader language design. It currently supports:

- `WORLD`, `STATE`, `CANON`, `CAST`, `FRAME`, `ENDING`, `INTENT`, `RULE`, `SPAN`, `THREAD`, `CHOICE`, and `TEST`;
- comments and exact source ranges;
- flags, clues, knowledge, resources, clocks, relationships, and inventory;
- explicit conditions for state, frame, location, status, and revealed canon;
- explicit deterministic effects, transitions, completion/failure, and seeded checks;
- compiled TweenContracts with turn budgets, required beats, narrative curves, invention boundaries, protected facts/artifacts, offered intents, exits, and authored fallback text;
- structural thread plant/reveal/payoff validation and explicit choice groups;
- deterministic authored-path tests and bounded branch/coverage exploration;
- generated semantic source maps;
- unknown-reference, indentation, duplicate-ID, initial-frame, static dead-end, and reachability diagnostics.

Frame performance contracts and stable beat IDs are implemented. The AI Director runtime, beat-progress ledger, and symbolic proof of condition-aware reachability remain active work. A span is currently entered and exited using ordinary deterministic intents; its TweenContract is validated and available to the Director boundary. The complete executable grammar, tester workflow, and current limitations are documented in `STORYFRAME_COMPILER_GUIDE.md`.

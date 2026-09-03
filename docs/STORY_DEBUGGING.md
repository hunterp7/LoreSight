# Storyline Debugging and Retrospective Correction

Status: implemented runtime, authored-test, coverage, and private-alpha admin foundation  
Audience: engine developers, world authors, QA testers, Creator Studio designers

## Purpose

Storyframe debugging answers four different questions without relying on raw chat transcripts:

1. Why was a player action available or unavailable?
2. What mechanical changes and reactive rules produced this outcome?
3. Where in the authored story did the responsible definition come from?
4. What would change if we corrected an earlier choice or revised the world?

The system treats a published playthrough as evidence. It does not edit that evidence. A correction is evaluated on a branch and shown as a diff before anyone adopts it.

## Architecture

```text
Storyframe source
      |
      | compiler emits semantic IDs + source ranges
      v
WorldPack + sourceMap -------------------------------+
      |                                               |
      v                                               v
engine-core -- commits operations + TurnTrace --> immutable event log
      |                                               |
      +------------------+----------------------------+
                         v
                  story-debugger
                  | explain intent/turn
                  | replay + semantic audit
                  | projection leak audit
                  | dead-end detection
                  | authored path tests
                  | bounded branch coverage
                  | fork + correction simulation
                  v
             privileged debug view
             timeline / source / branch diff
```

The package boundary is intentional:

- `world-schema` defines portable trace and source-map data.
- `engine-core` produces traces in the same deterministic transaction as events.
- `projections` remains the authority for audience filtering.
- `story-debugger` analyzes these artifacts but cannot publish canon or mutate storage.
- the future Creator Studio UI presents reports and requests explicit approval.

No React, MCP, database, or model dependency exists in the debugger package.

## Diagnostic records

### Source maps

`WorldPack.sourceMap` is keyed by a namespaced semantic ID such as `intent:inspect_red_thread` or `rule:reveal_culprit_after_three_clues`. Each entry identifies:

- semantic ID and declaration kind;
- source document ID;
- start and end line, column, and byte/character offset.

The compiler will generate these ranges. Hand-built conformance fixtures currently provide representative entries so the debugger contract can be tested before the parser is complete.

Source maps are creator/debug metadata. They are not included in player or model projections.

### Turn traces

Every `turn.committed` event now carries:

```ts
interface TurnTrace {
  intent: {
    intentId: string;
    frameMatched: boolean;
    condition?: Condition;
    conditionResult: boolean;
  };
  rules: Array<{
    ruleId: string;
    condition: Condition;
    conditionResult: boolean;
    outcome: "fired" | "condition-false" | "already-triggered";
  }>;
}
```

This is an explanation of deterministic mechanics, not hidden model chain-of-thought. Random checks remain explicit in `randomOutcomes`; state changes remain explicit in `operations`.

### Audit findings

`auditStoryline` returns all turn explanations, the replayed final state, and ordered findings:

| Code | Severity | Meaning | Typical response |
|---|---|---|---|
| `replay-failed` | error | Event order or an operation violates replay invariants | Inspect the first failing event and persistence boundary |
| `unknown-intent` | error | An event references an intent absent from the pinned world | Verify world/version pinning or migration |
| `invalid-trace` | error | A committed intent was not legal or cannot be resolved | Inspect pre-turn state and intent condition |
| `event-divergence` | error | Recorded operations, rolls, or traces differ from deterministic resolution | Check tampering, incompatible code, or wrong world release |
| `secret-projection-leak` | error | Unrevealed canon appeared in a player/model projection | Fix projection construction before further testing |
| `dead-end` | error | An active state exposes no legal intent | Add a route, ending, recovery action, or change its terminal status |
| `missing-source-map` | warning | A runtime definition cannot yet target authored source | Fix compiler/source-map coverage |

`report.ok` is false when at least one error exists. Warnings preserve a successful result but should fail the compiler conformance gate once source maps become mandatory.

## Public API

```ts
explainIntent(world, state, intentId): IntentExplanation
explainTurn(world, event): TurnExplanation
auditStoryline(world, initialState, events): StoryAuditReport
forkSessionAtVersion(world, initialState, events, version, branchId): CorrectionBranch
simulateCorrection(args): CorrectionSimulation
diffStates(before, after): StateDifference[]
runAuthoredWorldTests(world): AuthoredTestReport
exploreStoryBranches(world, options): StoryCoverageReport
```

All inputs are treated as values. The functions clone snapshots and never modify supplied state, event, or world objects.

### Authored test runner

`runAuthoredWorldTests` starts a fresh deterministic session per compiled `TEST`, commits its intent sequence with stable mutation IDs, then evaluates typed assertions against state plus player/model projections. A hidden assertion therefore checks the actual audience boundary, not merely a reveal-ID flag. Failures identify either the first rejected play step or the exact final assertion.

An empty test collection is valid and reports zero failures. Release policy should separately decide which worlds require authored tests; `ok: true` with `0 passed` is not evidence of useful coverage.

### Branch explorer

`exploreStoryBranches` performs bounded breadth-first execution. Its state fingerprint includes every mechanic that can affect future resolution—frame/status, location, state domains, reveals, one-shot rules, normalized ledger entries, and RNG state—while excluding session IDs, version counters, and mutation receipts. This collapses mechanically equivalent histories without hiding seeded-random divergence.

Read the result in this order:

1. `complete`: false means depth or state budget truncated the search.
2. `deadEnds` and `rejections`: both should normally be empty.
3. `unreachedFrameIds`, `unexercisedIntentIds`, and `unfiredRuleIds`: decide whether each is a defect, intentionally conditional content, or evidence the budget is too small.
4. percentage fields: useful summaries, never substitutes for the ID lists.
5. terminal and truncated paths: reproducible ordered intent sequences for manual inspection.

## User and tester workflow

### 1. Reproduce the reported path

Obtain the exact immutable inputs:

- `worldId`, `worldVersion`, and `engineVersion`;
- initial snapshot or a trusted snapshot boundary;
- ordered committed events after that boundary;
- seed and session ID.

Do not diagnose against “latest world.” A replay is meaningful only against the release to which the save is pinned.

### 2. Audit the history

```ts
const report = auditStoryline(world, initialState, events);
```

Start at the first error because later symptoms may be consequences. Use `eventId` and `stateVersion` to select the timeline entry. If `source` is present, open `source.range.sourceId` and highlight its line/column range.

Before manual exploration, also execute compiled tests and branch coverage:

```ts
const authored = runAuthoredWorldTests(world);
const coverage = exploreStoryBranches(world, { maxDepth: 16, maxStates: 2_000, seed: 42 });
```

Use a failed authored path as the smallest regression reproduction. Use a coverage path to reproduce a dead end or reach an otherwise unclear rule. Increase budgets deliberately and keep them bounded on remote/admin requests.

### 3. Explain the causal turn

```ts
const turn = explainTurn(world, events[index]);
```

Review in this order:

1. intent source and pre-turn version;
2. recorded condition and whether its frame matched;
3. operations in commit order;
4. each rule outcome;
5. seeded random outcomes;
6. post-turn frame and available intents.

For a choice the tester expected to see but did not, call `explainIntent` against the pre-turn state. It identifies whether the session status, current frame, or declared condition blocked it.

### 4. Choose the correction type

There are two materially different repairs.

#### Save-history correction

Use this when the mechanics are correct but an earlier test choice, imported event, or support recovery needs an alternate history.

```ts
const simulation = simulateCorrection({
  world,
  initialState,
  events,
  forkAtVersion: 4,
  branchSessionId: "session-123-correction-a",
  command: { intentId: "take_other_route" },
  mutationId: "support-correction-001",
});
```

Inspect `simulation.correction` and `simulation.differences`. The original save remains unchanged. Persisting or promoting the branch is an application-level privileged action and is intentionally not performed by this package.

#### World/story correction

Use this when the audit finds a structural flaw such as a dead-end, bad reveal condition, contradictory canon, or missing recovery route.

1. Create a draft derived from the published source.
2. Edit the source-located definition.
3. Compile and audit all canonical and generated paths.
4. Review canon, graph, and save-compatibility diffs.
5. Publish a new immutable world version.
6. Add an explicit migration only if old saves can safely enter the new version.

Never silently run old events against a different published version and call the result repaired.

### 5. Record the resolution

A future Creator Studio correction record should store:

- original session and event/version boundary;
- branch session ID;
- operator and reason;
- proposed command or world-version change;
- before/after state diff;
- audit results before and after;
- approval/rejection identity and timestamp.

This is application audit metadata, not part of deterministic game state.

## Debugger and admin UI

The private-alpha React admin already exposes world compile/test/coverage health, deterministic playtests, event audits, in-memory draft compilation, artifacts, and immutable correction proposals. The fuller Creator Studio debugger remains a planned privileged surface with five coordinated panes:

1. **Timeline:** turns, versions, rule firings, warnings, and the first failing boundary.
2. **Causal trace:** intent condition, operations, rule outcomes, and random rolls.
3. **Source inspector:** source-mapped Storyframe range with nearby declarations.
4. **State diff:** before/after values grouped by resources, clues, canon, relationships, inventory, and frame.
5. **Correction branch:** choose a fork boundary, simulate an alternate legal intent, rerun the audit, and submit for approval.

The React UI will use Storyframe-owned `ui-kit` wrappers over Retro React primitives. Likely mappings are `Terminal` for the trace console, `Tabs` for state/projection/source views, and `ProgressBar` for simulation coverage. `Marquee` is decorative and must never carry diagnostic content. Reduced motion, keyboard navigation, semantic tables, copyable IDs, and non-color error cues are required.

The player widget will not expose creator/debug state. A limited player-facing “report a problem” affordance may submit session/version IDs and consented context, but source maps, hidden canon, and debug projections remain privileged.

The same projection audit also checks unrevealed artifact IDs, titles, summaries, alt text, and textual fallback. Asset visibility is therefore enforced before React receives anything; hiding an evidence card with CSS is not considered secrecy.

## Security and privacy

- Authorize every debugger request against world and session ownership/role.
- Treat full debug state as sensitive because it contains secrets and creator-only ledgers.
- Redact or omit player free text unless it is required and the player consented to support review.
- Never send a full debug report to the AI Director or ChatGPT model context.
- Log correction approval separately from the event log.
- Rate-limit large replay/simulation requests and cap branch exploration.

## Current limitations and next work

- Branch exploration uses one configured seed. Worlds with meaningful seeded alternatives need runs over an approved seed set or a future random-branch enumerator.
- Coverage is bounded state exploration, not symbolic proof; `complete: false` must remain visible.
- Authored assertions currently cover hidden/revealed canon and artifacts, final frame, and final status. Numeric/resource/relationship assertions are next grammar work.
- Correction simulation replaces the next turn at a fork; multi-turn branch editing and promotion belong in application services.
- Older event formats without `TurnTrace` need an explicit import/migration policy before durable alpha data exists.
- The current diff treats arrays as ordered values; a later UI adapter should group set-like clue/knowledge changes as additions and removals.

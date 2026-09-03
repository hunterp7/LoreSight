# Storyframe Creator Studio UX

Status: product interaction model v0.1

## Experience promise

Describe the story in human terms. See what the system understood. Approve the meaning, not the machinery.

Storyframe source is an inspectable and exportable intermediate language. It is not the default authoring surface.

## The central design decision

The Studio has two representations of the same world:

```text
HUMAN AUTHORING MODEL                 COMPILED AUTHORING MODEL

Critical moments                     Frames
What must be true                    Conditions
What changes                         Effects and events
What the player knows                Knowledge state
What the player has                  Inventory state
How someone feels about the player   Relationship state
What must remain hidden              Secret projections
How long this should breathe         Turn ranges and clocks
What AI may improvise                TweenContracts
Emotional movement                   Narrative curves
```

The mapping is lossless and round-trippable. Editing the visual/plain-language representation updates Storyframe source. Editing source in Advanced Mode updates the visual representation.

## Primary workspace

The default interface is a story spine, not a dashboard or a programming node graph.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ THE AGENCY / APPLICANT INTAKE              Preview   Test   Publish │
├───────────────────┬──────────────────────────────────┬───────────────┤
│ STORY LIBRARY     │ STORY SPINE                      │ STORY GUIDE   │
│                   │                                  │               │
│ Canon             │  ○ Mortality Review              │ What must     │
│ Characters        │  │                               │ happen here?  │
│ Places            │  ┆  Memory Doubt                 │               │
│ Objects           │  │  2–4 flexible turns           │ [plain text]  │
│ Threads           │  ○ Evidence Released             │               │
│ Endings           │  │                               │ What should   │
│                   │  ○ Original Assignee Revealed    │ players feel? │
│                   │  ├─ Retain Life                  │ [curve]       │
│                   │  ├─ Return Life                  │               │
│                   │  └─ Join Agency                  │ AI freedom    │
│                   │                                  │ [summary]     │
├───────────────────┴──────────────────────────────────┴───────────────┤
│ WHAT THE ENGINE UNDERSTOOD     3 rules • 1 reveal • 3 choices       │
└──────────────────────────────────────────────────────────────────────┘
```

The spine shows authored keyframes as solid moments and AI-interpolated spans as flexible connective regions. Branches appear only where player decisions actually create divergent state or content.

## Creating a critical moment

Selecting **Add critical moment** opens a guided narrative contract. It asks ordinary creative questions:

1. What happens here that cannot be missed?
2. What should the player understand afterward?
3. What must already have happened before this moment?
4. Who is present, and what does each person want?
5. What meaningful decision can the player make?
6. What changes because of that decision?
7. Is any wording, image, document, or action exact?
8. What must not be revealed or implied yet?
9. How should this moment feel?

The creator may answer only the questions that matter. Defaults remain explicitly visible and reversible.

## Creating the space between moments

Selecting a span asks:

1. What dramatic work should happen between these moments?
2. Roughly how long should it breathe?
3. What smaller beats must occur somewhere in the span?
4. How should the emotional temperature change?
5. What details may AI invent?
6. What people, places, facts, or answers are off limits?
7. What tells us the span is complete?
8. What should happen if generation is unavailable?

The UI translates answers into a `TweenContract`. The creator sees a human summary, not the contract fields.

## “What the engine understood”

Every edit produces a semantic interpretation panel before it becomes authoritative.

Example:

> **Critical moment**  
> The player learns that their current life was assigned to someone else.
>
> **It becomes available after**  
> The player has examined the personnel record, elevator log, and childhood product.
>
> **This establishes**  
> The current life is disputed in this playthrough.
>
> **The player may then**  
> Keep the life, return it, or seek employment with the Agency.
>
> **Protected information**  
> The author of the handwritten warning remains unresolved.
>
> **AI may embellish**  
> Caseworker reactions and environmental details. It may not add employees, relatives, departments, or explanations of the Agency’s origin.

The creator can select any sentence and choose **Change**, **Lock**, **Let AI decide**, or **Keep unresolved**.

## Semantic state instead of variables

Creators should rarely create variables directly. They create concepts the engine can track.

### Facts and events

- “The player disputed their mortality.”
- “The elevator log has been examined.”
- “The intended recipient has been revealed.”

The compiler generates stable event and fact IDs.

### Player knowledge

- “The player knows memories can be transferred.”
- “The player suspects Caseworker 43 is withholding something.”

Knowledge is distinct from world truth. A player may believe something false.

### Possessions and evidence

- “The player has the damaged personnel record.”
- “The record has been authenticated.”

The compiler selects inventory, clue, or document mechanics based on behavior rather than nouns.

### Relationships

- “Caseworker 43 becomes less certain around the player.”
- “The player’s resistance makes direct answers less likely.”

The UI can show a labeled spectrum while the compiler creates a bounded relationship meter.

### Time and pressure

- “This should happen within three to five turns.”
- “Each delay makes reassignment more likely.”

The compiler generates span budgets, clocks, and reactive rules.

## Translation examples

| Creator writes | Studio confirms | Compiler creates |
|---|---|---|
| “After all three records are reviewed” | Requires three specific reviews | An `all(...)` condition over three facts |
| “Make Caseworker 43 slightly less confident” | Confidence decreases one step | A bounded relationship/voice-state effect |
| “Keep the warning’s author mysterious” | Intentionally unresolved everywhere | `UNSAID` canon plus a prohibited claim |
| “Let this breathe for two to four turns” | Span lasts 2–4 committed turns | A turn range and exit guard |
| “The player can refuse to answer” | Adds a persistent refusal intent | An intent, effect, event, and available-command rule |
| “Use something personal from their answer” | May echo one low-risk detail for this save | A session-scoped invention permission |

## Conversational Story Guide

The Story Guide is a collaborator inside the editor, not the editor itself.

It can:

- convert an outline or voice note into proposed moments;
- ask one high-impact question at a time;
- notice missing causality, payoffs, choices, or fallback text;
- suggest interpolation spans;
- explain compiler errors in plain language;
- generate alternatives without applying them;
- compare the current draft with approved canon;
- summarize what changed before approval.

It cannot silently:

- add canon;
- resolve an intentionally unanswered mystery;
- alter consequences;
- introduce a required mechanic;
- make content public;
- accept its own proposal.

## Canon workspace

Canon is presented as a library of understandable statements, not a database table.

Each statement has one visible control:

- **Always true** (`LOCK`)
- **True but secret** (`SECRET`)
- **Depends on player choices** (`BRANCH`)
- **AI may invent here** (`OPEN`)
- **Must remain unanswered** (`UNSAID`)
- **Must never happen** (`NEVER`)

Characters, places, objects, factions, and timeline entries collect the relevant statements without hiding their global relationships.

## Review and approval

The Studio separates three states:

- **Draft:** editable and potentially incomplete.
- **Ready to test:** structurally valid but not canonically published.
- **Published:** immutable version used by live sessions.

Before approval, the creator reviews a narrative delta:

- new or changed canon;
- new secrets and reveal conditions;
- altered choices and consequences;
- newly authorized AI invention;
- unresolved warnings;
- existing saves affected by the change.

## Playtest mode

The creator can play any branch while seeing a collapsible explanation layer:

- why this moment is available;
- what state changed after a choice;
- which content was authored versus interpolated;
- which session details AI established;
- which required beats remain;
- what protected information the model did not receive;
- which Storyframe source lines produced the behavior.

At any point the creator can annotate a response:

- “Keep this wording”
- “Never do this again”
- “Make this possible but rarer”
- “This detail should persist”
- “Propose this as canon”

Annotations become explicit edits or proposals; they do not train an invisible personal model.

## Advanced Mode

Advanced Mode provides:

- Storyframe source editor;
- compiled world-package inspector;
- state and event log;
- model projection preview;
- source maps;
- deterministic replay controls;
- raw diagnostics.

This is an escape hatch for precision and debugging, not a prerequisite for authorship.

## Progressive disclosure

The default experience reveals complexity only when it becomes useful:

### Level 1: Outline

Premise, critical moments, endings, and emotional movement.

### Level 2: Meaning

Prerequisites, revelations, choices, consequences, and AI freedom.

### Level 3: Systems

Resources, clocks, relationships, markets, checks, and stateful mechanics.

### Level 4: Source

Storyframe and compiled engine representation.

## UX anti-patterns

- A blank chatbot as the entire authoring environment
- A giant node graph that turns every line into spaghetti
- Exposing boolean flags and internal IDs as the primary language
- Applying AI interpretations without confirmation
- Asking creators to complete every possible field
- Hiding causality behind generated prose
- Treating emotional direction as a single genre or tone dropdown
- Using “magic generation” in place of visible story structure
- Making source code the only route to precise creative control

## First prototype scope

The first Creator Studio prototype should prove one workflow:

1. View the Applicant Intake spine.
2. Add or edit one critical moment in plain language.
3. Edit the elastic span before it.
4. Review “What the engine understood.”
5. Approve the proposed Storyframe change.
6. Playtest the affected route with authored/interpolated labels.

Do not build the complete canon library, asset manager, marketplace, analytics, collaboration, or publishing administration before this loop feels natural.

## Implemented scene-editor slice

The private admin console's **Studio** view now proves the smallest scene contract loop:

1. edit a scene name and player opening in ordinary language;
2. distinguish exact wording from meaning that may be performed flexibly;
3. keep optional direction, protected claims, and backup narration behind progressive disclosure;
4. inspect a live orange-CRT player preview;
5. read a three-line **What the engine understood** summary;
6. compile the generated Storyframe contract;
7. optionally inspect or override Advanced Storyframe source;
8. save the draft privately and restore it after a server restart.

Saving remains a draft operation. It does not approve semantic meaning, change published canon, or create an immutable release. The next Studio milestone is a reviewable source/semantic delta and explicit approval step before playtesting the affected route.

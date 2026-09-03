# Architecture Decisions

These decisions are binding until replaced by a dated decision record.

## ADR-001: Build an engine; ship worlds

The reusable product is a deterministic turn-based narrative engine. The Agency is its first world pack and conformance test.

## ADR-002: Canon belongs to the creator

AI may draft and perform. Only an explicit creator approval can change published canon. Published world versions are immutable.

## ADR-003: Reducer before renderer

All gameplay is resolved in a pure engine boundary. React and ChatGPT display and submit commands; neither owns simulation rules.

## ADR-004: Constrained emergence

Worlds declare which details are locked, secret, branch-dependent, or intentionally open. AI invention is allowed only inside declared open spaces and remains session-level unless approved.

## ADR-005: Event log plus snapshots

Every committed turn produces events and a new snapshot version. This enables replay, debugging, analytics, migration, and retry safety.

## ADR-006: Capabilities, not genres

The engine exposes composable mechanics—resources, clocks, routes, markets, relationships, clues, checks—rather than genre-specific code paths.

## ADR-007: Rights are package metadata

Every world declares provenance and distribution rights. Private user-supplied remixing does not imply the right to publish or monetize it.

## ADR-008: Host independence

The same world and save must run through ChatGPT, web, CLI, or automated simulation without changing game results.

## ADR-009: Narrative keyframes and bounded interpolation

Creators author critical frames, consequences, reveals, and dramatic curves in Storyframe. AI performs only inside compiled elastic spans and cannot alter keyframe meaning or mechanics.

## ADR-010: Unknown is not open

Canon distinguishes intentionally open invention space from deliberately unresolved information. AI may elaborate `OPEN` areas but may not answer `UNSAID` mysteries.

## ADR-011: Human authoring model before compiler model

The default editor uses plain-language critical moments, story meaning, choices, consequences, and AI permissions. Storyframe source remains inspectable and round-trippable but is an advanced surface.

## ADR-012: AI interpretation requires semantic approval

Natural-language input produces a proposed “What the engine understood” contract. Major facts, reveals, consequences, and invention permissions do not become authoritative until the creator approves their meaning.

## ADR-013: Retro React is the player-widget component library

The ChatGPT player widget is React-based and uses the MIT-licensed `retro-react` library for visual primitives. Storyframe wraps selected components behind its own `ui-kit` and semantic theme tokens so world presentation, accessibility requirements, MCP Apps bridge behavior, and game rules remain independent of the library. Reduced motion, keyboard support, responsive layout, and deterministic typography remain Storyframe responsibilities.

## ADR-014: Debug by tracing and branching, never by rewriting history

Every committed turn records a deterministic semantic trace: why its intent was legal, which reactive rules were evaluated, and which rules fired. Compiler source maps connect semantic IDs in that trace to authored Storyframe ranges. Diagnostic audits replay the immutable event log, compare each event with the result the pinned world deterministically produces, inspect audience projections, and report source-located failures.

Retrospective correction creates a new session branch at an exact state-version boundary. It never edits the original snapshot or events. A creator-facing diff must be reviewed before a correction becomes an accepted save branch. A structural correction to published story rules or canon requires a new immutable world version and, where compatible, an explicit save migration.

## ADR-015: Storyframe uses explicit two-space indentation and rejects ambiguity

The compiler tokenizes non-empty lines, preserves comments and exact source ranges, and parses a typed indentation tree. Each nesting level is exactly two spaces; tabs, odd indentation, missing parents, unknown top-level declarations, and unsupported mechanics are source-located errors with repair guidance. The compiler never guesses whether prose implies a condition, effect, reveal, or transition. Advanced narrative constructs may be added incrementally, but only with explicit grammar and deterministic compilation tests.

## ADR-016: Remote adjustments are proposals against immutable evidence

The operations console may inspect privileged state, run compilers and audits, create playtest sessions, submit legal test intents, and simulate retrospective corrections. It may not rewrite an original event log or published world. A session correction produces a branch simulation and a reviewable proposal; a structural story correction produces a new draft and eventually a new immutable world version. Production promotion requires a separate authenticated application service, durable audit record, and role-based approval.

## ADR-017: Visual artifacts are occasional evidence with complete textual equivalents

Storyframe remains text-first. A visual artifact is an authored clue object revealed by an engine effect, not decoration injected by a renderer. Images, maps, and diagrams require alt text, caption/context, a complete textual fallback, provenance, approved MIME type, stable asset key, and audience projection. The model receives the textual evidence but not the image asset reference. A visual may deepen recognition or interpretation, but no required deduction may depend exclusively on sight.

## ADR-018: One render tool owns the persistent player iframe

The ChatGPT player uses an interactive-decoupled MCP Apps architecture. Data and mutation tools return concise player projections without UI metadata. Only `open_story_interface` attaches the versioned widget resource. Component actions submit semantic intents with an expected state version and mutation ID, then replace their snapshot with the returned server projection. Non-authoritative preferences may use host widget state; simulation state never does.

## ADR-019: The terminal renderer and physical player shell are separate

The accessible terminal viewport is the stable player renderer. Its outer physical frame is a presentation-only `PlayerShell`: either Storyframe's default CRT or a constrained authored surround supplied by compiled world metadata. Authored shells use approved presets, bounded labels, and validated semantic color tokens; they cannot inject raw CSS, HTML, URLs, scripts, or mechanics. Pixelarticons provides the approved single-color semantic icon vocabulary for items and artifacts, always alongside textual identification.

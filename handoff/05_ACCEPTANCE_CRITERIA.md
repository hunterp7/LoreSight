# Acceptance Criteria

## Engine architecture

- `engine-core` imports no React, MCP, database, OpenAI, or world-specific code.
- The Agency is loadable content, not a conditional path in the engine.
- Investigation, survival, and trading fixtures run through one public API.
- Saves are serializable and versioned.
- State changes are transactional, replayable, and idempotent.
- Same inputs and seed reproduce the same mechanical outcome.

## Storyframe compiler

- Valid source compiles deterministically.
- Diagnostics include source location and plain-language repair guidance.
- Unknown references, incompatible effects, and ambiguous invention scopes fail.
- Required keyframes and endings receive reachability analysis.
- Required narrative threads must have a declared payoff or explicit abandonment rule.
- A secret cannot enter player/model projection before reveal.
- `UNSAID` facts remain unavailable for AI interpolation.
- Source maps support selection from Studio to source and diagnostics back to Studio.

## Creator control

- Plain-language input creates a proposed semantic interpretation.
- Canon, reveals, consequences, and AI permissions are never approved automatically.
- **What the engine understood** is readable without engine terminology.
- Creators can mark elements exact, guided, open, unresolved, or prohibited.
- Published versions are immutable.
- Generated material can be proposed but never silently promoted to canon.

## AI interpolation

- AI receives only visible canon and permitted invention scope.
- Performance output is structured and validated.
- Invalid generations do not mutate simulation state.
- Authored fallback completes the turn when generation fails.
- Generated details persist only at turn, scene, or session scope unless separately approved.
- Evals cover secret leakage, unknown entities, mechanical invention, voice drift, repetition, and pacing.

## Character recap

- Recaps derive from structured character ledgers and events, not raw chat summaries.
- Player recap contains only legitimately learned information.
- Creator recap includes canon, secrets, beliefs, lies, branches, generated details, unresolved threads, and source history.
- The AI Director receives the smallest relevant character projection.
- A recap can explain where each key fact was established.

## Player application

- A new user can begin through natural conversation.
- Legal actions remain understandable without forcing button-only play.
- Widget actions update the mounted UI without unnecessary remounts.
- Characters, places, clues/objects, and timeline are available as memory surfaces.
- UI supports keyboard, mobile, high contrast, reduced motion, and useful alt text.
- The complete Agency case is playable after server restart with durable persistence enabled.

## Creator Studio

- The first view reads as a living story spine, not a database or node graph.
- A creator can add one critical moment without seeing a variable or ID.
- A creator can define an elastic span through dramatic questions.
- Authored, interpolated, and proposed material are visibly distinct in playtest.
- Advanced Mode exposes source, projections, events, replay, and diagnostics.

## Graphics

- All production assets have provenance, rights, canon, approval, alt-text, and responsive metadata.
- Generated text inside visual artifacts is replaced with deterministic typography.
- No recognizable third-party visual assets or direct stylistic copies are shipped.
- Asset size and loading do not compromise the ChatGPT widget.

## Deployment

- Production uses stable HTTPS, configured CSP, secret management, rate limiting, logs, metrics, and error visibility.
- Privacy, support, terms, deletion, and export paths exist before public submission.
- ChatGPT Developer Mode test passes against the hosted endpoint.
- Submission happens only after a fresh review of official plugin requirements and explicit owner approval.


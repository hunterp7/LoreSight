# LoreSight story modes

LoreSight has three entry paths. They share the same player shell, but each has a different source of truth.

## Create new story

Create is fully generative. The user supplies an idea and optional tone, comic approach, replay goals, or content boundaries. The authoring flow first builds a narrative brief covering the world, cast, voices, places, objects, command vocabulary, mechanics, branch map, replay variations, and endings. It then maps the brief to capabilities the selected Z-machine format can actually represent before drafting the playable story in passes: world skeleton, critical scenes, connective performance, and a playability audit.

New stories can take large creative risks. They may invent new settings, characters, objects, mechanics, and endings when those ideas fit the supported runtime. They still need legal commands, reachable outcomes, coherent state, and an explicit review before the draft becomes playable or publishable.

## Remix a story

Remix requires a source: either a catalogued story or a user-provided Z-machine file. The original artifact stays read-only. Before any dialogue or choice is changed, the source is inspected into a dossier covering format, rooms, settings, objects, items, characters, voices, command grammar, state flags, inventory rules, transcripts, branch points, endings, pacing, recurring humor, and likely hidden paths. A fidelity map then separates what must stay close, what can flex, and what the player's prompt explicitly allows to become wild.

The remix proposal includes a source/new-content diff, changed-state plan, playability audit, and rights declaration. If a binary cannot be inspected, the system must say so and request a playable source or transcript rather than inventing an understanding of the original.

## Play a Z-machine file

Play uses the existing interpreter path for `.z3`, `.z5`, `.z8`, and `.zblorb` files. The browser loads the selected file locally and starts an interpreter session; the server does not read the user's filesystem. Catalogued binaries use the same path.

## Shared job lifecycle

Generative work is represented as `draft → inspecting → generating → review → compiling → testing → ready` (or `failed`). Every published result is a separate immutable story version. The player remains usable if generation fails by showing an authored error and retry action.

## Current UI slice

The terminal-first landing surface presents Create, Remix, and Play choices in the CRT language. Create uses the portable MCP Apps message bridge to continue a guided generative intake when LoreSight is mounted in ChatGPT. In the standalone preview it starts a deterministic playable story immediately, so the form never ends at a dead handoff state. Remix dispatches `loresight:remix-story` with an explicit source selection for the host flow. Native Library and Load actions remain available beneath the CRT for ChatGPT hosts. Story loading uses a brief CRT signal-lock wake-up rather than a floppy-disk insertion animation, so the interaction remains consistent with the frameless terminal design.

## Generation quality gates

Both modes must pass a structured review before a playable draft is accepted:

1. Every generated choice maps to a legal command and a meaningful continuation.
2. State changes, inventory, flags, counters, and endings remain internally consistent.
3. New and Remix drafts do not promise mechanics outside the supported Z-machine formats.
4. Remix reports what stayed faithful and what intentionally changed.
5. Playability checks catch dead ends, unreachable endings, repetition, voice drift, and unsupported mechanics.

Campy humor should come from original character voices, precise comic details, escalating reversals, and deadpan confidence beside real stakes. Named games may be used as high-level tonal references only; their characters, dialogue, phrasing, settings, and protected story material are not copied.

## Next implementation gates

1. Add server actions for creating and remixing jobs.
2. Add importer and rights/provenance records for remix sources.
3. Add structured proposal schemas and compiler validation.
4. Add review/diff and generation progress states.
5. Add deterministic replay, invalid-command, idempotency, and secret-projection tests for generated worlds.

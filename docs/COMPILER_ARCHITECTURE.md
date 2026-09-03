# Storyframe Compiler Architecture

Status: Phase 2 foundation implemented  
Audience: compiler, engine, Creator Studio, and tooling developers

## Responsibility

The compiler is the trust boundary between creator-authored source and server-authoritative simulation. The runtime never parses creative source. It accepts only a compiled `WorldPack` whose mechanics, references, graph, rights metadata, and source mapping passed validation.

The compiler does not infer mechanics from prose. A sentence such as “the player probably loses a supply” is narrative text, not an effect. Mechanical meaning must use an explicit grammar form.

## Package boundary

`packages/storyframe` depends only on `world-schema`. It imports no engine, React, MCP, database, model, or Agency code.

Public API:

```ts
lexStoryframe(source, sourceId): LexResult
parseStoryframe(source, sourceId): ParseResult
compileStoryframe(source, sourceId): CompileResult
```

The package exposes AST and diagnostic types for Creator Studio, editor tooling, tests, and future language services.

## Pipeline

```text
UTF-8 source string
      |
      v
line lexer
  - comments retained
  - tabs/indent width checked
  - line/column/offset ranges
      |
      v
indentation parser
  - typed top-level declarations
  - property/list/instruction body nodes
  - parent-child tree
  - declaration ranges expanded over children
      |
      v
semantic compiler
  - manifest and rights
  - initial state domains
  - canon and cast
  - frames and endings
  - intents, conditions, effects, rules
  - spans, threads, choices, authored tests
      |
      v
semantic validators
  - required fields and unique IDs
  - state/canon/frame effect targets
  - initial frame
  - conservative graph reachability
  - non-terminal static dead ends
  - span invention/protection and fallback boundaries
  - thread payoff and authored-test references
      |
      +---- errors -> source-located diagnostics + repair guidance
      |
      v
deterministic WorldPack + semantic sourceMap
```

## Lexer invariants

- One indentation level is exactly two ASCII spaces.
- Tabs are invalid even though the lexer calculates a recovery indentation so later diagnostics can still be emitted.
- Blank lines are ignored structurally.
- Comment tokens are retained separately in the document.
- Start and end positions include one-based line/column and zero-based absolute offset.
- An indentation increase of more than one level is invalid because it lacks an explicit parent.

The lexer is deliberately line-oriented. Storyframe narrative blocks can later add explicit multiline token rules without weakening indentation determinism.

## AST model

Top-level declarations use a closed `DeclarationKind` union:

```ts
type DeclarationKind =
  | "WORLD" | "CANON" | "CAST" | "STATE"
  | "FRAME" | "SPAN" | "THREAD" | "INTENT"
  | "CHOICE" | "RULE" | "ENDING" | "TEST";
```

Nested nodes are typed as `property`, `list-item`, or `instruction`. Each node retains its source range and children. This generic syntactic AST is distinct from `WorldPack`: unsupported declarations can be parsed and displayed by an editor before their semantic compiler exists.

Parsing a declaration does not imply semantic support. Compilation must emit a visible error before any authored meaning could be lost. All current declaration kinds now have a semantic compiler; individual broader-language clauses remain unavailable until they receive explicit grammar, schema, validation, tests, and documentation.

## Semantic compilation

Compilation occurs in stable source order. Output arrays and source-map insertion order are deterministic for the same source and source ID.

Compiler passes collect declarations before compiling references:

1. frames and endings;
2. canon IDs;
3. cast IDs;
4. initial state definitions;
5. intents and conditions/effects;
6. reactive rules;
7. TweenContracts, thread indexes, choice groups, and authored tests;
8. cross-contract and story graph validation;
9. manifest construction.

Conditions and effects use bounded parsers and produce typed `world-schema` objects. Unknown syntax emits an error and a safe placeholder only to allow diagnostic recovery; any error prevents a `WorldPack` result.

## Source maps

`WorldPack.sourceMap` uses namespaced keys:

```text
world:<id>
state:flag.<id>
state:resource.<id>
state:clue.<id>
canon:<id>
character:<id>
frame:<id>
ending:<id>
intent:<id>
rule:<id>
span:<id>
thread:<id>
choice:<id>
test:<id>
```

An ending also receives a `frame:<id>` entry because the engine treats it as a reachable frame. Each value contains the semantic ID, kind, source document ID, and complete declaration range.

The debugger resolves runtime trace IDs through this map. Creator Studio will use the same entries for click-to-source selection, diagnostic highlighting, graph selection, and before/after semantic reviews.

## Graph validation

The current graph validator is intentionally conservative:

- intent transition effects create edges from their declared frames;
- an intent with no frame restriction is considered available from every frame;
- reactive-rule transitions are considered possible from every frame;
- seeded-check branch transitions are both included;
- spans are graph nodes with a structural edge to their authored target;
- span dead-end analysis uses only the intents explicitly offered by the span;
- every declared frame must be reachable from the initial frame;
- each non-terminal frame must declare at least one possible intent.

This catches obvious structural faults without claiming condition satisfiability. A later symbolic/simulation pass must determine whether conditions make an apparently connected route impossible and whether every required ending is reachable under actual state constraints.

`story-debugger.exploreStoryBranches` complements this conservative compile-time graph. It performs bounded breadth-first execution over distinct mechanical states using the real resolver, conditions, seeded randomness, and rule order. This is stronger evidence than structural reachability, but still not a formal proof when depth/state budgets truncate the search or numeric mechanics create an unbounded state space.

## Executable narrative contracts

Advanced declarations remain data, not prose interpreted by the engine:

- `SPAN` emits a `TweenContract` with a target, positive turn range, stable required-beat IDs, curves, explicit allow/deny invention lists, persistence scope, protected IDs, offered intents, exit contract, and fallback lines.
- `THREAD` emits plant, echo, reveal, payoff, and never-resolve references. Required threads without a payoff fail compilation.
- `CHOICE` groups existing intents for named frames without copying their conditions or effects.
- `TEST` emits a seed, ordered legal intents, and typed final assertions.

The compiler rejects incomplete contracts, unknown references, a span-offer/frame mismatch, protected subjects reintroduced through invention permissions, and exact protected text in fallbacks. The future AI Director must consume the contract through a separate validated performance boundary; it may not directly mutate `GameState`.

## Error recovery

`compileStoryframe` returns a discriminated result instead of throwing for author errors:

```ts
if (!result.ok) {
  for (const diagnostic of result.diagnostics) {
    showRange(diagnostic.range);
    showRepair(diagnostic.guidance);
  }
}
```

Unexpected I/O failures belong to the caller. Syntax and semantic problems belong in diagnostics. A diagnostic includes severity, stable code, plain-language message, repair guidance, and exact source range.

## Security considerations

- Compilation must remain deterministic and side-effect free.
- Source text is untrusted input; bound file size, line count, nesting, and diagnostics at the application boundary.
- The compiler never reads files named by source content or evaluates expressions as JavaScript.
- Rights metadata is required but still needs publishing-policy verification.
- Source maps and full canon are creator/debug data and must not enter player/model projections.
- A successful compile is necessary but not sufficient for public publishing; provenance and approval remain application responsibilities.

## Extension procedure

For every grammar addition:

1. update the language and executable grammar documentation;
2. add AST/compiler types without weakening existing syntax;
3. add a valid fixture and expected runtime behavior;
4. add malformed and ambiguous fixtures with diagnostic assertions;
5. add source-map assertions;
6. add deterministic double-compilation assertions;
7. add projection/replay tests if the feature affects secrets or state;
8. update the Creator Studio semantic review language.

Do not accept a feature by silently storing unvalidated strings in `WorldPack`.

# AI Director Runtime

Status: validated frame-performance foundation plus disabled-by-default OpenAI Responses adapter  
Audience: StoryFrame runtime developers, world authors, and playtest operators

## What it does

`@storyframe/ai-director` performs a compiled frame without granting a model authority over mechanics or canon. It receives the model-safe projection, the frame's authored performance contract, and a separate narrative-progress ledger. It accepts only structured output that passes validation. Provider failure or rejected output produces the frame's authored fallback.

The Director never calls `resolveTurn`, changes `GameState`, reveals canon, unlocks an intent, or writes a world package. Its progress is narrative application data stored beside the authoritative save.

## Runtime flow

```text
WorldPack + GameState
        |
        +-- projectModelView (secrets physically excluded)
        |
        +-- current FramePerformanceContract
        |
        +-- DirectorProgress
        v
DirectorProvider.generate()
        v
validatePerformance()
        |
        +-- valid ----> generated Performance + advanced progress
        |
        +-- invalid --> bounded retry --> authored fallback
```

## Public API

```ts
import {
  performCurrentFrame,
  StaticDirectorProvider,
} from "@storyframe/ai-director";

const result = await performCurrentFrame({
  world,
  state,
  provider: new StaticDirectorProvider({
    narration: "The archive was locked overnight...",
    dialogue: [],
    completedBeatIds: [
      "investigate.exact.1",
      "investigate.establish.1",
    ],
    surfacedIntentIds: ["inspect_red_thread"],
    proposedSessionDetails: [],
    referencedCanonIds: ["archive_is_locked"],
  }),
  progress: previousDirectorProgress,
  maxAttempts: 2,
});
```

Render `result.performance` when present and store `result.progress` with the session. Use `result.status` to label the output as `generated`, `fallback`, or `unavailable` in Creator Studio. Keep `result.issues` in creator/debug telemetry; do not expose rejected secret IDs or privileged source data to players.

An optional `DirectorTelemetrySink` receives content-free attempt/result records: trace ID, session ID, state version, frame ID, attempt/status, rounded duration, and validation issue codes. It never receives narration, dialogue, proposed details, player words, model input, canon text, or raw provider errors. Sink failure is ignored so it cannot disable validation or authored fallback.

An optional `DirectorSemanticEvaluator` runs only after structural validation and receives the same model-safe projection, frame contract, and candidate performance. It can reject output that contradicts an `establish` meaning or implies a forbidden claim even when no prohibited phrase appears verbatim. Evaluator failure rejects generated prose and selects authored fallback; it never weakens the gate.

## Validation rules

A candidate is rejected when it:

- does not match the structured `Performance` shape;
- omits an `exact` line or fails to declare a required `exact`/`establish` beat complete;
- reports an unknown beat ID;
- includes a frame's prohibited claim verbatim;
- references hidden or unknown canon;
- surfaces an intent that is not currently legal;
- attributes dialogue to an unknown character.

Validation is deliberately downstream of the engine. Rejection cannot roll back or corrupt a committed turn because no mechanical state was delegated to the provider.

## Beat progress

Compiled IDs use `frame_id.authority.index`. `exact` and `establish` beats are required; `suggest` beats are optional. Accepted IDs accumulate in `DirectorProgress.completedBeatIds`. Session-scoped generated details accumulate by semantic ID in `acceptedSessionDetails`.

Progress is separate from `GameState` because it describes narrative performance, not simulation truth. Persistence should save the two records transactionally at the application layer while continuing to treat the engine snapshot/event log as the mechanical authority.

## Fallback behavior

After one to three bounded attempts, `performCurrentFrame` selects compiled `fallback` lines. Legacy frames without a performance contract may use `text`. Fallback marks the frame's required beats complete because it is an authored, pre-approved performance path. If neither fallback nor text exists, the result is `unavailable` and the UI should present a retryable operations error without changing the save.

## Provider integration boundary

A production model adapter implements only:

```ts
interface DirectorProvider {
  generate(request: DirectorRequest): Promise<unknown>;
}
```

The adapter may use OpenAI Responses API structured outputs, another provider, a deterministic fixture, or a cache. Keep provider SDKs and credentials in the host/server package—not in `engine-core`, `world-schema`, or the Storyframe compiler. Treat all provider output as `unknown` until `validatePerformance` succeeds.

The production-shaped Responses adapter now lives in `server/src/director.ts`; configuration, safe usage telemetry, and the paid live-eval workflow are documented in `docs/OPENAI_DIRECTOR_PROVIDER.md`.

Before public enablement, complete:

1. bind the implemented content-free trace and token telemetry to hosted latency/error/cost metrics;
2. evaluate the implemented provider-backed `DirectorSemanticEvaluator` for `establish` meaning and implied `never` claims;
3. entity and unsupported-mechanical-claim evaluation;
4. encrypted persistence for accepted session details;
5. representative secret-leak, repetition, pacing, and voice evals.

## Tester workflow

In Creator Studio or the admin playtest:

1. Open a frame and read its required meaning and protected claims.
2. Run the Director with the deterministic provider for contract testing.
3. Inspect status, attempts, completed beats, and validation issues.
4. Force provider failure and confirm the authored fallback still makes sense.
5. Confirm the engine state and event log are byte-for-byte unchanged by both success and failure.
6. Correct the authored contract or provider adapter; never rewrite the original playtest history.

Automated coverage lives in `tests/ai-director.test.mjs`.

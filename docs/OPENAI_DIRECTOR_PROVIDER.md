# OpenAI Director Provider

Status: implemented, disabled by default, live model evaluation requires an explicit paid-run acknowledgement  
Audience: server developers, story authors, QA, security reviewers, and deployment operators

## Outcome

`server/src/director.ts` contains Storyframe's production-shaped OpenAI Responses API adapters for performance generation and semantic evaluation. They use strict Structured Outputs, send only the model-safe projection and authored performance contract, and keep final acceptance inside the provider-neutral `@storyframe/ai-director` runtime. They cannot mutate game mechanics, reveal hidden canon, publish creator changes, or bypass authored fallback.

The server loads the adapter only when both of these are present:

```dotenv
OPENAI_API_KEY=<server-side project key>
STORYFRAME_DIRECTOR_ENABLED=true
```

Keeping `STORYFRAME_DIRECTOR_ENABLED` false leaves deterministic story play and authored fallback fully operational. The key may still be used independently by opt-in narration.

## Data flow

```text
WorldPack + authoritative GameState
        |
        +-- projectModelView (hidden data physically excluded)
        +-- current frame beats and forbidden claims
        +-- separate DirectorProgress
        v
OpenAiResponsesDirectorProvider
        |
        +-- POST /v1/responses
        +-- store: false
        +-- strict storyframe_performance JSON schema
        v
unknown candidate
        |
        +-- structural/canon/intent/speaker validation
        +-- optional semantic evaluator boundary
        v
accepted Performance OR authored fallback
```

After structural validation, `OpenAiResponsesDirectorSemanticEvaluator` makes a second bounded structured request. It reports establish-beat IDs whose meaning is missing and zero-based protected-claim indexes implied by the prose. Storyframe converts those identifiers into fixed, content-free issue messages; model-written explanations never enter telemetry or creator diagnostics.

The adapter intentionally excludes the frame's authored fallback from the model request. The fallback stays server-side and is selected by `performCurrentFrame` only after provider failure or rejection.

## Request contract

The Responses request contains:

- the configured model and explicit reasoning effort;
- a short outcome-first Director instruction;
- the current frame ID, title, required beats, and forbidden claims;
- `ModelView`, whose projection physically excludes unrevealed canon and artifacts;
- prior Director progress;
- a strict JSON Schema for narration, dialogue, completed beats, surfaced intents, proposed session details, and referenced canon IDs;
- `store: false` and a content-free Storyframe trace ID.

It does not contain:

- the API key in a payload or log;
- raw `GameState`;
- creator/debug projections;
- hidden canon or unrevealed artifact bodies;
- authored fallback prose;
- private admin drafts;
- prior chat history unrelated to the current frame.

Structured output is still treated as untrusted. A schema-valid candidate can be rejected by Storyframe for an unknown speaker, unavailable intent, missing exact line, hidden canon reference, or a protected claim.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `STORYFRAME_DIRECTOR_ENABLED` | `false` | Explicit paid-generation opt-in. |
| `STORYFRAME_DIRECTOR_MODEL` | `gpt-5.6-sol` | Provider model; override only with an evaluated role-appropriate model. |
| `STORYFRAME_DIRECTOR_REASONING_EFFORT` | `low` | `none`, `low`, `medium`, or `high`. |
| `STORYFRAME_DIRECTOR_TIMEOUT_MS` | `20000` | Bounded to 1–60 seconds. |
| `STORYFRAME_DIRECTOR_MAX_OUTPUT_TOKENS` | `1200` | Bounded to 256–4096 tokens. |
| `STORYFRAME_DIRECTOR_ENDPOINT` | OpenAI Responses endpoint | Test/private routing override; leave unset in ordinary production. |

The default model follows the current OpenAI flagship guidance, while the explicit low reasoning baseline limits latency and cost for a narrow structured prose task. Do not raise effort or change tiers globally without representative Storyframe evals.

## Usage telemetry

The provider records content-free usage events through `OpenAiDirectorUsageSink`. The server maps them into structured operational logs:

- trace ID;
- configured model;
- operation (`performance` or `semantic-evaluation`);
- completed/API error/invalid response/network error status;
- rounded duration;
- input, cached input, output, reasoning, and total token counts.

No prompts, story prose, session details, provider error bodies, credentials, or rejected candidate content enter these events. Pricing is deliberately not hardcoded because model prices change; the hosted telemetry pipeline should join token counts with a versioned pricing table and record estimated cost separately.

Telemetry failure never changes story behavior. Provider failure never disables authored fallback.

## Developer workflow

1. Copy the non-secret settings from `.env.example`.
2. Store `OPENAI_API_KEY` in `.env.local` for local work or the deployment secret manager in hosted environments.
3. Leave `STORYFRAME_DIRECTOR_ENABLED=false` while running deterministic tests.
4. Run the provider contract tests:

   ```bash
   npm run build
   node --test tests/openai-director-provider.test.mjs tests/ai-director.test.mjs
   ```

5. Inspect `/health`; `directorConfigured` is true only when the adapter is enabled and a key is available.

The tests use an injected fetch implementation. They do not call OpenAI or incur API usage. They verify strict-schema request construction, fallback privacy, structured parsing, bounded configuration, sanitized usage telemetry, refusals, and upstream failures.

## Tester workflow: paid live smoke eval

A live eval is never part of `npm test`. It requires two explicit switches:

```bash
STORYFRAME_DIRECTOR_ENABLED=true \
STORYFRAME_DIRECTOR_LIVE_EVAL=true \
npm run eval:director:live
```

The command performs one bounded Agency frame with one generation request and, after structural validation, one semantic-evaluation request. It prints only status, issue codes, counts, model, latency, and token usage. It does not print generated prose, prompt content, or the API key.

Expected success:

- `status` is `generated`;
- `attempts` is `1`;
- `issueCodes` is empty;
- at least one required beat is completed;
- token and latency fields are present.

Expected safe failure:

- status falls back when run through the full Director runtime;
- deterministic `GameState` is unchanged;
- no hidden canon appears in logs or console output;
- a sanitized provider status and token data, when available, are recorded.

## Evaluation matrix before production enablement

Run a versioned eval set across representative frames and record:

1. exact-line preservation;
2. establish-beat meaning;
3. forbidden and implied-forbidden claims;
4. hidden-canon and unrevealed-artifact leakage;
5. unknown entities and unsupported mechanical claims;
6. legal intent surfacing;
7. voice and pacing acceptance;
8. repetition across adjacent frames;
9. fallback quality under timeout, refusal, invalid JSON, and rate limit;
10. end-to-end latency, tokens, cache behavior, and estimated cost per accepted performance.

Compare the configured baseline with one cheaper/faster model tier and one lower reasoning effort. Accept a change only when the same contract and safety evals pass.

## Remaining production gate

The Responses generation/semantic adapters and content-free usage telemetry are implemented. Public enablement still requires:

- thresholded live evidence for the semantic evaluator plus entity and unsupported-mechanical-claim evals;
- encrypted persistence for accepted session details;
- a hosted telemetry sink, versioned price join, alert thresholds, and retention policy;
- representative live eval evidence approved by the product owner;
- deployed secret rotation and incident procedures.

Official references:

- [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [GPT-5.6 Sol prompting guidance](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6.md)

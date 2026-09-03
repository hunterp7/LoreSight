# Operational Observability and Release Diagnostics

Status: local structured logging and trace propagation implemented; hosted metrics/export pending  
Updated: August 3, 2026  
Audience: developers, deployment engineers, QA, security reviewers, and trusted support operators

## Purpose

Storyframe needs enough evidence to answer “where did this story go wrong?” without turning logs into a second copy of private story state. Runtime observability and narrative debugging are related but deliberately separate:

- HTTP logs answer whether a request arrived, was authorized, completed, and how long it took.
- deterministic events and `TurnTrace` explain which intent, condition, rule, random roll, and state operation changed the story.
- the storyline debugger audits replay, secrecy, dead ends, divergence, and source locations.
- Director performance records explain generated/fallback status, validation issues, attempts, latency, and usage without entering the mechanical event log.

The Director runtime also emits optional content-free attempt/result telemetry. Collector failure cannot block output validation or authored fallback.

Do not reconstruct mechanics from chat transcripts or infer player identity from request text.

## Request correlation

Every handled HTTP request receives an `x-request-id` response header. A caller-supplied ID is preserved only when it contains 8–80 ASCII letters, digits, underscores, or hyphens. Missing or unsafe values are replaced with a UUID.

OAuth authorization receives the same ID as `ActorContext.traceId`. Production database and Director adapters should carry that value into operator audit and performance records. A support operator can then correlate an HTTP failure with the exact deterministic session/event evidence without logging the request body.

## Structured event contract

`server/src/observability.ts` writes one JSON object per line. Current events are:

| Event | Level | Safe details |
|---|---|---|
| `service.ready` | info | port, whether OAuth is enabled |
| `http.request.complete` | info/warn/error | method, path without query, status, rounded duration |
| `oauth.authorization.denied` | warn | policy code and error class |
| `mcp.request.failed` | error | error class only |

Never add authorization headers, access tokens, API keys, request bodies, tool arguments, player words, story prose, world packages, audio data URLs, raw provider responses, or full error messages to these events. Add an explicit bounded field only when an operator has a concrete diagnostic use for it.

## Narrative incident workflow

1. Capture the `x-request-id`, world/version, opaque session ID in a secure channel, and last known good state version.
2. Find the request completion and any adjacent authorization/MCP failure event.
3. Load the owner-scoped session through privileged application services.
4. Replay the immutable event sequence and verify its latest snapshot.
5. Run the storyline audit and inspect its source-mapped finding.
6. If generation was involved, load the insert-once Director performance using session, state version, and contract hash.
7. Correct source in a new draft or simulate a retrospective branch; never rewrite the original event log or published release.

## Migration operation

Load `packages/persistence/migrations/*.sql` with `loadStoryframeMigrations` and pass the result to `runStoryframeMigrations` on one deployment job before serving traffic. The runner:

1. opens one transaction;
2. takes a transaction-scoped advisory lock;
3. creates `storyframe_schema_migrations` when absent;
4. validates every recorded SHA-256 checksum;
5. applies pending canonical files in lexical order;
6. records each checksum and timestamp;
7. commits the set or rolls the pending set back.

Never edit an applied migration. Add a new numbered file. A checksum mismatch is a deployment stop condition, not a warning to bypass.

## Hosted follow-up

The deployment owner must still choose and configure:

- a log/trace destination with retention and access controls;
- metrics for request latency/errors, OAuth denial rate, version conflicts, Director generated/fallback/unavailable rate, validation issue codes, token usage, and cost;
- alerts based on sustained rates rather than individual player choices;
- a multi-instance rate limiter and abuse policy;
- database backups, restore drills, retention, export, and deletion jobs;
- log redaction tests at the collector boundary.

Player-facing text, hidden canon, and access credentials must not become metric dimensions.

## Local abuse guard

The server applies an in-process fixed-window guard to the two cost/mutation-sensitive paths:

- 120 submitted story turns per authenticated subject per minute;
- 12 generated narrations per authenticated subject per minute;
- 12 local-preview narrations per remote address per minute.

Rejected local-preview requests return HTTP `429` with `Retry-After`; MCP tools return a bounded retry message and `retryAfterSeconds` metadata. This protects local/private-alpha use and catches accidental loops. It is not a production distributed limiter: each process owns separate counters and restarts clear them. Hosted deployment must replace or precede it with a shared identity-aware limiter at the gateway/application boundary.

## Verification

Automated checks cover safe request IDs, bounded JSON event shape, omission of sensitive field names, and error-class-only reporting. Before a hosted release, also:

1. send a request with and without a safe `x-request-id` and confirm the returned header;
2. trigger one invalid bearer token and one server error in a test environment;
3. confirm no token, tool argument, story line, query string, or audio payload appears in collected logs;
4. correlate one committed turn through HTTP ID, event trace, source map, and performance record;
5. confirm retention and access match the published privacy policy.

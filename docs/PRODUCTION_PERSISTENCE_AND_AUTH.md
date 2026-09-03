# Production Persistence and Authorization

Status: contracts, migration ledger/runner, and first migration implemented; provider and live database integration pending  
Updated: August 3, 2026  
Audience: backend developers, security reviewers, deployment engineers, QA, and trusted operators

## What this slice establishes

Storyframe now has explicit production boundaries for:

- owner-scoped sessions and deterministic event history;
- immutable, content-addressed published world releases;
- optimistic one-version turn commits;
- durable AI Director performance and usage records;
- append-only operator audit history;
- OAuth resource-server claim and scope enforcement;
- PostgreSQL row-level owner isolation as defense in depth.

These contracts do not silently replace the private-alpha JSON store. The local admin continues using `.storyframe-data/admin.json` until a configured Postgres driver and migration runner are connected. The package boundaries make that transition explicit and testable.

## Package map

### `@storyframe/persistence`

`packages/persistence/src/index.ts` defines `StorySessionRepository`, `WorldReleaseRepository`, `DirectorPerformanceRepository`, and `OperatorAuditRepository`.

`MemoryStoryframeRepository` is the deterministic contract fixture. It is suitable for tests and ephemeral local execution, not hosted durability.

`StoryDataLifecycleRepository` provides owner-scoped schema-versioned export and transactional deletion. Export contains the owner's sessions/events and Director performances but excludes shared world packages, creator drafts, credentials, and operator logs. Deletion removes performances, events, and sessions in dependency order while preserving shared immutable releases. Public endpoints remain gated on reauthentication, audit identity, asynchronous delivery, retention policy, and backup behavior; see `PRIVACY_AND_DATA_LIFECYCLE.md`.

`packages/persistence/src/postgres.ts` contains a driver-neutral `PostgresStoryframeRepository`. The host supplies a `SqlDatabase` implementation whose `transaction` method pins every callback to one database connection and commits or rolls back the callback atomically. This avoids coupling core packages to one Postgres driver or hosting vendor.

`packages/persistence/src/migrations.ts` provides the deployment migration runner. It takes a transaction-scoped Postgres advisory lock, creates the schema ledger if needed, verifies SHA-256 checksums for applied files, and executes pending migrations in lexical order inside one transaction. `migration-files.ts` loads only canonical `NNNN_lower_snake_case.sql` files. Applied migration files are immutable; change the schema with a new numbered file.

### `@storyframe/application`

`StoryApplicationService` is the ownership and transaction boundary between MCP/HTTP handlers and the engine. It:

1. derives `ownerId` from authenticated `ActorContext.subjectId`;
2. checks scopes before repository access;
3. loads the immutable world release pinned to the save;
4. verifies stored state against deterministic event replay;
5. asks `engine-core` to resolve a legal command;
6. commits one event using the expected state version;
7. returns only a player-safe projection.

Tool input must never contain a trusted owner ID. A caller may submit an opaque session ID, but the repository lookup always pairs it with the authenticated subject.

### `@storyframe/auth`

`OAuthResourceAuthorizer` consumes a cryptographically verified access-token claim set and enforces exact issuer, expected resource/audience, expiry, not-before time, non-empty subject, and required Storyframe scopes. `server/src/oauth.ts` binds that contract to JOSE remote-JWKS signature verification.

The `AccessTokenVerifier` interface deliberately separates signature/JWKS verification from Storyframe policy. Production must bind it to the chosen established identity provider or its supported verification library. The interface contract requires signature verification before claims are returned.

## Postgres data model

The first migration is `packages/persistence/migrations/0001_storyframe_production.sql`.

| Table | Authority | Mutation policy |
|---|---|---|
| `storyframe_world_releases` | compiled world JSON plus SHA-256 digest | insert once; trigger rejects update/delete |
| `storyframe_sessions` | owner, pinned release, initial and latest state | optimistic update by owner and version |
| `storyframe_events` | ordered deterministic events | append only; unique version, event ID, and mutation ID |
| `storyframe_director_performances` | validated/fallback prose and usage metadata | insert once by performance cache key |
| `storyframe_operator_audit` | privileged action evidence | append only |

The migration enables row-level security on player sessions, events, and Director performances. A transaction sets the local `storyframe.subject_id` setting before owner data is selected or changed. Application checks remain mandatory; RLS is defense in depth, not the only authorization layer.

## Turn commit transaction

```text
verify bearer token
  -> derive ActorContext
  -> load owner-scoped session + pinned release
  -> replay event history and compare latest state
  -> resolve deterministic turn
  -> UPDATE session WHERE owner_id AND expected state_version
  -> INSERT exactly one event with unique mutation_id
  -> commit transaction
  -> project player-safe view
```

If the update matches no row, the service returns either `not-found` or `conflict`. The host should not reveal whether a session belongs to another user. On conflict it reloads the current safe view and asks the client to retry from the newer version.

## OAuth deployment contract

Storyframe follows the current MCP OAuth 2.1 resource-server flow documented by OpenAI:

1. Serve `/.well-known/oauth-protected-resource` from the canonical HTTPS MCP origin.
2. Point `authorization_servers` at an established identity provider.
3. Configure the provider to publish OAuth or OIDC discovery metadata, authorization-code flow, and PKCE `S256`.
4. Preserve the `resource` parameter and issue access tokens whose audience is the canonical Storyframe MCP resource.
5. Verify signature, issuer, audience/resource, expiry, not-before, and scopes on every request.
6. Attach the resolved subject and scopes to request context; never accept identity from tool arguments.
7. Return a `401` challenge or MCP `_meta["mcp/www_authenticate"]` challenge when authorization is missing, invalid, or insufficient.
8. Declare each tool's `securitySchemes` so the client requests the narrowest accurate scopes.

Reference: [OpenAI plugin authentication](https://developers.openai.com/plugins/build/auth).

| Scope | Allows |
|---|---|
| `story:sessions:read` | resume and inspect the caller's player-safe saves |
| `story:sessions:write` | start a save and submit legal intents |
| `story:worlds:read` | inspect private creator drafts/releases |
| `story:worlds:write` | create and validate private drafts |
| `story:worlds:publish` | publish a separately approved immutable release |

Do not grant creator or publishing scopes to normal players. Publishing remains a separate high-trust action and should require MFA and explicit approval policy at the identity provider.

### Server configuration

Set all three variables together on the hosted MCP server:

```text
STORYFRAME_OAUTH_ISSUER=https://identity.example.com
STORYFRAME_OAUTH_RESOURCE=https://storyframe.example.com
STORYFRAME_OAUTH_JWKS_URI=https://identity.example.com/.well-known/jwks.json
```

When configured, the server:

- publishes `/.well-known/oauth-protected-resource`;
- verifies bearer signatures through the remote JWKS;
- validates issuer, audience, lifetime, subject, and Storyframe scopes;
- rejects unauthenticated MCP traffic with `401` and `WWW-Authenticate`;
- returns tool-level reauthorization metadata when a valid user lacks a required scope.

All three values must use HTTPS. Partial configuration fails startup. With no OAuth variables, the current server remains in explicit local-development identity mode for the existing localhost workflow.

The installed production-supported MCP TypeScript SDK v1 does not yet expose the current normative top-level `securitySchemes` field through `McpServer.registerTool`; Storyframe mirrors the schemes in compatibility `_meta.securitySchemes` for now. Public submission remains gated on upgrading to a stable SDK release that emits the normative field, or an upstream v1 fix. Do not move to a pre-release v2 SDK solely to bypass this gate.

## Driver integration

A concrete Postgres host adapter must implement:

```ts
interface SqlDatabase {
  transaction<T>(work: (connection: SqlConnection) => Promise<T>): Promise<T>;
}
```

The implementation must obtain one pooled connection, issue `BEGIN`, run the callback on that connection, commit on success, roll back on failure, and always release the connection. Never retry an ambiguous transaction without the same mutation ID. Use parameterized queries only; do not interpolate identities, scopes, JSON, or timestamps.

## Migration and recovery procedure

Before a private hosted alpha:

1. Back up the target database.
2. Apply migrations to a production-like staging database with permission to create tables, functions, triggers, policies, and indexes.
3. Record the migration filename and checksum in the deployment log.
4. Publish a conformance release before creating sessions because sessions reference immutable releases.
5. Run cross-owner, stale-version, duplicate-mutation, replay, and restart tests.
6. Restore the backup into a separate database and replay representative sessions.
7. Promote only after restored evidence matches the source database.

Migration `0001` is transactional. Its rollback during pre-production testing may drop the new objects only when no production data exists. Once real saves exist, use a forward recovery migration; never delete or rewrite event history to force a rollback.

## Developer verification

```bash
npm run build:packages
node --test tests/persistence.test.mjs tests/application-service.test.mjs tests/auth.test.mjs
```

The tests prove cross-owner isolation, stale-write rejection, one-version commits, deterministic tamper detection, immutable release hashes, and fail-closed token policy for missing, malformed, unverifiable, expired, premature, wrong-issuer, wrong-audience, and under-scoped tokens.

They do not prove live provider discovery, JWKS rotation, real Postgres behavior, backup restore, or ChatGPT OAuth linking. Those require hosted integration evidence.

## Tester workflow

For the hosted-alpha authorization gate, QA should use two test identities:

1. User A starts a story, commits two intents, signs out, and resumes after a server restart.
2. User B attempts to load User A's opaque session ID and receives the same response as an unknown session.
3. User A retries an already committed mutation ID and observes no second event.
4. Two clients submit from the same state version; one commits and the other receives a safe refresh conflict.
5. Revoke User A's token and confirm the next request returns an authentication challenge.
6. Remove write scope and confirm reads continue while mutation tools request reauthorization.
7. Rotate provider signing keys and confirm unverifiable tokens fail closed.
8. Restart all app instances and confirm the same event-derived state and accepted Director performance return.

Capture trace IDs and sanitized response codes. Never place access tokens, raw debug state, private drafts, or hidden canon in screenshots or test reports.

## Remaining production work

- choose and configure an established identity provider with CIMD or DCR support;
- configure and live-test the implemented JOSE/JWKS verifier against the chosen provider;
- bind a pooled Postgres driver to `SqlDatabase`;
- bind the migration runner to the chosen pooled Postgres driver and production secret manager;
- migrate per-tool compatibility auth metadata to normative top-level `securitySchemes` when the supported SDK exposes it;
- bind the migrated compiled-world player and remaining private admin store to Postgres at deployment;
- replace the implemented in-process turn/narration guard with a distributed subject-aware limiter and add revocation behavior, hosted trace export, backups, restore drills, export, and deletion;
- run MCP Inspector and ChatGPT Developer Mode OAuth tests over the final HTTPS origin.

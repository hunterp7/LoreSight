# Privacy and Data Lifecycle Implementation Specification

Status: repository export/deletion contracts implemented; public policy, authenticated endpoints, retention jobs, and legal review pending  
Updated: August 3, 2026  
Audience: product owner, developers, privacy/security reviewers, support, QA, and deployment operators

This is an engineering specification, not a published privacy policy or legal advice. Final public language, retention periods, regional requirements, and processor disclosures require owner approval and qualified review before launch.

## Data inventory

| Data class | Why Storyframe needs it | Production authority | Player visibility |
|---|---|---|---|
| account subject and scopes | ownership and authorization | identity provider + request context | never returned as story content |
| session snapshot and ordered events | save/resume, deterministic replay, corrections | owner-scoped repository | safe projection only |
| published world release | execute a pinned story version | immutable release repository | released projection only |
| Director performance | reuse validated narration and measure fallback/cost | insert-once performance repository | visible performance only |
| generated narration input | create opt-in speech from visible screen text | transient OpenAI request | text is already visible to player |
| generated MP3 | immediate widget playback | currently transient data URL/cache | requesting player only |
| operator audit | security and privileged-change evidence | append-only audit repository | privileged operators only |
| operational logs | availability, authorization, latency, correlation | protected log collector | never exposed in widget |
| private drafts/source maps | authoring and debugging | creator-scoped repository | never exposed to normal players/model |

Do not persist raw chat history as the canonical story. Character/world recaps must come from structured ledgers and audience-safe projections.

## Export contract

`StoryDataLifecycleRepository.exportOwnerStoryData(ownerId, exportedAt)` returns schema version 1 with:

- only sessions owned by the authenticated subject;
- initial/latest deterministic state and ordered events;
- that owner's stored Director performances;
- no access tokens, API keys, operator logs, other users, private creator drafts, or full world packages.

The application endpoint is intentionally not exposed yet. Production must derive `ownerId` from a recent authenticated session, apply reauthentication/rate limits, record a privileged audit event, generate the export asynchronously when needed, encrypt it at rest, return a short-lived download, and delete the export artifact after the declared window.

## Deletion contract

`StoryDataLifecycleRepository.deleteOwnerStoryData(ownerId)` transactionally deletes, in dependency order:

1. the owner's Director performance records;
2. events belonging to the owner's sessions;
3. the owner's sessions.

It returns deletion counts for audit evidence. It does not delete shared immutable world releases or automatically erase security audit records. The final policy must define whether retained audit evidence is anonymized, legally required, or deleted after a separate retention period.

Production deletion must:

1. derive the subject from OAuth, require recent reauthentication, and prevent cross-owner IDs in input;
2. create an audit request record before destructive work without copying story content;
3. run the repository deletion once inside one transaction;
4. invalidate active sessions/tokens through the identity provider;
5. purge cached exports, generated media, object-store assets owned by the user, and search/analytics derivatives;
6. account for backups through the documented expiry/restore procedure;
7. report completion or a bounded failure without leaking whether another subject exists.

## Narration disclosure

Audio is off by default. Enabling audio begins one locally bundled background track at 50% volume and may request an AI-generated reading of the text already visible on the current screen. The UI labels this feature “AI-generated voice.”

The production privacy notice must name the narration processor, categories of text sent, purpose, retention/training controls selected in the provider account, user controls, and a support route. Storyframe must not send hidden canon, raw chat history, credentials, unrelated profile data, or unreviewed private drafts for narration.

## Retention decisions required before launch

The product owner must approve explicit periods for:

- active and abandoned story sessions;
- Director performances and token/cost metadata;
- private drafts and rejected correction proposals;
- export archives and deletion-job evidence;
- operational logs and security audits;
- database backups and restored copies;
- support tickets and reviewer credentials.

Use configuration and scheduled jobs, not undocumented manual cleanup. A restore drill must prove that an already-completed deletion is not silently made active again; post-backup deletions need a replayable tombstone or equivalent recovery procedure.

## QA scenarios

1. User A's export contains only User A sessions and performances.
2. User B cannot discover whether User A's opaque session exists.
3. Deleting User A removes their sessions/events/performances while User B and shared releases remain.
4. A repeated deletion is safe and reports zero additional rows.
5. A failed transaction leaves the entire owner dataset intact.
6. Export/deletion audit details contain identifiers/counts, never story prose or secrets.
7. Narration logs contain status/latency only, not input text or MP3 data.
8. Restoring a backup replays deletion tombstones before serving user traffic.

## Launch gate

Do not expose export or deletion publicly until managed Postgres, OAuth reauthentication, audit identity, rate limiting, asynchronous job storage, backup behavior, support ownership, final policy URLs, and legal/privacy review are all configured and tested.

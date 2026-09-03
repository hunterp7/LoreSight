# SDD ledger — plan: docs/superpowers/plans/2026-09-01-loresight-chatgpt-app.md

## Pre-flight scan

| Item | Finding | Ruling |
|---|---|---|
| Repository isolation | Checkout has no Git metadata, so the prescribed worktree/BASE workflow cannot run. | Proceed in the shared checkout with no commits or destructive operations; use the ledger and targeted diffs as the review boundary. |
| Task 1 ↔ Task 2 | Both touch `server/src/index.ts` and descriptor/resource metadata. | Execute sequentially; Task 2 consumes Task 1's frozen contract. |
| Task 1 ↔ Task 6/8 | Submission validators and release evidence depend on the frozen tool list. | Freeze and validate before hosted evidence work. |
| Task 2 ↔ Task 5 | Resource metadata and widget host behavior share the built resource contract. | Complete resource conformance before widget hardening. |
| Task 3 ↔ Task 7 | Persistence and operational recovery share migrations/backups. | Persistence first, then ops/restore validation. |
| Task 4 ↔ Task 6 | OAuth configuration is required for hosted Developer Mode checks. | Auth deployment precedes hosted E2E. |
| Task 5 ↔ Task 6 | Widget behavior is exercised by hosted interaction matrix. | Widget tests precede hosted evidence. |
| Task 7 ↔ Task 8 | Release approval consumes operational/privacy evidence. | Run ops gates before submission approval. |

Ruling: The plan is executable, but full hosted deployment and OAuth require external credentials and owner-controlled services; those gates will be implemented/documented locally and reported as blocked if credentials are unavailable.

Task 1: complete after fix round 1. Public creator proposal is gated by `STORYFRAME_CREATOR_TOOLS_ENABLED`; submission validates the 12 player tools. Checks pass.
Task 2: complete by audit. Resource URI is versioned, CSP is restrictive, and OAuth metadata is conditional; `npm run check` passes. No code changes needed.
Task 3: in progress.
Task 4: in progress.
Task 3: complete by audit. Existing Postgres/application persistence is valid for compiled Storyframe sessions but cannot safely replace classic terminal in-memory sessions without a new contract; recommendation recorded in task3-report.md.
Task 4: complete after safe OAuth config hardening. Auth/OAuth tests pass; hosted issuer credentials remain external.
Task 5: audited existing widget bridge/state/accessibility coverage; no safe code change completed in this pass. Existing player tests pass; hosted ChatGPT interaction matrix remains open.
Task 6: local smoke hardened to tolerate explicitly enabled creator-only tools while asserting all 12 public tools; `npm run smoke` passes. Hosted Developer Mode evidence remains open.
Task 7: existing readiness/observability/persistence/privacy tests pass; production secrets, backups, restore drill, and hosted deployment remain external gates.
Task 8: not submitted. Owner approval, hosted screenshots, domain/org verification, and final hosted checks remain required.

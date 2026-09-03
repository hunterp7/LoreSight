# Admin UI and Visual Artifact Status

Status: private-alpha vertical slice complete  
Updated: August 2, 2026

The console now defaults to author/tester language, keeps engine data behind **Technical details**, and uses a centralized semantic Pixelarticons map. See `ADMIN_UI_AND_GRAPHICS.md` for the interface language, graphic-display rules, and tester workflow.

## Implemented

- React remote operations console built with Storyframe wrappers over Retro React 1.6.
- Responsive overview, sessions, Creator Studio, artifact, and runbook surfaces.
- Bearer-token login using tab-scoped session storage and same-origin requests.
- Admin API disabled without configuration; constant-time token check; production HTTPS enforcement.
- Compiled-world health and conformance playtest creation.
- Authored-test pass/fail health and bounded frame/intent/rule coverage on the overview.
- Full authored-test and branch-coverage reports for remotely compiled in-memory drafts.
- Legal intent submission with expected version and mutation ID.
- Audit findings, source targeting, event timeline, privileged state inspection.
- Guided Studio with a Story tab for the scene editor, an Enhancements tab for the retro presentation layer, player preview, semantic performance fields, advanced-source disclosure, compilation, and private draft saving.
- Restart-safe atomic JSON persistence for deterministic playtests, correction proposals, and drafts.
- Immutable correction simulation and proposal recording.
- Text-first visual artifact schema, compiler declaration, reveal effect/operation, state, projections, source maps, and debugger leak audit.
- Player evidence-card SVG example with accessible description, caption, and adjacent clue text.
- Authenticated HTTP smoke covering remote access, authored-test/coverage health, clue reveal, correction, and compilation.

## Deliberately deferred

- multi-instance database repositories, migrations, retention, backup/recovery, and operator audit identity;
- OAuth/OIDC, MFA, RBAC, operator identity, and revocation;
- branch promotion or live-player save correction;
- draft approval, immutable version publishing, and save migration;
- asset manifest/CDN resolution, uploads, provenance database, and optimization;
- analytics, collaboration, and marketplace administration;
- migrated generic Agency sessions with deterministic event history.

These are required before the console becomes a production multi-user administration system.

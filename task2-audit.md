# Task 2 audit

Date: 2026-09-01

Quick review of the requested surfaces:

- Resource registration: the MCP widget resource is registered in `server/src/index.ts` with a versioned URI (`ui://widget/storyframe-player-v${WIDGET_VERSION}.html`) and a locked-down widget CSP (`connectDomains: []`, `resourceDomains: []`).
- CSP: no obvious regression found in the widget resource metadata. The launch/server surface check still expects the widget to remain versioned and the service routes to stay stable.
- Versioning: the repo and server are both pinned to `0.1.0`, and the widget URI version is controlled by `LORESIGHT_WIDGET_VERSION` with a default of `5`.
- OAuth metadata: OAuth is only advertised when deployment config is present. Local/dev installs stay unauthenticated, which avoids mixed-auth connector metadata.
- Submission metadata: `chatgpt-app-submission.json` still has `schema_version: 1` and matching tool justifications/test cases.

Verification:

- `npm run check` ✅ passed

Conclusion:

No code changes were needed for Task 2. I did not edit the repository because the current resource registration, CSP, versioning, and OAuth metadata are consistent and the repo check passed cleanly.

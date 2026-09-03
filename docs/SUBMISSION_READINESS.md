# ChatGPT Plugin Submission Readiness

Status: import artifact generated and locally validated; hosted review gates remain  
Updated: August 3, 2026  
Audience: product owner, submission operator, developer, QA, privacy reviewer, and support lead

## App classification

Storyframe's current primary archetype is **interactive-decoupled**: data and mutation tools return reusable snapshots, one render tool mounts the React interface, and the mounted widget sends retry-safe actions through the MCP Apps bridge.

The public launch target is **submission-ready**, but that classification is a gate, not a claim about the current localhost build.

## Generated import artifact

`chatgpt-app-submission.json` contains:

- app name, subtitle, description, and Entertainment category;
- annotation justifications for all seven exposed tools;
- exactly five positive reviewer test cases;
- exactly three negative/out-of-scope test cases.

Run the static import/catalog validator at any time:

```bash
npm run check:submission
```

It compares the import file with the server's typed tool catalog, checks all three required hint values for every tool, checks the subtitle length, and enforces the required positive/negative test counts without requiring a running server.

While the MCP server is running, add the live descriptor gate:

```bash
npm run check:submission:live
```

The live gate additionally compares the import file with `tools/list` and verifies that every emitted tool descriptor includes an `outputSchema`.

## Source review result

| Check | Current result |
|---|---|
| Tool names | Clear, action-oriented, and aligned with implementation |
| Tool descriptions | Start with use conditions and distinguish reads, writes, rendering, and narration |
| Required hints | Explicit for all seven tools and consistent with behavior |
| Output schemas | Present for all seven tools |
| Sensitive inputs | No credentials, payment data, government IDs, health data, MFA codes, or biometrics requested |
| Widget CSP | Empty connect/resource allowlists match bridge-only and locally bundled assets |
| Hidden data | Player/tool/widget projections omit unreleased facts and artifacts |

Generated narration sends the already visible text to the configured server-side OpenAI audio endpoint. The submission privacy copy must disclose that processing and explain retention. The API key is server-only and never enters tool results or the widget.

## Positive review paths

The submission tests cover:

1. starting Applicant Intake;
2. opening the persistent interface;
3. committing a legal story intent;
4. resuming and reading current visible state;
5. generating opt-in narration for visible scene text.

Review should additionally exercise duplicate mutation IDs, stale state versions, hidden clue omission, authored narration fallback, keyboard play, reduced motion, and narrow layout even though the import format requests only five positive test cases.

## Negative review paths

The import verifies that Storyframe does not trigger for:

- unrelated factual requests such as weather;
- general-purpose audiobook generation;
- creator publishing requests that the player MCP surface cannot perform.

Unsupported creator or admin actions must be explained plainly instead of approximated through player tools.

## Remaining blockers before upload

1. Deploy a stable public HTTPS `/mcp` origin and set `_meta.ui.domain` to its dedicated widget origin.
2. Configure an established OAuth/OIDC provider, protected-resource metadata, redirect URI, resource audience, scopes, and live JWKS verification.
3. Move the production MCP server to a stable SDK version that emits normative top-level tool `securitySchemes`; the current supported v1 SDK only permits Storyframe's compatibility metadata path.
4. Bind the implemented Postgres repository to a managed database, run migrations, and prove backup restore plus multi-instance optimistic concurrency.
5. Bind the compiled `StoryApplicationService` player path to the managed Postgres adapter and prove multi-instance ownership/concurrency.
6. Run and approve the implemented OpenAI Director generation/semantic adapters against fallback, cost, latency, hidden-canon, entity, mechanics, repetition, pacing, and voice evals; bind content-free telemetry to the hosted collector.
7. Review `PRIVACY_AND_DATA_LIFECYCLE.md`, bind the implemented owner export/deletion repository contracts to authenticated workflows, then publish approved privacy policy, terms, support contact, data instructions, and narration disclosure at stable public URLs.
8. Complete organization/developer verification and confirm the submitter has Apps Management write permission.
9. Capture final accurate UI screenshots from the hosted build, not localhost-only mock states.
10. Run MCP Inspector and a complete ChatGPT Developer Mode playthrough through OAuth on the final origin.
11. Re-run current plugin guidelines and submission checks immediately before upload.
12. Obtain explicit product-owner approval for the final listing, policies, reviewer credentials, and submission action.

Public submission is intentionally not automatic. External hosting, identity-provider changes, publishing, and portal submission require deployment ownership and explicit authority.

## Official references checked

- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [Add UI to an MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Define tools](https://developers.openai.com/plugins/plan/tools)
- [Authentication](https://developers.openai.com/plugins/build/auth)
- [Submit plugins](https://developers.openai.com/plugins/deploy/submission)
- [Plugin guidelines](https://developers.openai.com/plugins/app-guidelines)

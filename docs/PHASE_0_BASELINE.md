# Phase 0 Prototype Baseline

Captured: August 1, 2026

## Environment

- Node.js 24.14.0 from the bundled Codex workspace runtime
- Dependencies resolved from the supplied `package.json` and `package-lock.json`
- Prototype dependency versions installed: MCP Apps 1.7.5, MCP SDK 1.30.0, React 19.2.8, React DOM 19.2.8, Zod 4.4.3, TypeScript 7.0.2

The local Codex runtime did not expose an `npm` binary, so baseline commands were executed through the equivalent underlying Node, TypeScript, build, and test entry points. The repository continues to preserve the required `npm run check`, `npm run build`, `npm test`, and `npm run smoke` scripts.

## Results before Phase 1 extraction

| Check | Result |
|---|---|
| Server TypeScript no-emit check | Pass |
| Widget TypeScript no-emit check | Pass |
| Widget esbuild bundle | Pass |
| Server TypeScript build | Pass |
| Existing Agency tests | 2 passed, 0 failed |
| Live MCP smoke | Pass; six expected tools and orientation state returned |

Expected MCP tools at baseline:

1. `start_applicant_intake`
2. `record_intake_response`
3. `get_applicant_record`
4. `open_agency_terminal`
5. `examine_agency_artifact`
6. `choose_case_disposition`

## Known baseline limitations

- State is process-local and in memory.
- Caller-supplied `playerId` is the only session boundary.
- No mutation ID or expected state version is accepted by tools.
- No event log or replay contract exists.
- Tool output contains Agency-specific state and broad `unknown` fields.
- The unrevealed original-assignee artifact is present in serialized public state with `visible: false`; it is not physically omitted.
- Some write tools claim idempotency without a stored mutation receipt.

These limitations are migration inputs, not accepted platform behavior.

## UI library decision

The future React MCP Apps widget will use [Retro React](https://github.com/retro-react/retro-react), wrapped behind Storyframe-owned UI primitives. The library supports React 19 and provides typed, tree-shakable components including Terminal, Tabs, ProgressBar, Marquee, CRT, and accessible form/navigation primitives. It is intentionally not installed during the engine-only Phase 1 increment.

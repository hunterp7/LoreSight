# Story generation production contract

New and Remix generation is a server-side, creator-review workflow. It is not a client-side prompt shortcut and it never publishes a world automatically.

## Data flow

When `STORYFRAME_GENERATION_ENABLED=true`, the authenticated `generate_story_proposal` operation sends the following to the configured OpenAI Responses endpoint:

- the creator's generation prompt;
- the selected mode (`new` or `remix`);
- the rights classification;
- for Remix, a bounded source inspection dossier containing format, byte length, SHA-256 fingerprint, and Z-machine header metadata;
- StoryFrame source text only when the creator explicitly supplies a StoryFrame source for inspection.

The request uses `store: false`. API credentials remain server-side. Secrets, hidden canon, internal prompts, and player session state are not sent to the provider.

## Safety boundary

Every provider response must be strict JSON matching the StoryFrame proposal schema. The returned source is compiled before it becomes a draft. Compiler errors, provider refusals, timeouts, malformed JSON, and unsupported mechanics fail closed. A valid result is still marked `draft`; it is not a published release.

Remix requires a rights classification and source dossier. The generator is instructed to preserve source identity, separate `KEEP CLOSE`, `ELASTIC`, and `WILD DELTA` decisions, and avoid imitating named commercial games or protected characters/dialogue.

## Deployment checklist

1. Publish the privacy notice describing prompt/source processing and the provider.
2. Configure OAuth with `story:worlds:write` for creator accounts.
3. Configure `OPENAI_API_KEY` and `STORYFRAME_GENERATION_ENABLED=true` only in the server secret manager.
4. Replace the in-memory rate-limit store with the deployment's shared store before multi-instance hosting.
5. Connect the proposal response to the durable Creator Studio draft/review store.
6. Keep publishing behind the existing immutable release workflow and `story:worlds:publish` authorization.
7. Run the full submission and production smoke checks before enabling the feature for users.

The repository intentionally defaults generation to disabled. A deployment that has not completed this checklist can still ship the player and testing tools without exposing generation.

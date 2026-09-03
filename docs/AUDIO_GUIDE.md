# Storyframe Audio Guide

Status: implemented prototype  
Updated: August 2, 2026  
Audience: developers, designers, administrators, and playtesters

## Experience rules

Audio is optional and off by default. Storyframe never autoplays before a user gesture.

When the player selects `Audio`:

1. master volume is set to 50%;
2. the selected locally bundled binaural track begins looping;
3. narration for the visible story moment is generated and played;
4. background audio is temporarily reduced while narration speaks;
5. the player may select another track, adjust volume, replay narration, or turn audio off.

The control includes an explicit `AI-generated voice` disclosure. Headphones are recommended because the bundled tracks place different frequencies in the left and right channels. Do not describe binaural playback as treatment, therapy, or a source of medical benefit.

No story fact, warning, clue, or required action may exist only in audio. The textual interface remains complete when muted, playback is blocked, or narration generation fails.

## Bundled tracks

Five short MP3 tracks live in `web/src/assets/audio` and are embedded into the self-contained widget build as data URLs. This avoids runtime requests to third-party media hosts and keeps playback available when external resource domains are blocked.

Source, creator, frequency, and license details are maintained in [`web/src/assets/audio/ATTRIBUTION.md`](../web/src/assets/audio/ATTRIBUTION.md). Do not replace a track without adding equivalent provenance and redistribution terms.

## Narration architecture

Narration uses OpenAI's `gpt-4o-mini-tts` model with the `cedar` voice and MP3 output.

```text
React audio control
  -> app-only generate_story_narration MCP tool
  -> server-side OpenAI Speech API request
  -> MP3 returned as widget-only _meta data URL
  -> HTMLAudioElement playback
```

The server:

- reads `OPENAI_API_KEY` from the deployment environment or local `.env.local`;
- limits narration input to 800 characters;
- sends only visible text supplied by the widget;
- caches successful narration by a SHA-256 hash of normalized text;
- bounds the in-memory cache to 48 entries;
- never sends the API credential to React, MCP `structuredContent`, or the model transcript;
- returns generated audio in tool-result `_meta`, which is available to the widget but hidden from the model.

The direct `POST /narration` route supports the standalone feedback page only when it is addressed through `localhost`, `127.0.0.1`, or `::1`. A connected ChatGPT widget uses the MCP tool instead, so the preview endpoint is not exposed as the production integration surface.

## Local setup

Store a development credential in an ignored `.env.local` file:

```text
OPENAI_API_KEY=<managed outside source control>
```

The server loads this file only when `OPENAI_API_KEY` is not already present. Production deployments should inject the secret through their platform's environment-variable or secret-management system.

Start the server and open `http://127.0.0.1:8787/widget`. Select `Audio`; confirm that volume initializes to 50%, a track begins, and generated narration plays. Change tracks and volume, replay narration, then turn audio off.

## Failure behavior

- If background playback is blocked, the player can use `Read this screen` to retry from a user gesture.
- If the API key is absent, the UI reports that narration is unavailable without affecting the story.
- If the API project has no billing balance or has reached its spend limit, the UI identifies the billing requirement while leaving local background audio available.
- API billing is separate from a ChatGPT subscription. Developers can inspect [organization billing](https://platform.openai.com/settings/organization/billing) and [organization limits](https://platform.openai.com/settings/organization/limits).
- Failed OpenAI requests are not cached.
- Turning audio off pauses both background and narration immediately.
- The UI remains fully usable with reduced motion, muted system audio, or no headphones.

## Production follow-ups

Before public deployment:

1. Add authenticated per-player rate limiting to narration generation.
2. Persist generated narration in object storage with bounded retention instead of process memory.
3. Add request cost, latency, cache-hit, and playback-failure telemetry.
4. Validate playback and browser autoplay behavior in ChatGPT web, desktop, iOS, and Android.
5. Include the bundled-track attribution in public legal/credits material.

# Text-First Visual Artifacts

Status: runtime, compiler, projection, admin inspection, and player example implemented  
Audience: world authors, narrative designers, asset artists, frontend developers, QA, accessibility reviewers

## Design promise

Storyframe stories are primarily read, heard, and chosen. A visual appears when it can behave like evidence: a record, diagram, map, photograph, annotated object, symbol, or spatial clue that rewards inspection.

Visuals should feel consequential because they are uncommon. They do not decorate every turn, replace prose, or become mandatory eyesight tests.

Player-facing artifact and item imagery uses the semantic Pixelarticons mapping documented in `PLAYER_SHELLS_AND_THEMING.md`. Icons are decorative beside visible labels and do not satisfy the required textual fallback, alt-text, caption, or provenance fields by themselves.

## Recommended frequency

Use judgment, but a useful baseline for a 20–30 minute case is:

- zero to three major visual artifacts;
- reveal after a meaningful action or threshold;
- one focused artifact at a time on narrow ChatGPT surfaces;
- no persistent gallery competing with the main narrative;
- repeated review through an evidence drawer or recap.

An artifact may be `inline` only when its arrival is itself a keyframe. Most should use `inspect`, allowing the player to choose when to open it.

## Contract

```ts
interface ArtifactDefinition {
  id: string;
  kind: "document" | "image" | "diagram" | "map";
  title: string;
  summary: string;
  caption?: string;
  altText: string;
  textFallback: string[];
  presentation: "inline" | "inspect";
  audiences: Audience[];
  clueId?: string;
  asset?: {
    key: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
    width?: number;
    height?: number;
  };
}
```

`altText` describes what the visual communicates at a glance. `textFallback` contains the complete evidence needed to play. They are not duplicates: alt text makes the image perceivable; fallback text makes the clue mechanically and narratively usable.

## Reveal lifecycle

```text
authored ARTIFACT
      |
      | compiled + validated, still hidden
      v
WorldPack artifact registry
      |
      | reveal-artifact effect commits
      v
GameState.revealedArtifactIds
      |
      +-- player projection: text + approved asset metadata
      +-- model projection: text only, no asset reference
      +-- creator/debug: full definition and source map
```

Before reveal, the artifact is absent—not present with `visible: false`. The storyline debugger checks unrevealed artifact IDs, titles, summaries, alt text, and fallback lines against serialized player/model views.

## Player presentation

The React player widget uses DOM for narrative and evidence text. A visual opens inside its examined evidence card with:

- semantic `<figure>` and `<figcaption>`;
- meaningful image/SVG accessible name and description;
- complete clue text immediately adjacent;
- responsive width and no fixed viewport assumption;
- keyboard-accessible open/review action;
- no essential motion;
- text-only play remaining possible if the visual fails.

The implemented Agency example is an elevator chronology diagram. Its path reinforces a contradiction already expressed in the evidence text; it does not introduce a sight-only answer.

Retro React is wrapped by Storyframe UI components for buttons and other chrome. Artifact visuals remain world-themed content and do not inherit library styling as game logic.

## Model behavior

The model receives the artifact’s approved textual evidence after reveal. It does not need an image URL or raw binary to narrate the result. If future multimodal performance is enabled, it must be a separate explicit capability with the same audience and secret boundaries; the baseline remains text-only.

## Asset pipeline requirements

Every production asset needs:

- stable semantic asset key;
- MIME type and dimensions;
- rights owner, provenance, and license/source record;
- canon review;
- accessibility review;
- responsive variants where necessary;
- size budget and optimization;
- deterministic text applied in HTML/SVG or verified artwork;
- CSP/resource-domain registration for its deployment origin;
- fallback behavior for network or decode failure.

Do not embed remote third-party URLs directly in authored worlds. Resolve semantic keys through an approved asset manifest/CDN layer.

## Author review questions

1. What new observation does the visual reward?
2. Is that observation already available in complete text?
3. Why does it arrive at this exact story state?
4. Would `inspect` preserve pacing better than `inline`?
5. Could it reveal protected information through a thumbnail, filename, alt text, or caption?
6. Does it remain legible at narrow ChatGPT widget width?
7. Is any embedded text deterministic and accessible?
8. Are rights and provenance clear?

## QA matrix

- artifact absent before reveal in player and model JSON;
- reveal event and state version recorded once;
- player receives asset key only after reveal;
- model receives fallback text but no asset reference;
- alt text describes the visual without unnecessary prose;
- fallback text contains every required clue;
- missing asset still leaves story playable;
- narrow, desktop, zoomed, high-contrast, and reduced-motion layouts;
- keyboard and screen-reader inspection;
- source map selects the authored `ARTIFACT` declaration;
- admin artifact inspector shows provenance/accessibility completeness once asset manifests are added.

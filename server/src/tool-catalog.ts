import type { StoryScope } from "@storyframe/application";

export type StoryframeToolAudience = "player" | "creator" | "private";

export const STORYFRAME_TOOL_CATALOG = {
  start_story_session: {
    audience: "player",
    scopes: ["story:sessions:write"],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
  },
  list_story_library: {
    audience: "player",
    scopes: ["story:sessions:read"],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  open_story_library: {
    audience: "player",
    scopes: ["story:sessions:read"],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  load_story_file: {
    audience: "player",
    scopes: ["story:sessions:write"],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  play_sample_story: {
    audience: "player",
    scopes: ["story:sessions:write"],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  set_theme: {
    audience: "player",
    scopes: ["story:sessions:write"],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  submit_feedback: {
    audience: "player",
    scopes: ["story:sessions:read"],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
  },
  get_story_recap: {
    audience: "player",
    scopes: ["story:sessions:read"],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  get_story_state: {
    audience: "player",
    scopes: ["story:sessions:read"],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  submit_story_command: {
    audience: "player",
    scopes: ["story:sessions:write"],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  open_story_interface: {
    audience: "player",
    scopes: ["story:sessions:read"],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  generate_story_narration: {
    audience: "player",
    scopes: ["story:sessions:read"],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  generate_story_proposal: {
    audience: "creator",
    scopes: ["story:worlds:write"],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
  },
} as const satisfies Record<string, {
  audience: StoryframeToolAudience;
  scopes: readonly StoryScope[];
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
    idempotentHint: boolean;
  };
}>;

export type StoryframeToolName = keyof typeof STORYFRAME_TOOL_CATALOG;

export const STORYFRAME_PUBLIC_TOOL_NAMES = Object.entries(STORYFRAME_TOOL_CATALOG)
  .filter(([, tool]) => tool.audience === "player")
  .map(([name]) => name as StoryframeToolName);

export const STORYFRAME_CREATOR_TOOL_NAMES = Object.entries(STORYFRAME_TOOL_CATALOG)
  .filter(([, tool]) => tool.audience === "creator")
  .map(([name]) => name as StoryframeToolName);

export function toolContract<Name extends StoryframeToolName>(name: Name): (typeof STORYFRAME_TOOL_CATALOG)[Name] {
  return STORYFRAME_TOOL_CATALOG[name];
}

import type { App } from "@modelcontextprotocol/ext-apps";

/** Actions exposed beneath the inline LoreSight card. Keep this list aligned
 * with generic MCP tools on the server; the widget never embeds story rules. */
export type LoreSightAction = "library" | "load";

export type CreateStoryContext = {
  premise?: string;
  tone?: string;
};

export type RemixStoryContext = {
  storyId: string;
  title: string;
  format: string;
  sourceUrl: string;
  prompt: string;
};

const Z_MACHINE_GUARDRAILS = [
  "When you move from design to implementation, target only capabilities the LoreSight interpreter can actually run: supported .z3, .z5, .z8, and .zblorb stories, rooms, objects, inventory, text and character input, flags, counters, scores, branching, deterministic or seeded chance, save/restore, and authored endings.",
  "Do not promise arbitrary web APIs, real-time multiplayer, unsupported graphics, unrestricted networking, or mechanics the selected Z-machine format cannot represent. If an idea exceeds the runtime, translate it into the closest playable interactive-fiction mechanic or call out the tradeoff.",
  "Every generated choice must have a legal command, a visible response, a state consequence or meaningful discovery, and a reachable continuation or ending.",
].join(" ");

const HUMOR_GUIDANCE = [
  "For campy humor, use original voices, precise comic details, escalating reversals, deadpan institutional confidence, and jokes that can sit beside genuine danger.",
  "Use those qualities as high-level references only. Do not imitate Fallout, Borderlands, or any other named game's characters, dialogue, phrasing, settings, or protected story material.",
].join(" ");

/** Start the conversational authoring flow in the host chat. The portable
 * MCP Apps bridge is preferred; the ChatGPT alias is retained for hosts that
 * have not exposed ui/message yet, and the local event keeps the preview
 * usable without a connected host. */
export async function beginCreateStoryIntake(app: App | null, context: CreateStoryContext = {}): Promise<"mcp" | "openai" | "local"> {
  const contextLine = context.premise ? ` The player has already supplied this premise: “${context.premise}”.` : "";
  const prompt = [
    "Begin LoreSight's Imagine a new story intake as a narrative architect and Z-machine production designer.",
    "This is a staged workflow. Do not jump straight to a handful of scenes or generic prose.",
    "Ask one question at a time and wait for the answer before continuing. Keep each question focused. Collect premise, setting, protagonist, supporting cast, tone, comedic approach, approximate length, replay goals, content boundaries, and any must-have or must-avoid elements.",
    "Before drafting the story, produce a readable design brief containing: the world model; character voice sheets and relationships; locations; important objects; command vocabulary; state flags, counters, inventory, clocks, and other mechanics; the branch map; replay variations; and the possible endings.",
    "Then produce a short implementation plan that maps every proposed mechanic to a supported Z-machine capability. Mark anything that needs to be simplified or reframed.",
    "The player should be able to review this brief and approve or revise it before a playable draft is created. Once approved, generate in passes: world skeleton, critical scenes and choices, connective prose and dialogue, then a playability audit for dead ends, unreachable endings, inconsistent state, repetitive writing, and unsupported mechanics.",
    HUMOR_GUIDANCE,
    Z_MACHINE_GUARDRAILS,
    "Keep the conversation focused on interactive-fiction design; do not ask the player to upload a Z-machine file for this fully generative flow.",
    contextLine,
  ].join(" ");

  if (app) {
    try {
      const result = await app.sendMessage({ role: "user", content: [{ type: "text", text: prompt }] });
      if (!result?.isError) return "mcp";
    } catch {
      // Fall through to the ChatGPT compatibility bridge or local preview.
    }
  }

  if (window.openai?.sendFollowUpMessage) {
    try {
      await window.openai.sendFollowUpMessage({ prompt, scrollToBottom: true });
      return "openai";
    } catch {
      // Fall through to the local widget form.
    }
  }

  window.dispatchEvent(new Event("storyframe:open-create"));
  return "local";
}

/** Continue a catalog remix in chat after the widget has captured the source
 * story. The source metadata is deliberately explicit so the model never has
 * to infer which library entry the user selected. */
export async function beginRemixStoryIntake(app: App | null, context: RemixStoryContext): Promise<"mcp" | "openai" | "local"> {
  const prompt = [
    "Continue LoreSight's Remix a story flow as a source-archaeology and narrative-design workflow.",
    `The selected source is ${context.title} (${context.format}), catalog id ${context.storyId}.`,
    `Source reference: ${context.sourceUrl}`,
    context.prompt ? `The player's requested change is: “${context.prompt}”.` : "The player has not described a change yet.",
    "Treat the source as read-only and do not modify dialogue, choices, or mechanics until you have understood it.",
    "First inspect or retrieve the source. Build a source dossier covering its format and version, rooms, settings, objects, items, characters, voices, command grammar, flags and counters, inventory rules, transcripts, branch points, endings, pacing, recurring jokes, and likely hidden or undiscovered paths. If the binary cannot be inspected, say exactly what is unavailable and ask for a playable source or transcript instead of guessing.",
    "Next build a fidelity map with three buckets: KEEP CLOSE (identity, signature scenes, core rules, and required outcomes); ELASTIC (dialogue, connective prose, pacing, optional encounters, and comic framing); and WILD DELTA (new branches, reversals, settings, items, or endings explicitly authorized by the player's prompt). Explain the risk and payoff of each proposed change.",
    "Ask one focused follow-up question at a time. Before creating a draft, show the source dossier, fidelity map, remix brief, changed-state plan, and rights/provenance note, then ask for confirmation.",
    "After approval, generate in passes: preserve the source skeleton, apply the approved deltas, rewrite dialogue and choices with character-specific voices, then run a comparison audit for lost outcomes, broken commands, inconsistent flags, missing item logic, dead ends, unreachable endings, repetitive writing, and unsupported mechanics. Report what stayed faithful and what intentionally became strange.",
    HUMOR_GUIDANCE,
    Z_MACHINE_GUARDRAILS,
  ].join(" ");
  if (app) {
    try {
      const result = await app.sendMessage({ role: "user", content: [{ type: "text", text: prompt }] });
      if (!result?.isError) return "mcp";
    } catch { /* compatibility fallback */ }
  }
  if (window.openai?.sendFollowUpMessage) {
    try {
      await window.openai.sendFollowUpMessage({ prompt, scrollToBottom: true });
      return "openai";
    } catch { /* local preview fallback */ }
  }
  return "local";
}

const actionTools: Record<LoreSightAction, string> = {
  library: "open_story_library",
  load: "load_story_file",
};

const actionEvents: Record<LoreSightAction, string> = {
  library: "storyframe:open-library",
  load: "storyframe:load-file",
};

let lastEmitted: { action: LoreSightAction; at: number } | null = null;

/** Emit one local action even if a host sends both a tool result and a
 * notification for the same button activation. */
export function emitLoreSightAction(action: LoreSightAction): void {
  const now = Date.now();
  if (lastEmitted?.action === action && now - lastEmitted.at < 500) return;
  lastEmitted = { action, at: now };
  window.dispatchEvent(new Event(actionEvents[action]));
}

type StructuredAction = { action?: string };

function actionFromResult(result: unknown): LoreSightAction | null {
  if (!result || typeof result !== "object") return null;
  const structured = (result as { structuredContent?: unknown }).structuredContent;
  if (!structured || typeof structured !== "object") return null;
  const action = (structured as StructuredAction).action;
  if (action === "open_library") return "library";
  if (action === "load_file") return "load";
  return null;
}

/**
 * Invoke an inline action through the standard MCP Apps bridge first. The
 * window.openai compatibility method is retained for older ChatGPT hosts and
 * the event fallback keeps the local preview fully functional.
 */
export async function invokeLoreSightAction(action: LoreSightAction, app: App | null): Promise<"mcp" | "openai" | "local"> {
  const toolName = actionTools[action];
  if (app) {
    try {
      const result = await app.callServerTool({ name: toolName, arguments: {} });
      const resolved = actionFromResult(result) ?? action;
      emitLoreSightAction(resolved);
      return "mcp";
    } catch {
      // The host may expose the compatibility layer without the Apps bridge.
    }
  }

  if (window.openai?.callTool) {
    try {
      const result = await window.openai.callTool(toolName, {});
      const resolved = actionFromResult(result) ?? action;
      emitLoreSightAction(resolved);
      return "openai";
    } catch {
      // Fall through to the local event for preview and older hosts.
    }
  }

  emitLoreSightAction(action);
  return "local";
}

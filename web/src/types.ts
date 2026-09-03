export type DisplayMode = "inline" | "fullscreen";
import type { CrtThemeId } from "./crt-themes";

export interface PlayerIntentView {
  id: string;
  title: string;
  description: string;
  kind: "primary" | "inspect" | "decision";
  artifactId?: string;
}

export interface PlayerArtifactView {
  id: string;
  kind: string;
  title: string;
  shortTitle: string;
  summary: string;
  body: string[];
  stamp?: string;
  reviewed: boolean;
  visual?: {
    assetKey: string;
    altText: string;
    caption: string;
    textLines?: string[];
  };
}

export interface StoryframePlayerView {
  audience: "player";
  session: {
    id: string;
    worldId: string;
    worldVersion: string;
    stateVersion: number;
    status: "active" | "complete";
  };
  presentation: {
    worldTitle: string;
    identityLabel: string;
    identityValue: string;
    layout: "focus" | "investigation" | "decision" | "complete";
    stageLabel: string;
    stepLabel: string;
    headline: string;
    speakerLine: string;
    objective: string;
    progress: number;
    atmosphere: string;
    footer: string;
    frame: PlayerFrameView;
  };
  availableIntents: PlayerIntentView[];
  artifacts: PlayerArtifactView[];
  ending?: {
    title: string;
    disposition: string;
    certificate: string;
  };
}

export interface PlayerFrameView {
  kind: "default-crt" | "authored";
  preset?: "institutional" | "ornate" | "industrial" | "minimal";
  label?: string;
  mark?: string;
  colors?: {
    surround: string;
    surface: string;
    edge: string;
    accent: string;
  };
}

export interface StoryToolEnvelope {
  view?: StoryframePlayerView;
  operation?: {
    status: "committed" | "duplicate" | "rejected";
    code?: "version-conflict" | "intent-unavailable";
    message?: string;
  };
}

export interface WidgetState {
  selectedArtifactId?: string;
  displayMode?: DisplayMode;
  crtTheme?: CrtThemeId;
  rendererEffects?: Record<string, number>;
}

import type { RendererEffects } from "./cool-retro-renderer";

export type CrtThemeId =
  | "orange" | "green" | "blue"
  | "matrix" | "kindle" | "clean" | "vertigo" | "toucan"
  | "apple-blue" | "apple-green" | "apple-purple"
  | "commodore" | "commodore-white" | "muthur" | "night-owl" | "terminator";

export type CrtThemeProfile = {
  id: CrtThemeId;
  name: string;
  description: string;
  ink: string;
  paper: string;
  effects: Partial<RendererEffects>;
};

const baseEffects: Partial<RendererEffects> = {
  curvature: 0.09, bloom: 0.1, brightness: 0.5, flickering: 0,
  ambientLight: 0, rgbShift: 0, horizontalSync: 0, jitter: 0,
  staticNoise: 0, burnIn: 0, chromaColor: 0, glowingLine: 0,
  rasterizationMode: 0, rasterizationIntensity: 0, scale: 0.33,
  contrast: 0.85, saturationColor: 0, windowOpacity: 1,
};

export const crtThemeProfiles: CrtThemeProfile[] = [
  { id: "orange", name: "Amber", description: "Classic warm phosphor", ink: "#ffb000", paper: "#000000", effects: { ...baseEffects, bloom: 0.25, flickering: 0.015, ambientLight: 0.67, jitter: 0.27, staticNoise: 0.18, glowingLine: 0.22, rasterizationIntensity: 0.79 } },
  { id: "green", name: "Green", description: "Traditional green phosphor", ink: "#0ccc68", paper: "#000000", effects: { ...baseEffects, bloom: 0.16, ambientLight: 0.25, glowingLine: 0.16, rasterizationIntensity: 0.65 } },
  { id: "blue", name: "Blue", description: "Cool blue phosphor", ink: "#00aaff", paper: "#000000", effects: { ...baseEffects, bloom: 0.16, ambientLight: 0.25, glowingLine: 0.16, rasterizationIntensity: 0.65 } },
  { id: "matrix", name: "The Matrix has you...", description: "Emerald cinematic terminal", ink: "#5efaac", paper: "#020000", effects: { flickering: 0.2015, horizontalSync: 0.1072, staticNoise: 0.1004, chromaColor: 0.2486, curvature: 0.09, glowingLine: 0.0286, burnIn: 0.0982, bloom: 0.5, jitter: 0.2464, rgbShift: 0.0522, brightness: 0.5, ambientLight: 0.0309, contrast: 0.85, saturationColor: 0.4012, windowOpacity: 1, scale: 0.33 } },
  { id: "kindle", name: "Kindle", description: "Soft e-paper terminal", ink: "#1e1e1e", paper: "#d4ddc4", effects: { bloom: 0, brightness: 0.3704, burnIn: 0.4038, curvature: 0.09, staticNoise: 0, contrast: 1, saturationColor: 0, windowOpacity: 1, scale: 0.33 } },
  { id: "clean", name: "Clean", description: "High-contrast readable CRT", ink: "#ffffff", paper: "#000000", effects: { curvature: 0.09, bloom: 0.1, brightness: 1, flickering: 0.3, horizontalSync: 0.25, jitter: 0.2, staticNoise: 0.05, chromaColor: 1, contrast: 1, saturationColor: 1, windowOpacity: 1, scale: 0.33 } },
  { id: "vertigo", name: "Vertigo", description: "Subtle green jitter", ink: "#aaff7f", paper: "#000000", effects: { curvature: 0.09, ambientLight: 0.16, bloom: 0.65, brightness: 0.5, burnIn: 0.1969, flickering: 0.1, horizontalSync: 0.16, jitter: 0.0529, contrast: 0.85, saturationColor: 0, windowOpacity: 0.6961, scale: 0.33 } },
  { id: "toucan", name: "Toucan", description: "Full-color vintage display", ink: "#aaff7f", paper: "#000000", effects: { curvature: 0.09, ambientLight: 0.15, bloom: 0.2, brightness: 0.5, burnIn: 0.1, chromaColor: 1, horizontalSync: 0.16, jitter: 0.05, rasterizationMode: 1, contrast: 0.85, saturationColor: 0, windowOpacity: 0.7, scale: 0.33 } },
  { id: "apple-blue", name: "Apple II Blue Text", description: "Blue Apple II phosphor", ink: "#00e6ff", paper: "#000000", effects: { curvature: 0.09, ambientLight: 0.0154, bloom: 0.0051, brightness: 0.5, burnIn: 0.0051, flickering: 0.0668, glowingLine: 0.0325, horizontalSync: 0.0394, jitter: 0.0223, rasterizationMode: 1, staticNoise: 0.0497, contrast: 0.85, saturationColor: 0, windowOpacity: 1, scale: 0.33 } },
  { id: "apple-green", name: "Apple II Green Text", description: "Green Apple II phosphor", ink: "#00ff00", paper: "#000000", effects: { curvature: 0.09, ambientLight: 0.0154, bloom: 0.0051, brightness: 0.5, burnIn: 0.0051, flickering: 0.0668, glowingLine: 0.0325, horizontalSync: 0.0394, jitter: 0.0223, rasterizationMode: 1, staticNoise: 0.0497, contrast: 0.85, saturationColor: 0, windowOpacity: 1, scale: 0.33 } },
  { id: "apple-purple", name: "Apple II Purple Text", description: "Magenta Apple II phosphor", ink: "#ff00ff", paper: "#000000", effects: { curvature: 0.09, ambientLight: 0.0154, bloom: 0.0051, brightness: 0.5, burnIn: 0.0051, flickering: 0.0668, glowingLine: 0.0325, horizontalSync: 0.0394, jitter: 0.0223, rasterizationMode: 1, staticNoise: 0.0497, contrast: 0.85, saturationColor: 0, windowOpacity: 1, scale: 0.33 } },
  { id: "commodore", name: "Commodore 64 - Default", description: "Blue C64 screen with violet text", ink: "#7664d9", paper: "#36209b", effects: { flickering: 0.2, staticNoise: 0.0955, chromaColor: 1, curvature: 0.09, glowingLine: 0.1476, burnIn: 0.0955, bloom: 0.5017, jitter: 0.099, brightness: 0.5014, contrast: 0.85, saturationColor: 0.4983, windowOpacity: 0.7, scale: 0.33 } },
  { id: "commodore-white", name: "Commodore 64 - White", description: "Blue C64 screen with white text", ink: "#ffffff", paper: "#36209b", effects: { flickering: 0.2, staticNoise: 0.0955, chromaColor: 1, curvature: 0.09, glowingLine: 0.1476, burnIn: 0.0955, bloom: 0.5017, jitter: 0.099, brightness: 0.5014, contrast: 0.85, saturationColor: 0.4983, windowOpacity: 0.7, scale: 0.33 } },
  { id: "muthur", name: "MU/TH/UR", description: "Alien ship computer green", ink: "#41e64e", paper: "#000000", effects: { curvature: 0.09, ambientLight: 0.15, bloom: 0.4, brightness: 0.6, burnIn: 0.1, chromaColor: 1, horizontalSync: 0.16, jitter: 0.05, rasterizationMode: 1, contrast: 1, saturationColor: 1, windowOpacity: 0.9, scale: 0.33 } },
  { id: "night-owl", name: "Night Owl", description: "Deep navy with soft blue text", ink: "#729fcf", paper: "#011627", effects: { curvature: 0.09, flickering: 0.2, staticNoise: 0.0955, chromaColor: 1, glowingLine: 0.1476, burnIn: 0.0955, bloom: 0.5017, jitter: 0.099, brightness: 0.5014, contrast: 0.85, saturationColor: 0.4983, windowOpacity: 1, scale: 0.33 } },
  { id: "terminator", name: "Terminator Vision", description: "Red diagnostic display", ink: "#ffffff", paper: "#ff0000", effects: { flickering: 0.2, staticNoise: 0.0955, chromaColor: 1, curvature: 0.09, glowingLine: 0.1476, burnIn: 0.0955, bloom: 0.1483, jitter: 0.099, brightness: 0.5014, contrast: 0.85, saturationColor: 0.4983, windowOpacity: 0.7261, scale: 0.33 } },
];

export function getCrtTheme(id: CrtThemeId): CrtThemeProfile {
  return crtThemeProfiles.find((theme) => theme.id === id) ?? crtThemeProfiles[0];
}

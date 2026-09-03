import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type ThemeProfileMap = Record<string, Record<string, number>>;

const filePath = process.env.STORYFRAME_THEME_PROFILES_FILE || resolve(process.cwd(), ".storyframe-data/theme-profiles.json");

export function readThemeProfiles(): ThemeProfileMap {
  try {
    if (!existsSync(filePath)) return {};
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ThemeProfileMap : {};
  } catch {
    return {};
  }
}

export function writeThemeProfiles(profiles: ThemeProfileMap): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(profiles, null, 2), "utf8");
}

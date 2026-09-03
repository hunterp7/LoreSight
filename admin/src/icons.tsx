import type { ComponentType, SVGProps } from "react";
import { Archive } from "pixelarticons/react/Archive";
import { BookOpen } from "pixelarticons/react/BookOpen";
import { Check } from "pixelarticons/react/Check";
import { FileText } from "pixelarticons/react/FileText";
import { Globe } from "pixelarticons/react/Globe";
import { Home } from "pixelarticons/react/Home";
import { Image } from "pixelarticons/react/Image";
import { Lock } from "pixelarticons/react/Lock";
import { MapPin } from "pixelarticons/react/MapPin";
import { Notes } from "pixelarticons/react/Notes";
import { Play } from "pixelarticons/react/Play";
import { Reload } from "pixelarticons/react/Reload";
import { Search } from "pixelarticons/react/Search";
import { TestTube } from "pixelarticons/react/TestTube";
import { Undo } from "pixelarticons/react/Undo";
import { WarningDiamond } from "pixelarticons/react/WarningDiamond";

export type AdminIconName =
  | "artifact"
  | "check"
  | "clues"
  | "draft"
  | "error"
  | "help"
  | "home"
  | "image"
  | "locked"
  | "location"
  | "notes"
  | "play"
  | "playtests"
  | "refresh"
  | "repair"
  | "search"
  | "world";

const ICONS: Record<AdminIconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  artifact: Archive,
  check: Check,
  clues: Image,
  draft: FileText,
  error: WarningDiamond,
  help: BookOpen,
  home: Home,
  image: Image,
  locked: Lock,
  location: MapPin,
  notes: Notes,
  play: Play,
  playtests: TestTube,
  refresh: Reload,
  repair: Undo,
  search: Search,
  world: Globe,
};

const ARTIFACT_ICONS: Record<string, AdminIconName> = {
  document: "draft",
  image: "image",
  map: "location",
  record: "notes",
  log: "notes",
  memo: "notes",
  clue: "clues",
  tool: "repair",
};

export function artifactIconName(kind: string): AdminIconName {
  return ARTIFACT_ICONS[kind.toLowerCase()] ?? "artifact";
}

export function AdminIcon({ name, size = 18, className = "" }: { name: AdminIconName; size?: number; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={`admin-icon ${className}`} width={size} height={size} aria-hidden="true" focusable="false" />;
}

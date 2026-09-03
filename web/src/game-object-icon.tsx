import type { ComponentType, SVGProps } from "react";
import { Archive } from "pixelarticons/react/Archive";
import { AudioWaveform } from "pixelarticons/react/AudioWaveform";
import { Backpack } from "pixelarticons/react/Backpack";
import { BookOpen } from "pixelarticons/react/BookOpen";
import { ClipboardNote } from "pixelarticons/react/ClipboardNote";
import { Coins } from "pixelarticons/react/Coins";
import { FileText } from "pixelarticons/react/FileText";
import { Grid3x3 } from "pixelarticons/react/Grid3x3";
import { Image } from "pixelarticons/react/Image";
import { MapPin } from "pixelarticons/react/MapPin";
import { Package } from "pixelarticons/react/Package";
import { Potion } from "pixelarticons/react/Potion";
import { ScrollVertical } from "pixelarticons/react/ScrollVertical";
import { ToolCase } from "pixelarticons/react/ToolCase";
import { User } from "pixelarticons/react/User";

type PixelIcon = ComponentType<SVGProps<SVGSVGElement>>;

const iconByKind: Record<string, PixelIcon> = {
  record: FileText,
  document: FileText,
  log: ScrollVertical,
  memorandum: ClipboardNote,
  product: Package,
  item: Backpack,
  inventory: Backpack,
  book: BookOpen,
  image: Image,
  diagram: Grid3x3,
  map: MapPin,
  location: MapPin,
  currency: Coins,
  tool: ToolCase,
  potion: Potion,
  character: User,
  audio: AudioWaveform,
};

export function GameObjectIcon({ kind, size = 24, className = "" }: { kind: string; size?: number; className?: string }) {
  const Icon = iconByKind[kind] ?? Archive;
  return <Icon width={size} height={size} className={`game-object-icon ${className}`.trim()} aria-hidden="true" focusable="false" />;
}

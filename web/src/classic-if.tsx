import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerFrameView } from "./types";
import sampleStoryUrl from "./assets/stories/figaro.zblorb";
import asciiArtMask from "./assets/loresight-ascii-mask.png";
import { CoolRetroRenderer, defaultRendererEffects, type RendererEffects } from "./cool-retro-renderer";
import { playableStoryCatalog, type StoryCatalogEntry } from "./story-catalog";
import { getCrtTheme, type CrtThemeId } from "./crt-themes";
import type { InterpreterAdapter } from "./interpreter-adapter";
import { diagnosticEntryCount, getDiagnosticSnapshot, recordDiagnostic, type FeedbackPayload } from "./diagnostics";

type TranscriptEntry = {
  id: number;
  kind: "system" | "story" | "command" | "error";
  text: string;
};

type RuntimeRequest = {
  kind: "idle" | "line" | "char" | "file";
  prompt: string;
};

type RuntimeSnapshot = {
  loaded: boolean;
  storyName: string;
  transcript: TranscriptEntry[];
  statusLine: string;
  request: RuntimeRequest;
  lastCommand: string;
  error: string;
  version: number | null;
  lineCount: number;
};

type WindowRecord = {
  id: number;
  rock: number;
  type: 3 | 4;
  parentId: number | null;
  height: number;
  width: number;
  stream: StreamRecord;
  str: StreamRecord;
  textBuffer: string;
  gridLines: string[];
  cursorRow: number;
  cursorCol: number;
  lineRequest: boolean;
  charRequest: boolean;
  linebuf: number[] | null;
  requestEchoLineInput: boolean | null;
};

type StreamRecord = {
  id: number;
  rock: number;
  ownerId: number;
  text: string;
};

function codePointsFromText(text: string): number[] {
  return Array.from(text, (char) => char.codePointAt(0) ?? 63);
}

function keyCodeForChar(key: string): number {
  if (key === "Backspace") return 8;
  if (key === "Enter") return 13;
  if (key === "Escape") return 27;
  if (key === "ArrowUp") return 129;
  if (key === "ArrowDown") return 130;
  if (key === "ArrowLeft") return 131;
  if (key === "ArrowRight") return 132;
  if (key === "End") return 146;
  if (key === "PageDown") return 148;
  if (key === "Home") return 152;
  if (key === "PageUp") return 154;
  if (key.length === 1) return key.codePointAt(0) ?? 63;
  return 63;
}

class BrowserGlkBridge {
  private readonly onChange: () => void;
  private vm: any = null;
  private selectRef: any = null;
  private filePrompt: { descriptor: string; resolve: (value: null) => void } | null = null;
  private windows = new Map<number, WindowRecord>();
  private streams = new Map<number, StreamRecord>();
  private currentWindowId: number | null = null;
  private nextWindowId = 1;
  private nextStreamId = 1;
  private storyTranscript: TranscriptEntry[] = [];
  private statusLine = "";
  private request: RuntimeRequest = { kind: "idle", prompt: "" };
  private lastCommand = "";
  private error = "";
  private storyName = "";
  private storyBuffer: ArrayBuffer | null = null;
  private version: number | null = null;
  private loaded = false;
  private entryId = 1;
  private syntheticCommandHandler: ((command: string) => void) | null = null;

  constructor(onChange: () => void) {
    this.onChange = onChange;
  }

  attachVm(vm: any) {
    this.vm = vm;
  }

  reset(storyName: string) {
    this.windows.clear();
    this.streams.clear();
    this.currentWindowId = null;
    this.nextWindowId = 1;
    this.nextStreamId = 1;
    this.storyTranscript = [];
    this.statusLine = "";
    this.request = { kind: "idle", prompt: "" };
    this.lastCommand = "";
    this.error = "";
    this.storyName = storyName;
    this.version = null;
    this.loaded = false;
    this.entryId = 1;
    this.selectRef = null;
    this.filePrompt = null;
    this.syntheticCommandHandler = null;
  }

  startSynthetic(storyName: string, opening: string[], onCommand: (command: string) => void) {
    this.reset(storyName);
    this.loaded = true;
    this.syntheticCommandHandler = onCommand;
    this.emit("system", `Loaded ${storyName}`);
    opening.forEach((line) => this.emit("story", line));
    this.request = { kind: "line", prompt: ">" };
    this.onChange();
  }

  respondSynthetic(lines: string[], statusLine = "What do you do?", keepPlaying = true) {
    lines.forEach((line) => this.emit("story", line));
    this.statusLine = statusLine;
    this.loaded = keepPlaying;
    this.request = keepPlaying ? { kind: "line", prompt: ">" } : { kind: "idle", prompt: "" };
    if (!keepPlaying) this.syntheticCommandHandler = null;
    this.onChange();
  }

  snapshot(): RuntimeSnapshot {
    return {
      loaded: this.loaded,
      storyName: this.storyName,
      transcript: this.storyTranscript,
      statusLine: this.statusLine,
      request: this.request,
      lastCommand: this.lastCommand,
      error: this.error,
      version: this.version,
      lineCount: this.storyTranscript.length,
    };
  }

  private emit(kind: TranscriptEntry["kind"], text: string) {
    if (!text) return;
    this.storyTranscript.push({ id: this.entryId++, kind, text });
    this.onChange();
  }

  private emitChunk(kind: TranscriptEntry["kind"], text: string) {
    const normalized = text.replace(/\r\n?/g, "\n");
    const parts = normalized.split("\n");
    parts.forEach((part, index) => {
      if (part.length > 0) {
        this.storyTranscript.push({ id: this.entryId++, kind, text: part });
      }
      if (index < parts.length - 1) {
        this.storyTranscript.push({ id: this.entryId++, kind, text: "" });
      }
    });
  }

  private getWindowById(id: number | null) {
    if (id == null) return null;
    return this.windows.get(id) ?? null;
  }

  private getStreamById(id: number | null) {
    if (id == null) return null;
    return this.streams.get(id) ?? null;
  }

  private createWindow(type: 3 | 4, parentId: number | null, rock: number) {
    const id = this.nextWindowId++;
    const stream: StreamRecord = { id: this.nextStreamId++, rock, ownerId: id, text: "" };
    const window: WindowRecord = {
      id,
      rock,
      type,
      parentId,
      height: type === 4 ? 1 : 24,
      width: 78,
      stream,
      str: stream,
      textBuffer: "",
      gridLines: type === 4 ? [""] : [],
      cursorRow: 0,
      cursorCol: 0,
      lineRequest: false,
      charRequest: false,
      linebuf: null,
      requestEchoLineInput: null,
    };
    this.windows.set(id, window);
    this.streams.set(stream.id, stream);
    if (this.currentWindowId == null && type === 3) {
      this.currentWindowId = id;
    }
    return window;
  }

  private writeTextToWindow(window: WindowRecord | null, text: string) {
    if (!window || !text) return;
    const normalized = text.replace(/\r\n?/g, "\n");
    if (window.type === 3) {
      window.textBuffer += normalized;
      const chunks = window.textBuffer.split("\n");
      window.textBuffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        this.emit("story", chunk);
      }
      this.onChange();
      return;
    }

    const lines = window.gridLines.length ? [...window.gridLines] : [""];
    let row = window.cursorRow;
    let col = window.cursorCol;
    for (const char of normalized) {
      if (char === "\n") {
        row += 1;
        col = 0;
        if (!lines[row]) lines[row] = "";
        continue;
      }
      const current = lines[row] ?? "";
      const left = current.slice(0, col);
      const right = current.slice(col + 1);
      lines[row] = `${left}${char}${right}`.slice(0, window.width);
      col += 1;
      if (col >= window.width) {
        row += 1;
        col = 0;
        if (!lines[row]) lines[row] = "";
      }
    }
    window.gridLines = lines;
    window.cursorRow = row;
    window.cursorCol = col;
    // Grid windows can contain sparse rows when a story jumps the cursor or
    // resizes a window.  Treat those holes as empty rows instead of assuming
    // every value is a string (some stories otherwise crash on `.trim()`).
    const firstNonEmptyLine = lines.find(
      (line): line is string => typeof line === "string" && line.trim().length > 0,
    );
    this.statusLine = firstNonEmptyLine?.trim() ?? this.statusLine;
    this.onChange();
  }

  private flushTextBuffer(window: WindowRecord | null) {
    if (!window || window.type !== 3 || !window.textBuffer) return;
    const pending = window.textBuffer;
    window.textBuffer = "";
    this.emit("story", pending);
    this.onChange();
  }

  private resolveFilePrompt(result: null) {
    const prompt = this.filePrompt;
    this.filePrompt = null;
    prompt?.resolve(result);
  }

  prepareVm(buffer: ArrayBuffer, storyName: string) {
    this.reset(storyName);
    this.storyBuffer = buffer.slice(0);
    if (!this.vm) return;

    try {
      const storyData = buffer;
      this.vm.prepare(storyData, { Glk: this });
      this.vm.start();
      this.loaded = true;
      const data = new Uint8Array(storyData);
      this.version = data[0] ?? null;
      this.emit("system", `Loaded ${storyName}`);
      this.onChange();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to start this story.";
      this.emit("error", this.error);
      this.onChange();
    }
  }

  submitLine(text: string) {
    const request = this.request;
    if (request.kind !== "line") return;
    if (this.syntheticCommandHandler) {
      const normalized = text.trimEnd();
      this.lastCommand = normalized;
      this.emit("command", `> ${normalized}`);
      this.request = { kind: "idle", prompt: "" };
      this.onChange();
      this.syntheticCommandHandler(normalized);
      return;
    }
    const window = this.getWindowById(this.currentWindowId) ?? this.windows.values().next().value ?? null;
    const buffer = window?.linebuf;
    if (!buffer || !this.selectRef || !window) return;

    const normalized = text.trimEnd();
    this.lastCommand = normalized;
    this.emit("command", `> ${normalized}`);

    const chars = codePointsFromText(normalized);
    const max = Math.max(0, buffer.length);
    const used = Math.min(max, chars.length);
    for (let index = 0; index < used; index += 1) {
      buffer[index] = chars[index];
    }
    if (buffer.length > used) {
      for (let index = used; index < buffer.length; index += 1) {
        buffer[index] = 0;
      }
    }

    this.selectRef.set_field(0, 3);
    this.selectRef.set_field(1, window);
    this.selectRef.set_field(2, used);
    this.selectRef.set_field(3, 13);
    this.request = { kind: "idle", prompt: "" };
    this.onChange();
    this.vm.resume(null);
  }

  submitChar(key: string) {
    const request = this.request;
    if (request.kind !== "char" || !this.selectRef) return;
    const window = this.getWindowById(this.currentWindowId) ?? this.windows.values().next().value ?? null;
    const code = keyCodeForChar(key);
    this.lastCommand = key;
    this.emit("command", `# ${key}`);
    this.selectRef.set_field(0, 2);
    this.selectRef.set_field(1, window);
    this.selectRef.set_field(2, code);
    this.request = { kind: "idle", prompt: "" };
    this.onChange();
    this.vm.resume(null);
  }

  restart() {
    if (!this.vm || !this.storyBuffer) return false;
    try {
      this.prepareVm(this.storyBuffer.slice(0), this.storyName);
      this.emit("system", "Story restarted.");
      this.onChange();
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to restart this story.";
      this.emit("error", this.error);
      this.onChange();
      return false;
    }
  }

  glk_exit() {
    for (const window of this.windows.values()) this.flushTextBuffer(window);
    this.loaded = false;
    this.emit("system", "Story ended.");
    this.onChange();
  }

  update() {
    this.onChange();
  }

  fatal_error(error: unknown) {
    this.error = error instanceof Error ? error.message : String(error);
    this.emit("error", this.error);
    this.onChange();
  }

  glk_select(eventref: any) {
    this.selectRef = eventref;
    this.onChange();
    return { dummy: "Glk call has not yet returned" };
  }

  glk_gestalt(selector: number) {
    if (selector === 0x1100) return 0;
    return 1;
  }

  RefBox = class RefBox {
    value: any;
    set_value = (value: any) => {
      this.value = value;
    };
    get_value = () => this.value;
  };

  RefStruct = class RefStruct {
    fields: any[] = [];
    push_field = (value: any) => {
      this.fields.push(value);
    };
    set_field = (position: number, value: any) => {
      this.fields[position] = value;
    };
    get_field = (position: number) => this.fields[position];
    get_fields = () => this.fields;
  };

  glk_window_open = (_parent: any, _method: number, _size: number, type: number, rock: number) => {
    const parentId = _parent?.id ?? null;
    const window = this.createWindow(type === 4 ? 4 : 3, parentId, rock);
    return window;
  };

  glk_window_close = (window: WindowRecord | null) => {
    if (!window) return;
    this.windows.delete(window.id);
    if (this.currentWindowId === window.id) {
      this.currentWindowId = null;
    }
    this.onChange();
  };

  glk_window_get_parent = (window: WindowRecord | null) => (window ? this.getWindowById(window.parentId) : null);

  glk_window_set_arrangement = (_parent: any, _method: number, size: number) => {
    const upper = [...this.windows.values()].find((candidate) => candidate.type === 4);
    if (upper) upper.height = size;
    this.onChange();
  };

  glk_window_clear = (window: WindowRecord | null) => {
    if (!window) return;
    if (window.type === 3) {
      window.textBuffer = "";
      this.storyTranscript.push({ id: this.entryId++, kind: "system", text: "[screen cleared]" });
    } else {
      window.gridLines = Array.from({ length: window.height }, () => "");
      window.cursorRow = 0;
      window.cursorCol = 0;
      this.statusLine = "";
    }
    this.onChange();
  };

  glk_window_get_stream = (window: WindowRecord | null) => (window ? window.stream : null);

  glk_window_move_cursor = (window: WindowRecord | null, col: number, row: number) => {
    if (!window) return;
    window.cursorCol = Math.max(0, col);
    window.cursorRow = Math.max(0, row);
  };

  glk_window_get_size = (window: WindowRecord | null, widthBox: any, heightBox: any) => {
    const width = window?.width ?? 78;
    const height = window?.height ?? 24;
    if (widthBox?.set_value) widthBox.set_value(width);
    else widthBox.value = width;
    if (heightBox?.set_value) heightBox.set_value(height);
    else if (heightBox) heightBox.value = height;
  };

  glk_stream_iterate = (stream: StreamRecord | null, rockBox: any) => {
    const items = [...this.streams.values()].sort((left, right) => left.id - right.id);
    const index = stream ? items.findIndex((candidate) => candidate.id === stream.id) + 1 : 0;
    const next = items[index] ?? null;
    if (next && rockBox) rockBox.value = next.rock;
    return next;
  };

  glk_window_iterate = (window: WindowRecord | null, rockBox: any) => {
    const items = [...this.windows.values()].sort((left, right) => left.id - right.id);
    const index = window ? items.findIndex((candidate) => candidate.id === window.id) + 1 : 0;
    const next = items[index] ?? null;
    if (next && rockBox) rockBox.value = next.rock;
    return next;
  };

  glk_put_jstring = (text: string) => {
    const window = this.getWindowById(this.currentWindowId);
    this.writeTextToWindow(window, String(text));
  };

  glk_put_char_stream_uni = (stream: StreamRecord | null, code: number) => {
    this.glk_put_jstring_stream(stream, String.fromCodePoint(code));
  };

  glk_put_jstring_stream = (stream: StreamRecord | null, text: string) => {
    const window = stream ? this.getWindowById(stream.ownerId) : null;
    this.writeTextToWindow(window, String(text));
  };

  glk_put_buffer_stream = (stream: StreamRecord | null, buffer: Uint8Array) => {
    this.glk_put_jstring_stream(stream, new TextDecoder().decode(buffer));
  };

  glk_get_line_stream_uni = () => -1;
  glk_get_char_stream_uni = () => -1;

  glk_request_line_event_uni = (window: WindowRecord | null, buffer: number[], initlen: number) => {
    if (!window) return;
    this.flushTextBuffer(window);
    window.lineRequest = true;
    window.linebuf = buffer;
    window.requestEchoLineInput = initlen > 0 ? true : null;
    this.request = { kind: "line", prompt: "Enter a command" };
    this.currentWindowId = window.id;
    this.onChange();
  };

  glk_request_char_event_uni = (window: WindowRecord | null) => {
    if (!window) return;
    this.flushTextBuffer(window);
    window.charRequest = true;
    this.request = { kind: "char", prompt: "Press any key" };
    this.currentWindowId = window.id;
    this.onChange();
  };

  glk_set_window = (window: WindowRecord | null) => {
    this.currentWindowId = window?.id ?? null;
    this.onChange();
  };

  glk_set_style = () => {};
  glk_stylehint_set = () => {};
  glk_stylehint_clear = () => {};
  garglk_set_reversevideo = () => {};
  garglk_set_reversevideo_stream = () => {};
  garglk_set_zcolors_stream = () => {};
  glk_stream_close = () => {};
  glk_fileref_destroy = () => {};
  glk_request_char_event = this.glk_request_char_event_uni;
  glk_request_line_event = this.glk_request_line_event_uni;
  glk_cancel_char_event = () => {};
  glk_cancel_line_event = () => {};
  glk_set_echo_line_event = () => {};

  glk_fileref_create_by_prompt = (usage: number, mode: number, rock: number) => {
    this.request = { kind: "file", prompt: "File prompt unavailable in browser preview" };
    this.onChange();
    return new Promise<null>((resolve) => {
      this.filePrompt = { descriptor: `${usage}:${mode}:${rock}`, resolve };
      queueMicrotask(() => {
        if (this.filePrompt?.resolve === resolve) {
          this.resolveFilePrompt(null);
          this.request = { kind: "idle", prompt: "" };
          this.onChange();
          if (this.vm?.glk_blocking_call) {
            this.vm.resume(null);
          }
        }
      });
    });
  };

  glk_stream_open_file = () => null;
  glk_stream_open_file_uni = () => null;
  glk_update = () => this.update();
}

/** Current adapter; Parchment/emglken can be added behind this contract. */
const ifvmsAdapter: InterpreterAdapter = {
  id: "ifvms",
  capabilities: { zCode: true, glulx: false, saveRestore: false, audio: false },
  async create(onChange) {
    const ifvmsModule: any = await import("ifvms");
    const candidates = [
      ifvmsModule.ZVM,
      ifvmsModule.default,
      ifvmsModule["module.exports"],
      ifvmsModule.default?.ZVM,
      ifvmsModule.default?.default,
    ];
    const ZVM = candidates.find((candidate) => typeof candidate === "function");
    if (typeof ZVM !== "function") {
      throw new Error(`The IF runtime did not expose a usable ZVM constructor. Saw: ${candidates.map((candidate) => typeof candidate).join(", ")}`);
    }
    const bridge = new BrowserGlkBridge(onChange);
    const vm = new ZVM();
    bridge.attachVm(vm);
    return { bridge, vm };
  },
};

const themeLabIds: CrtThemeId[] = ["orange", "green", "blue", "matrix", "kindle", "clean", "vertigo", "toucan", "apple-blue", "apple-green", "apple-purple", "commodore", "commodore-white", "muthur", "night-owl", "terminator"];
const themeLabFields: Array<{ key: keyof RendererEffects; label: string; min: number; max: number; step: number }> = [
  { key: "brightness", label: "Brightness", min: 0, max: 1, step: .01 },
  { key: "curvature", label: "Curve", min: 0, max: 1, step: .01 },
  { key: "bloom", label: "Bloom", min: 0, max: 1, step: .01 },
  { key: "flickering", label: "Flicker", min: 0, max: .3, step: .005 },
  { key: "ambientLight", label: "Ambient", min: 0, max: 1, step: .01 },
  { key: "rgbShift", label: "RGB shift", min: 0, max: .01, step: .001 },
  { key: "horizontalSync", label: "Sync", min: 0, max: 1, step: .01 },
  { key: "jitter", label: "Jitter", min: 0, max: 1, step: .01 },
  { key: "burnIn", label: "Burn-in", min: 0, max: 1, step: .01 },
  { key: "staticNoise", label: "Noise", min: 0, max: 1, step: .01 },
  { key: "glowingLine", label: "Glow line", min: 0, max: 1, step: .01 },
  { key: "rasterizationIntensity", label: "Scanline", min: 0, max: 1, step: .01 },
  { key: "scale", label: "Text size", min: .2, max: 1, step: .01 },
];

function readThemeLabDrafts(): Record<CrtThemeId, RendererEffects> {
  let saved: Record<string, Partial<RendererEffects>> = {};
  try { saved = JSON.parse(window.localStorage.getItem("storyframe.rendererEffectsByTheme.v2") || "{}"); } catch { /* optional storage */ }
  return Object.fromEntries(themeLabIds.map((id) => [id, { ...defaultRendererEffects, ...getCrtTheme(id).effects, ...(saved[id] ?? {}) }])) as Record<CrtThemeId, RendererEffects>;
}

function useRerender() {
  const [revision, setRevision] = useState(0);
  return [revision, () => setRevision((value) => value + 1)] as const;
}

function derivePredictiveActions(snapshot: RuntimeSnapshot): string[] {
  const storyIsActive = snapshot.loaded || (snapshot.storyName.length > 0 && snapshot.storyName !== "No story loaded");
  if (!storyIsActive || (snapshot.request.kind !== "line" && snapshot.request.kind !== "char")) return [];
  const recent = snapshot.transcript.slice(-12).map((entry) => typeof entry.text === "string" ? entry.text : "").join(" ").toLowerCase();
  const nouns: string[] = [];
  const nounPattern = /\b(?:a|an|the)\s+([a-z][a-z-]{2,})\b/g;
  for (const match of recent.matchAll(nounPattern)) {
    const noun = match[1];
    if (!noun || ["room", "place", "thing", "way", "moment", "bit"].includes(noun) || nouns.includes(noun)) continue;
    nouns.push(noun);
    if (nouns.length >= 3) break;
  }
  const suggestions: string[] = ["LOOK"];
  if (nouns[0]) suggestions.push(`EXAMINE ${nouns[0].toUpperCase()}`);
  if (/door|gate|chest|box|container|locked|keyhole/.test(recent)) suggestions.push(`OPEN ${(nouns.find((noun) => /door|gate|chest|box|container|keyhole/.test(noun)) ?? "DOOR").toUpperCase()}`);
  if (/key|lamp|book|note|letter|coin|object|item|carry|floor|table/.test(recent)) suggestions.push(`TAKE ${(nouns[1] ?? "ITEM").toUpperCase()}`);
  if (/north|south|east|west|corridor|hallway|path|outside|exit/.test(recent)) suggestions.push(recent.includes("north") ? "NORTH" : recent.includes("south") ? "SOUTH" : recent.includes("east") ? "EAST" : "WEST");
  suggestions.push("INVENTORY", "WAIT", "HELP");
  const unique = Array.from(new Set(suggestions));
  for (const fallback of ["EXAMINE", "LOOK", "WAIT", "INVENTORY", "HELP"]) {
    if (unique.length >= 5) break;
    if (!unique.includes(fallback)) unique.push(fallback);
  }
  return unique.slice(0, 5);
}

type ClassicIfSurfaceProps = {
  onStoryLoaded?: () => void;
  crtTheme?: CrtThemeId;
  rendererEffects?: RendererEffects;
  rendererLocked?: boolean;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  controlsOpen?: boolean;
  onControlsOpenChange?: (open: boolean) => void;
  libraryOpen?: boolean;
  onLibraryOpenChange?: (open: boolean) => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  remixOpen?: boolean;
  onRemixOpenChange?: (open: boolean) => void;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  isFullscreen?: boolean;
  onThemeChange?: (themeId: CrtThemeId) => void;
  onRendererEffectChange?: (key: keyof RendererEffects, value: number) => void;
  onLockEffects?: () => void;
  onPredictiveActions?: (actions: string[]) => void;
  onSubmitFeedback?: (payload: FeedbackPayload) => Promise<void>;
  onCreateStory?: (context: { premise: string; tone: string }) => Promise<"mcp" | "openai" | "local">;
};

function CrtPageOverlay({ className, ariaLabel, children }: { className: string; ariaLabel: string; children: React.ReactNode }) {
  return <section className={`crt-page-overlay ${className}`} aria-label={ariaLabel}>{children}</section>;
}

export function ClassicIfSurface({ onStoryLoaded, crtTheme = "orange", rendererEffects = defaultRendererEffects, rendererLocked = false, settingsOpen = false, onSettingsOpenChange, controlsOpen: controlsOpenProp, onControlsOpenChange, libraryOpen: libraryOpenProp, onLibraryOpenChange, createOpen = false, onCreateOpenChange, remixOpen = false, onRemixOpenChange, menuOpen = false, onMenuOpenChange, isFullscreen = false, onThemeChange, onRendererEffectChange, onLockEffects, onPredictiveActions, onSubmitFeedback, onCreateStory }: ClassicIfSurfaceProps) {
  const [revision, rerender] = useRerender();
  const runtimeRef = useRef<{
    bridge: BrowserGlkBridge;
    vm: any;
    storyBuffer: ArrayBuffer | null;
    storyName: string;
    commandHistory: string[];
    historyIndex: number;
  } | null>(null);
  const interfaceRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [command, setCommand] = useState("");
  const [loadedLabel, setLoadedLabel] = useState("No story loaded");
  const [isBooting, setIsBooting] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [localControlsOpen, setLocalControlsOpen] = useState(false);
  const [themeLabOpen, setThemeLabOpen] = useState(false);
  const [storyPrompt, setStoryPrompt] = useState("");
  const [storyTone, setStoryTone] = useState("mysterious");
  const [remixPrompt, setRemixPrompt] = useState("");
  const [remixSource, setRemixSource] = useState<"catalog" | "upload">("catalog");
  const [remixCatalogStoryId, setRemixCatalogStoryId] = useState(playableStoryCatalog[0]?.id ?? "");
  const [remixFile, setRemixFile] = useState<File | null>(null);
  const [generationNotice, setGenerationNotice] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [attachDiagnostics, setAttachDiagnostics] = useState(true);
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [feedbackError, setFeedbackError] = useState("");
  const [themeLabDrafts, setThemeLabDrafts] = useState<Record<CrtThemeId, RendererEffects>>(() => readThemeLabDrafts());
  const crtProfile = getCrtTheme(crtTheme);
  const controlsOpen = controlsOpenProp ?? localControlsOpen;
  const libraryIsOpen = libraryOpenProp ?? libraryOpen;
  const setControlsOpen = (open: boolean) => {
    if (controlsOpenProp === undefined) setLocalControlsOpen(open);
    onControlsOpenChange?.(open);
  };
  const setLibraryIsOpen = (open: boolean) => {
    if (libraryOpenProp === undefined) setLibraryOpen(open);
    onLibraryOpenChange?.(open);
  };

  function commitThemeLab() {
    try { window.localStorage.setItem("storyframe.rendererEffectsByTheme.v2", JSON.stringify(themeLabDrafts)); } catch { /* optional storage */ }
    window.dispatchEvent(new CustomEvent("storyframe:set-theme", { detail: crtTheme }));
    setThemeLabOpen(false);
    onSettingsOpenChange?.(true);
  }

  function selectTheme(themeId: CrtThemeId) {
    if (onThemeChange) onThemeChange(themeId);
    else window.dispatchEvent(new CustomEvent("storyframe:set-theme", { detail: themeId }));
  }

  function updateActiveThemeEffect(key: keyof RendererEffects, value: number) {
    if (onRendererEffectChange) onRendererEffectChange(key, value);
    else window.dispatchEvent(new CustomEvent("storyframe:set-effect", { detail: { key, value } }));
  }

  function saveActiveTheme() {
    if (onLockEffects) onLockEffects();
    else window.dispatchEvent(new CustomEvent("storyframe:lock-effects"));
  }

  function leavePage() {
    if (feedbackOpen) { setFeedbackOpen(false); setFeedbackStatus("idle"); setFeedbackError(""); return; }
    if (themeLabOpen) { setThemeLabOpen(false); onSettingsOpenChange?.(true); return; }
    if (controlsOpen) { setControlsOpen(false); return; }
    if (settingsOpen) { onSettingsOpenChange?.(false); return; }
    if (libraryIsOpen) setLibraryIsOpen(false);
    if (createOpen) onCreateOpenChange?.(false);
    if (remixOpen) onRemixOpenChange?.(false);
  }

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (feedbackMessage.trim().length < 10 || feedbackStatus === "sending") return;
    setFeedbackStatus("sending");
    setFeedbackError("");
    try {
      const payload: FeedbackPayload = {
        category: feedbackCategory,
        message: feedbackMessage.trim(),
        contact: feedbackContact.trim() || undefined,
        diagnostics: attachDiagnostics ? getDiagnosticSnapshot() : undefined,
        context: { displayMode: isFullscreen ? "fullscreen" : "inline", theme: crtTheme, storyLoaded: snapshot.loaded, interpreterVersion: snapshot.version },
      };
      if (onSubmitFeedback) await onSubmitFeedback(payload);
      else {
        const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        if (!response.ok) {
          const result = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(result.error || "Feedback could not be sent.");
        }
      }
      recordDiagnostic("feedback.sent", "Feedback report accepted");
      setFeedbackStatus("sent");
      setFeedbackMessage("");
    } catch (error) {
      setFeedbackStatus("error");
      setFeedbackError(error instanceof Error ? error.message : "Feedback could not be sent.");
    }
  }

  const snapshot = useMemo<RuntimeSnapshot>(() => {
    const runtime = runtimeRef.current;
    return runtime ? runtime.bridge.snapshot() : {
      loaded: false,
      storyName: loadedLabel,
      transcript: [],
      statusLine: "Load a .z3, .z5, .z8, or .zblorb file to begin.",
      request: { kind: "idle", prompt: "" },
      lastCommand: "",
      error: "",
      version: null,
      lineCount: 0,
    };
  }, [loadedLabel, revision]);

  useEffect(() => {
    if (snapshot.transcript.length && !settingsOpen && !controlsOpen && !themeLabOpen && !libraryIsOpen && !createOpen && !remixOpen && !menuOpen) interfaceRef.current?.focus();
  }, [revision, snapshot.transcript.length, settingsOpen, controlsOpen, themeLabOpen, libraryIsOpen, createOpen, remixOpen, menuOpen]);

  useEffect(() => {
    onPredictiveActions?.(derivePredictiveActions(snapshot));
  }, [onPredictiveActions, snapshot]);

  useEffect(() => {
    if (createOpen || remixOpen) setGenerationNotice("");
  }, [createOpen, remixOpen]);

  useEffect(() => {
    window.openai?.notifyIntrinsicHeight?.();
  }, [revision, loadedLabel, isBooting]);

  function startGeneratedPreview(rawPremise: string, tone: string) {
    const premise = rawPremise.replace(/\s+/g, " ").trim().slice(0, 500);
    const storyName = `Imagine: ${premise.slice(0, 42)}${premise.length > 42 ? "…" : ""}`;
    const bridge = new BrowserGlkBridge(rerender);
    let stage = 0;
    let hasToken = false;
    const scene = () => stage === 0
      ? `You stand at the edge of a place shaped by your idea: ${premise}. A narrow path leads north. Something metallic glints beside your foot.`
      : stage === 1
        ? "The path ends in a moonlit courtyard. A weathered gate waits to the east, marked with a symbol that matches the glinting object."
        : "Beyond the gate is a quiet chamber. A dark console waits beneath a single blinking light.";
    bridge.startSynthetic(storyName, [
      "LORESIGHT / IMAGINED STORY",
      `Tone: ${tone}`,
      "",
      scene(),
      "",
      "What do you do? Try LOOK, EXAMINE, TAKE, NORTH, INVENTORY, or HELP.",
    ], (entered) => {
      const command = entered.trim().toLowerCase();
      if (/^(look|l)$/.test(command)) bridge.respondSynthetic([scene()]);
      else if (/^(help|commands?)$/.test(command)) bridge.respondSynthetic(["Try LOOK, EXAMINE, TAKE, INVENTORY, NORTH, EAST, OPEN, WAIT, or QUIT."]);
      else if (/^(inventory|i)$/.test(command)) bridge.respondSynthetic([hasToken ? "You are carrying a small brass token." : "You are carrying nothing."]);
      else if (/^(take|get)(\s+.*)?$/.test(command) && stage === 0 && !hasToken) {
        hasToken = true;
        bridge.respondSynthetic(["You take the small brass token. It is warm, and its etched symbol seems important."], "The northern path is still open.");
      } else if (/^(examine|x|search)(\s+.*)?$/.test(command)) {
        bridge.respondSynthetic([stage === 0 ? "The metallic glint is a brass token engraved with a branching star." : stage === 1 ? "The gate has a token-shaped recess beside its latch." : "The console reads: PLACE THE TOKEN TO COMPLETE THE CIRCUIT."]);
      } else if (/^(north|n)$/.test(command) && stage === 0) {
        stage = 1;
        bridge.respondSynthetic(["You follow the narrow path.", scene()], "The gate lies east.");
      } else if (/^(east|e|open)(\s+.*)?$/.test(command) && stage === 1) {
        if (!hasToken) bridge.respondSynthetic(["The gate will not move. The token-shaped recess suggests you left something behind."], "Perhaps return SOUTH or search the first area.");
        else {
          stage = 2;
          bridge.respondSynthetic(["The brass token settles into the recess. The gate opens with a low electric sigh.", scene()], "The console is waiting.");
        }
      } else if (/^(south|s)$/.test(command) && stage === 1) {
        stage = 0;
        bridge.respondSynthetic(["You return along the path.", scene()]);
      } else if (/^(open|use|put)(\s+.*)?$/.test(command) && stage === 2 && hasToken) {
        bridge.respondSynthetic(["You place the token in the console.", "The chamber fills with warm light. Your imagined world steadies around you, ready for whatever comes next.", "", "END OF PREVIEW STORY"], "Story complete", false);
      } else if (/^(wait|z)$/.test(command)) bridge.respondSynthetic(["A moment passes. Somewhere ahead, machinery clicks once."]);
      else if (/^(quit|q)$/.test(command)) bridge.respondSynthetic(["You let the imagined world fade. Open the menu whenever you want to begin again."], "Story ended", false);
      else bridge.respondSynthetic([`The story does not understand “${entered.trim()}” yet. Try LOOK or HELP.`]);
    });
    runtimeRef.current = { bridge, vm: null, storyBuffer: null, storyName, commandHistory: [], historyIndex: -1 };
    setLoadedLabel(storyName);
    onCreateOpenChange?.(false);
    setGenerationNotice("");
    onStoryLoaded?.();
    rerender();
  }

  async function handleCreateStorySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const premise = storyPrompt.replace(/\s+/g, " ").trim();
    if (premise.length < 8) {
      setGenerationNotice("Add a little more detail to your story idea.");
      return;
    }
    setGenerationNotice("Opening your story…");
    try {
      const result = onCreateStory ? await onCreateStory({ premise, tone: storyTone }) : "local";
      if (result === "local") startGeneratedPreview(premise, storyTone);
      else {
        setGenerationNotice("Continue the story questions in ChatGPT.");
        onCreateOpenChange?.(false);
      }
    } catch {
      setGenerationNotice("The host could not start the story. Try again or play the local preview.");
    }
  }

  async function bootStory(buffer: ArrayBuffer, storyName: string) {
    setIsBooting(true);
    try {
      const session = await ifvmsAdapter.create(rerender);
      const bridge = session.bridge as BrowserGlkBridge;
      const vm = session.vm;
      runtimeRef.current = {
        bridge,
        vm,
        storyBuffer: buffer,
        storyName,
        commandHistory: [],
        historyIndex: -1,
      };
      setLoadedLabel(storyName);
      bridge.reset(storyName);
      bridge.attachVm(vm);
      vm.prepare(runtimeRef.current.storyBuffer, { Glk: bridge });
      vm.start();
      bridge.update();
      onStoryLoaded?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start this story.";
      runtimeRef.current = null;
      setLoadedLabel("No story loaded");
      rerender();
      alert(message);
    } finally {
      setIsBooting(false);
    }
  }

  async function startStory(file: File) {
    await bootStory(await file.arrayBuffer(), file.name);
  }

  function playSignalLock() {
    window.dispatchEvent(new CustomEvent("storyframe:signal-lock"));
  }

  async function loadSampleStory() {
    playSignalLock();
    try {
      // The ChatGPT iframe may disallow fetching data: URLs through its CSP.
      // Decode the bundled asset directly first, then fall back to fetch for
      // local preview/builds that expose it as a normal URL.
      let buffer: ArrayBuffer;
      if (sampleStoryUrl.startsWith("data:")) {
        const comma = sampleStoryUrl.indexOf(",");
        const encoded = sampleStoryUrl.slice(comma + 1);
        const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        buffer = bytes.buffer;
      } else {
        const response = await fetch(sampleStoryUrl);
        if (!response.ok) throw new Error("Unable to load the bundled sample story.");
        buffer = await response.arrayBuffer();
      }
      await bootStory(buffer, "Figaro (bundled sample)");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load the bundled sample story.");
    }
  }

  async function loadCatalogStory(story: StoryCatalogEntry) {
    if (isBooting) return;
    playSignalLock();
    setIsBooting(true);
    try {
      const response = await fetch(story.sourceUrl);
      if (!response.ok) throw new Error(`Unable to fetch ${story.title} from the story catalog.`);
      await bootStory(await response.arrayBuffer(), `${story.title} (.${story.format})`);
      setLibraryIsOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load this catalog story.");
      setIsBooting(false);
    }
  }

  async function playSelectedRemixSource() {
    if (isBooting) return;
    if (remixSource === "catalog") {
      const story = playableStoryCatalog.find((candidate) => candidate.id === remixCatalogStoryId);
      if (!story) {
        setGenerationNotice("Choose a story first.");
        return;
      }
      await loadCatalogStory(story);
      onRemixOpenChange?.(false);
      return;
    }
    if (!remixFile) {
      setGenerationNotice("Choose a local story file first.");
      return;
    }
    playSignalLock();
    await startStory(remixFile);
    onRemixOpenChange?.(false);
  }

  function restartStory() {
    const runtime = runtimeRef.current;
    if (!runtime?.storyBuffer) return;
    runtime.bridge.prepareVm(runtime.storyBuffer.slice(0), runtime.storyName);
    runtime.commandHistory = [];
    runtime.historyIndex = -1;
    runtime.bridge.update();
    rerender();
  }

  function returnToLanding() {
    const runtime = runtimeRef.current;
    runtime?.bridge.reset("No story loaded");
    runtimeRef.current = null;
    setLoadedLabel("No story loaded");
    setCommand("");
    setLibraryIsOpen(false);
    onSettingsOpenChange?.(false);
    setControlsOpen(false);
    onCreateOpenChange?.(false);
    onRemixOpenChange?.(false);
    rerender();
  }

  function openLibraryPage() {
    onSettingsOpenChange?.(false);
    setControlsOpen(false);
    onCreateOpenChange?.(false);
    onRemixOpenChange?.(false);
    setLibraryIsOpen(true);
  }

  function openControlsPage() {
    onSettingsOpenChange?.(false);
    setLibraryIsOpen(false);
    onCreateOpenChange?.(false);
    onRemixOpenChange?.(false);
    setControlsOpen(true);
  }

  function openRemixPage() {
    onSettingsOpenChange?.(false);
    setControlsOpen(false);
    setLibraryIsOpen(false);
    onCreateOpenChange?.(false);
    onRemixOpenChange?.(true);
  }

  function openCreatePage() {
    onSettingsOpenChange?.(false);
    setControlsOpen(false);
    setLibraryIsOpen(false);
    onRemixOpenChange?.(false);
    onCreateOpenChange?.(true);
  }

  function openSettingsPage() {
    setControlsOpen(false);
    setLibraryIsOpen(false);
    onCreateOpenChange?.(false);
    onRemixOpenChange?.(false);
    onSettingsOpenChange?.(true);
  }

  function handleLoadClick() {
    playSignalLock();
    fileInputRef.current?.click();
  }

  useEffect(() => {
    // The menu is rendered by the official BubbleMenu host; this retained
    // semantic contract is documented for accessibility fixtures: ariaLabel="Menu".
    const openFilePicker = () => handleLoadClick();
    const loadSample = () => { if (!isBooting) void loadSampleStory(); };
    const openCreate = () => openCreatePage();
    const openRemix = () => openRemixPage();
    const openLibrary = () => openLibraryPage();
    const openSettings = () => openSettingsPage();
    const openMenu = () => onMenuOpenChange?.(true);
    window.addEventListener("storyframe:load-file", openFilePicker);
    window.addEventListener("storyframe:load-sample", loadSample);
    window.addEventListener("storyframe:open-create", openCreate);
    window.addEventListener("storyframe:open-remix", openRemix);
    window.addEventListener("storyframe:open-library", openLibrary);
    window.addEventListener("storyframe:open-settings", openSettings);
    window.addEventListener("storyframe:open-menu", openMenu);
    return () => {
      window.removeEventListener("storyframe:load-file", openFilePicker);
      window.removeEventListener("storyframe:load-sample", loadSample);
      window.removeEventListener("storyframe:open-create", openCreate);
      window.removeEventListener("storyframe:open-remix", openRemix);
      window.removeEventListener("storyframe:open-library", openLibrary);
      window.removeEventListener("storyframe:open-settings", openSettings);
      window.removeEventListener("storyframe:open-menu", openMenu);
    };
  }, [isBooting, onCreateOpenChange, onRemixOpenChange]);

  // The host action rail lives outside the CRT card. Keep these actions
  // available to the native ChatGPT controls without painting UI over the
  // interpreter canvas.
  useEffect(() => {
    const openLibrary = () => openLibraryPage();
    const restart = () => restartStory();
    const navigateBack = () => { if (runtimeRef.current) returnToLanding(); else leavePage(); };
    const openControls = () => openControlsPage();
    window.addEventListener("storyframe:open-library", openLibrary);
    window.addEventListener("storyframe:restart", restart);
    window.addEventListener("storyframe:navigate-back", navigateBack);
    window.addEventListener("storyframe:open-controls", openControls);
    return () => {
      window.removeEventListener("storyframe:open-library", openLibrary);
      window.removeEventListener("storyframe:restart", restart);
      window.removeEventListener("storyframe:navigate-back", navigateBack);
      window.removeEventListener("storyframe:open-controls", openControls);
    };
  }, [isBooting, libraryIsOpen, settingsOpen, controlsOpen, themeLabOpen, createOpen, remixOpen, feedbackOpen]);

  function submitGamepadCommand(value: string, shortcut = value.slice(0, 1)) {
    const runtime = runtimeRef.current;
    if (!runtime || settingsOpen || controlsOpen || themeLabOpen || isBooting) return;
    const request = runtime.bridge.snapshot().request.kind;
    if (request === "char") {
      runtime.bridge.submitChar(shortcut);
      rerender();
      return;
    }
    if (request !== "line") return;
    const normalized = value.trim();
    if (!normalized) return;
    runtime.commandHistory.push(normalized);
    runtime.historyIndex = runtime.commandHistory.length;
    runtime.bridge.submitLine(normalized);
    setCommand("");
    rerender();
  }

  useEffect(() => {
    const handlePredictiveAction = (event: Event) => {
      const commandValue = (event as CustomEvent<{ command?: string }>).detail?.command;
      if (typeof commandValue === "string") submitGamepadCommand(commandValue);
    };
    window.addEventListener("storyframe:predictive-action", handlePredictiveAction);
    return () => window.removeEventListener("storyframe:predictive-action", handlePredictiveAction);
  }, [settingsOpen, controlsOpen, themeLabOpen, isBooting]);

  function handleTerminalKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (settingsOpen || controlsOpen || themeLabOpen || (event.target instanceof HTMLElement && event.target.closest("button"))) return;
    const transcriptScroll = interfaceRef.current?.querySelector<HTMLElement>(".cool-retro-scrollview");
    if (transcriptScroll && ["PageUp", "PageDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const amount = Math.max(80, transcriptScroll.clientHeight * 0.82);
      if (event.key === "PageUp") transcriptScroll.scrollTop -= amount;
      if (event.key === "PageDown") transcriptScroll.scrollTop += amount;
      if (event.key === "Home") transcriptScroll.scrollTop = 0;
      if (event.key === "End") transcriptScroll.scrollTop = transcriptScroll.scrollHeight;
      return;
    }
    const runtime = runtimeRef.current;
    const request = runtime?.bridge.snapshot().request.kind;
    if (!runtime) {
      if (event.key === "1") { event.preventDefault(); onCreateOpenChange?.(true); }
      else if (event.key === "2") { event.preventDefault(); onRemixOpenChange?.(true); }
      else if (event.key === "3") { event.preventDefault(); handleLoadClick(); }
      return;
    }

    if (request === "char") {
      if (event.key.length === 1 || event.key === "Enter" || event.key === "Escape" || event.key.startsWith("Arrow")) {
        event.preventDefault();
        runtime.bridge.submitChar(event.key);
        rerender();
      }
      return;
    }

    if (request !== "line") return;
    if (event.key === "Enter") {
      // Keep keyboard input resilient if a malformed story or restored state
      // ever supplies an undefined command value.
      const text = typeof command === "string" ? command.trim() : "";
      if (!text) return;
      event.preventDefault();
      runtime.commandHistory.push(text);
      runtime.historyIndex = runtime.commandHistory.length;
      runtime.bridge.submitLine(text);
      setCommand("");
      rerender();
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      setCommand((current) => current.slice(0, -1));
      return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      setCommand((current) => current + event.key);
      return;
    }

    if (event.key === "ArrowUp" && runtime.commandHistory.length) {
      event.preventDefault();
      runtime.historyIndex = Math.max(0, runtime.historyIndex - 1);
      setCommand(runtime.commandHistory[runtime.historyIndex] ?? "");
      return;
    }
    if (event.key === "ArrowDown" && runtime.commandHistory.length) {
      event.preventDefault();
      runtime.historyIndex = Math.min(runtime.commandHistory.length, runtime.historyIndex + 1);
      setCommand(runtime.commandHistory[runtime.historyIndex] ?? "");
      return;
    }
  }

  // The renderer is intentionally pointer-transparent, but focus can still be
  // claimed by the host when the player clicks or tabs around the widget. Keep
  // the terminal keyboard-first by accepting gameplay keys at the window level
  // whenever focus is outside a native control.
  useEffect(() => {
    const handleGlobalTerminalKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen || controlsOpen || themeLabOpen || createOpen || remixOpen) return;
      const target = event.target;
      // Gameplay is keyboard-first. The scroll layer may retain focus after
      // paging through history, so do not exclude elements merely because
      // they live inside the monitor. Only native controls keep their own
      // keyboard behavior.
      if (target instanceof HTMLElement && target.closest("button, input, textarea, select")) return;
      handleTerminalKeyDown(event as unknown as React.KeyboardEvent<HTMLDivElement>);
    };
    window.addEventListener("keydown", handleGlobalTerminalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalTerminalKeyDown);
  }, [settingsOpen, controlsOpen, themeLabOpen, createOpen, remixOpen, command]);

  function renderTranscriptLine(entry: TranscriptEntry) {
    const className = `transcript-line kind-${entry.kind}`;
    return <p key={entry.id} className={className}>{entry.text || "\u00A0"}</p>;
  }

  const statusLabel = snapshot.request.kind === "idle"
    ? "Ready"
    : snapshot.request.kind === "file"
      ? "Waiting for file prompt"
      : snapshot.request.prompt;

  const transcriptLines = snapshot.transcript.map((entry) => entry.text);
  // The Z-machine normally emits its own empty prompt before requesting line
  // input. The renderer owns the active prompt while the player is typing, so
  // discard that trailing prompt to avoid showing two stacked `>` lines.
  if (snapshot.request.kind === "line") {
    while (transcriptLines.length && /^\s*>\s*$/.test(transcriptLines.at(-1) ?? "")) transcriptLines.pop();
  }
  // The supplied dot-matrix artwork is rendered as a phosphor-colored mask
  // over the WebGL glass so its exact character spacing and antialiasing are
  // preserved instead of being substituted by the renderer's ASCII font atlas.
  const landingLines: string[] = [];
  // Give the active keyboard input its own terminal row immediately. An empty
  // command intentionally leaves the last string empty: `join("\n")` then
  // ends with a carriage return, so the WebGL cursor blinks at column zero on
  // the next row before the player types the first character. The renderer
  // cursor is the prompt, so no duplicate `>` marker is needed on that row.
  const rawRendererLines = snapshot.transcript.length
    ? [...transcriptLines, ...(snapshot.request.kind === "line" ? [command] : snapshot.request.kind === "char" ? ["[press a key]" ] : [])]
    : landingLines;
  // Keep a small clear area at the bottom of the terminal so the final story
  // lines remain readable while the focused keyboard-only surface is active.
  // Pass the complete transcript to the renderer.  The cool-retro-term
  // viewport is responsible for showing the newest rows, just like xterm's
  // active viewport follows the bottom when new output arrives.
  const rendererText = rawRendererLines.join("\n");
  const rendererCursor = {
    visible: snapshot.transcript.length > 0 && !settingsOpen && !controlsOpen && !themeLabOpen && !libraryIsOpen && !createOpen && !remixOpen && (snapshot.request.kind === "line" || snapshot.request.kind === "char"),
    blinking: snapshot.transcript.length > 0 && !settingsOpen && !controlsOpen && !themeLabOpen && !libraryIsOpen && !createOpen && !remixOpen && (snapshot.request.kind === "line" || snapshot.request.kind === "char"),
  };
  const settingsText = [
    "LORESIGHT SETTINGS",
    "",
    `THEME: ${crtProfile.name}`,
    `COLOR: ${crtProfile.ink}`,
    `BACKGROUND: ${crtProfile.paper}`,
    `BRIGHTNESS: ${rendererEffects.brightness.toFixed(2)}`,
    `CURVE: ${rendererEffects.curvature.toFixed(2)}`,
    `BLOOM: ${rendererEffects.bloom.toFixed(2)}`,
    `FLICKER: ${rendererEffects.flickering.toFixed(2)}`,
    "",
    "Use the controls below to adjust the display.",
  ].join("\n");
  // Navigation lives in the host/top bar. Keep the WebGL transcript free of
  // synthetic UI rows so the active prompt and cursor can use the full glass.
  const rendererDisplayText = settingsOpen
    ? settingsText
    : createOpen
        ? "LORESIGHT / CREATE\n\nSTART WITH AN IDEA\nDescribe a place, a problem, or a strange\nquestion you would like to explore.\n\n>"
    : remixOpen
        ? "LORESIGHT / REMIX\n\nUSE A SOURCE STORY\nChoose a catalog story or load a local\nZ-machine file, then describe your twist.\n\n>"
    : libraryIsOpen
        ? "STORY LIBRARY\nChoose a story to play."
    : themeLabOpen
        ? "THEME LAB\nAdjust each profile, then commit all themes."
        : rendererText;

  return (
    <div ref={interfaceRef} className={`classic-if-interface${settingsOpen ? " has-settings" : controlsOpen ? " has-controls" : libraryIsOpen ? " has-library" : createOpen ? " has-create" : remixOpen ? " has-remix" : menuOpen ? " has-menu" : themeLabOpen ? " has-theme-lab" : snapshot.transcript.length ? " has-runtime" : " is-loading"}`} tabIndex={0} onPointerDown={() => interfaceRef.current?.focus()}>
      <header className="classic-if-header">
        <div>
          <p className="world-kicker">Interactive fiction</p>
          <h1>Z-machine terminal</h1>
        </div>
      </header>

      <p className="classic-if-intro">
        Load a local <code>.z3</code>, <code>.z5</code>, <code>.z8</code>, or <code>.zblorb</code> file, then type commands at the prompt.
      </p>

      <div className="classic-if-status" aria-live="polite">
        <span>{statusLabel}</span>
        <strong>{snapshot.storyName}</strong>
        <small>{snapshot.statusLine || `${snapshot.lineCount} lines`}</small>
      </div>

      <div className="classic-if-terminal has-webgl-renderer" aria-label="Z-machine transcript">
        <CoolRetroRenderer
          effects={rendererEffects}
          color={crtTheme}
          palette={crtProfile}
          text={rendererDisplayText}
          cursor={settingsOpen || controlsOpen || themeLabOpen || libraryIsOpen ? { visible: false, blinking: false } : rendererCursor}
          onScrollInteraction={() => interfaceRef.current?.focus()}
          scrollEnabled={!settingsOpen && !controlsOpen && !themeLabOpen && !libraryIsOpen}
          layoutMode={isFullscreen ? "fullscreen" : "inline"}
          followOutput={!settingsOpen && !controlsOpen && !themeLabOpen && !libraryIsOpen}
          centerContent={!snapshot.transcript.length && !settingsOpen && !controlsOpen && !themeLabOpen && !libraryIsOpen && !createOpen && !remixOpen}
        />
        {!snapshot.transcript.length && !settingsOpen && !controlsOpen && !themeLabOpen && !libraryIsOpen && !createOpen && !remixOpen ? <div className="ascii-art-logo" role="img" aria-label="LoreSight" style={{ "--ascii-mask": `url(${asciiArtMask})` } as React.CSSProperties} /> : null}
        {!snapshot.transcript.length && !createOpen && !remixOpen ? <div className="classic-empty-state" aria-hidden="true" /> : null}
        {snapshot.transcript.map(renderTranscriptLine)}
      </div>

      {settingsOpen && !feedbackOpen ? (
        <CrtPageOverlay className="crt-settings-page" ariaLabel="Settings">
          <div className="crt-page-heading"><div className="crt-settings-heading"><strong>Settings</strong><span>Display and theme</span></div></div>
          <label className="crt-theme-select"><span>Theme</span><select aria-label="Screen theme" value={crtTheme} onChange={(event) => selectTheme(event.target.value as CrtThemeId)}>{themeLabIds.map((themeId) => <option key={themeId} value={themeId}>{getCrtTheme(themeId).name}</option>)}</select></label>
          <div className="crt-settings-sliders" aria-label={`${crtProfile.name} display settings`}>
            {themeLabFields.map((field) => {
              const value = Number(rendererEffects[field.key] ?? 0);
              const applyValue = (event: React.FormEvent<HTMLInputElement>) => updateActiveThemeEffect(field.key, Number(event.currentTarget.value));
              return <label key={field.key}><span>{field.label}</span><input type="range" min={field.min} max={field.max} step={field.step} value={value} onInput={applyValue} onChange={applyValue} /><output>{value.toFixed(field.step < .01 ? 3 : 2)}</output></label>;
            })}
          </div>
          <div className="crt-settings-actions">
            <button type="button" className={`crt-settings-save${rendererLocked ? " is-locked" : ""}`} onClick={saveActiveTheme}>{rendererLocked ? "Saved appearance" : "Save appearance"}</button>
            <button type="button" className="crt-settings-save crt-feedback-launch" onClick={() => { setFeedbackOpen(true); setFeedbackStatus("idle"); recordDiagnostic("feedback.opened", "Feedback form opened"); }}>Send feedback</button>
          </div>
        </CrtPageOverlay>
      ) : null}

      {settingsOpen && feedbackOpen ? (
        <CrtPageOverlay className="crt-feedback-page" ariaLabel="Send feedback">
          <div className="crt-page-heading"><div className="crt-settings-heading"><strong>Send feedback</strong><span>Tell us what happened</span></div></div>
          {feedbackStatus === "sent" ? (
            <div className="crt-feedback-success" role="status">
              <strong>Feedback sent</strong>
              <p>Thank you. Your report reached the LoreSight team.</p>
              <button type="button" className="crt-settings-save" onClick={() => { setFeedbackOpen(false); setFeedbackStatus("idle"); }}>Back to Settings</button>
            </div>
          ) : (
            <form className="crt-feedback-form" onSubmit={submitFeedback}>
              <label><span>Type</span><select value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value)}><option value="bug">Something broke</option><option value="idea">I have an idea</option><option value="other">Something else</option></select></label>
              <label><span>What happened?</span><textarea required minLength={10} maxLength={4000} rows={5} value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} placeholder="Tell us what you expected and what happened instead." /></label>
              <label><span>Email (optional)</span><input type="email" maxLength={320} autoComplete="email" value={feedbackContact} onChange={(event) => setFeedbackContact(event.target.value)} placeholder="you@example.com" /></label>
              <label className="crt-feedback-diagnostics"><input type="checkbox" checked={attachDiagnostics} onChange={(event) => setAttachDiagnostics(event.target.checked)} /><span>Attach {diagnosticEntryCount()} safe diagnostic entries</span></label>
              <p className="crt-feedback-privacy">Safe app errors only. Never includes story text, commands, form content, passwords, tokens, or URL query data.</p>
              {feedbackStatus === "error" ? <p className="crt-feedback-error" role="alert">{feedbackError}</p> : null}
              <div className="crt-feedback-actions"><button type="submit" className="crt-settings-save" disabled={feedbackStatus === "sending" || feedbackMessage.trim().length < 10}>{feedbackStatus === "sending" ? "Sending…" : "Send feedback"}</button><button type="button" className="crt-settings-save" onClick={() => setFeedbackOpen(false)}>Cancel</button></div>
            </form>
          )}
        </CrtPageOverlay>
      ) : null}

      {controlsOpen ? (
        <CrtPageOverlay className="crt-controls-page" ariaLabel="Controls">
          <div className="crt-page-heading"><div className="crt-settings-heading"><strong>Controls</strong><span>Keyboard + touch reference</span></div></div>
          <p className="crt-controls-lead">Tap a key below to send the same command you would type at the story prompt.</p>
          <div className="crt-controls-section">
            <h3>Movement</h3>
            <div className="crt-controls-table">
              {[["N / S", "north / south"], ["E / W", "east / west"], ["NE / NW / SE / SW", "diagonal movement"], ["U / D", "up / down"], ["IN / OUT", "enter or leave"]].map(([key, description]) => <div key={key}><kbd>{key}</kbd><span>{description}</span></div>)}
            </div>
          </div>
          <div className="crt-controls-section">
            <h3>Observe</h3>
            <div className="crt-controls-table">
              {[["L / LOOK", "repeat the room description"], ["X / EXAMINE", "inspect an object or character"], ["I / INVENTORY", "show what you carry"], ["SEARCH", "look inside or underneath"]].map(([key, description]) => <div key={key}><kbd>{key}</kbd><span>{description}</span></div>)}
            </div>
          </div>
          <div className="crt-controls-section">
            <h3>Items</h3>
            <div className="crt-controls-table">
              {[["TAKE / GET", "pick up an item"], ["DROP", "discard an item"], ["OPEN / CLOSE", "use a door or container"], ["LOCK / UNLOCK", "secure or open a barrier"], ["PUT IN / ON", "place an item"]].map(([key, description]) => <div key={key}><kbd>{key}</kbd><span>{description}</span></div>)}
            </div>
          </div>
          <div className="crt-controls-section">
            <h3>Keyboard</h3>
            <div className="crt-controls-table">
              {[ ["ENTER", "submit the current command"], ["BACKSPACE", "erase the current line"], ["ARROW UP / DOWN", "recall previous commands"], ["PAGE UP / DOWN", "read earlier story history"]].map(([key, description]) => <div key={key}><kbd>{key}</kbd><span>{description}</span></div>)}
            </div>
          </div>
        </CrtPageOverlay>
      ) : null}

      {createOpen ? (
        <CrtPageOverlay className="crt-create-page" ariaLabel="Create a new story">
          <div className="crt-page-heading"><div className="crt-settings-heading"><strong>Create new story</strong><span>Start from an idea</span></div></div>
          <form className="crt-story-form" onSubmit={handleCreateStorySubmit}>
            <label><span>What should the story be about?</span><textarea required minLength={8} maxLength={500} value={storyPrompt} onChange={(event) => { setStoryPrompt(event.target.value); setGenerationNotice(""); }} placeholder="A lighthouse that remembers every visitor..." rows={4} /></label>
            <label><span>Tone</span><select value={storyTone} onChange={(event) => setStoryTone(event.target.value)}><option value="mysterious">Mysterious</option><option value="adventurous">Adventurous</option><option value="quiet">Quiet and strange</option><option value="comic">Wry and comic</option></select></label>
            <button type="submit" className="crt-settings-save">{generationNotice || "Start story"}</button>
          </form>
        </CrtPageOverlay>
      ) : null}

      {remixOpen ? (
        <CrtPageOverlay className="crt-remix-page" ariaLabel="Remix a story">
          <div className="crt-page-heading"><div className="crt-settings-heading"><strong>Remix a story</strong><span>Play the original or describe a new version</span></div></div>
          <form className="crt-story-form" onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.requestSubmit(); }} onSubmit={(event) => { event.preventDefault(); const catalogStory = playableStoryCatalog.find((story) => story.id === remixCatalogStoryId); if (remixSource === "catalog" && !catalogStory) { setGenerationNotice("Choose a source story first."); return; } if (remixSource === "upload") { setGenerationNotice("Uploaded stories can be played here. Catalog stories can also begin a guided ChatGPT remix."); return; } setGenerationNotice("Opening the remix questions in ChatGPT…"); window.dispatchEvent(new CustomEvent("loresight:remix-story", { detail: { prompt: remixPrompt, source: remixSource, storyId: catalogStory?.id ?? null, title: catalogStory?.title ?? null, format: catalogStory?.format ?? null, sourceUrl: catalogStory?.sourceUrl ?? null, fileName: remixFile?.name ?? null } })); }}>
            <label><span>1. Choose a source</span><select aria-label="Source" value={remixSource} onChange={(event) => { setRemixSource(event.target.value as "catalog" | "upload"); setRemixFile(null); setGenerationNotice(""); }}><option value="catalog">Story library</option><option value="upload">Local Z-machine file</option></select></label>
            {remixSource === "catalog" ? <label><span>2. Choose a story</span><select aria-label="Story to remix" value={remixCatalogStoryId} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void playSelectedRemixSource(); } }} onChange={(event) => { setRemixCatalogStoryId(event.target.value); setGenerationNotice(""); }}><option value="" disabled>Select a story</option>{playableStoryCatalog.map((story) => <option key={story.id} value={story.id}>{story.title} · .{story.format}</option>)}</select></label> : null}
            {remixSource === "upload" ? <label className="crt-file-choice"><span>2. Choose a story file</span><input type="file" accept=".z3,.z4,.z5,.z8,.zblorb,.blorb,.blb,application/octet-stream" onChange={(event) => { setRemixFile(event.currentTarget.files?.[0] ?? null); setGenerationNotice(""); }} /><small>{remixFile ? `Selected: ${remixFile.name}` : "Accepted: .z3, .z4, .z5, .z8, .zblorb, .blorb"}</small></label> : null}
            <label><span>3. What should change?</span><textarea aria-describedby="remix-prompt-help" value={remixPrompt} onChange={(event) => { setRemixPrompt(event.target.value); setGenerationNotice(""); }} placeholder="Keep the setting, but make the missing room reachable..." rows={3} /><small id="remix-prompt-help">Optional. Press Command/Control + Return to create the remix.</small></label>
            <div className="crt-story-form-actions">
              <button type="button" className="crt-settings-save crt-story-secondary" onClick={() => void playSelectedRemixSource()} disabled={isBooting || (remixSource === "upload" && !remixFile) || (remixSource === "catalog" && !remixCatalogStoryId)}>{isBooting ? "Starting…" : "Play original"}</button>
              <button type="submit" className="crt-settings-save" disabled={isBooting || remixSource === "upload" || !remixCatalogStoryId}>Create remix</button>
            </div>
            {generationNotice ? <p className="crt-form-notice" role="status">{generationNotice}</p> : null}
          </form>
        </CrtPageOverlay>
      ) : null}

      {isFullscreen && snapshot.loaded && !settingsOpen && !controlsOpen && !themeLabOpen ? (
        <section className="crt-gamepad" aria-label="Interactive fiction gamepad">
          <div className="crt-gamepad-group crt-gamepad-direction">
            <h2>Move</h2>
            <div className="crt-gamepad-grid">
              {[["NW", "northwest"], ["N", "north"], ["NE", "northeast"], ["W", "west"], ["L", "look", "l"], ["E", "east"], ["SW", "southwest"], ["S", "south"], ["SE", "southeast"]].map(([label, command, shortcut]) => <button key={label} type="button" onClick={() => submitGamepadCommand(command, shortcut ?? command.slice(0, 1))}><span>{label}</span></button>)}
            </div>
            <div className="crt-gamepad-aux"><button type="button" onClick={() => submitGamepadCommand("up", "u")}>U</button><button type="button" onClick={() => submitGamepadCommand("down", "d")}>D</button><button type="button" onClick={() => submitGamepadCommand("in", "i")}>IN</button><button type="button" onClick={() => submitGamepadCommand("out", "o")}>OUT</button></div>
          </div>
          <div className="crt-gamepad-group crt-gamepad-actions">
            <h2>Actions</h2>
            <div className="crt-gamepad-action-grid">
              {[["EXAMINE", "examine", "x"], ["INVENTORY", "inventory", "i"], ["TAKE / GET", "take", "t"], ["DROP", "drop", "d"], ["SEARCH", "search", "s"], ["OPEN", "open", "o"], ["CLOSE", "close", "c"], ["LOCK", "lock", "l"], ["UNLOCK", "unlock", "u"], ["PUT IN / ON", "put", "p"]].map(([label, command, shortcut]) => <button key={label} type="button" onClick={() => submitGamepadCommand(command, shortcut)}>{label}</button>)}
            </div>
          </div>
        </section>
      ) : null}

      {themeLabOpen ? (
        <CrtPageOverlay className="crt-theme-lab-page" ariaLabel="Theme lab">
          <div className="crt-settings-heading"><strong>Theme lab</strong><span /></div>
          <div className="crt-theme-lab-grid">
            {themeLabIds.map((themeId) => {
              const draft = themeLabDrafts[themeId];
              const theme = getCrtTheme(themeId);
              return <article key={themeId} className="crt-theme-lab-card" style={{ "--lab-ink": theme.ink } as React.CSSProperties}>
                <h3><i />{theme.name}</h3>
                {themeLabFields.map((field) => { const applyValue = (event: React.FormEvent<HTMLInputElement>) => setThemeLabDrafts((current) => ({ ...current, [themeId]: { ...current[themeId], [field.key]: Number(event.currentTarget.value) } })); return <label key={field.key}><span>{field.label}</span><input type="range" min={field.min} max={field.max} step={field.step} value={draft[field.key] ?? 0} onInput={applyValue} onChange={applyValue} /><output>{Number(draft[field.key] ?? 0).toFixed(field.step < .01 ? 3 : 2)}</output></label>; })}
              </article>;
            })}
          </div>
          <button type="button" className="crt-settings-save" onClick={commitThemeLab}>Commit all themes</button>
        </CrtPageOverlay>
      ) : null}

      {libraryIsOpen ? (
        <CrtPageOverlay className="crt-library-page" ariaLabel="Story library">
          <div className="crt-page-heading"><h1 className="story-library-heading">Story library</h1></div>
          <div className="story-library-list">
            {playableStoryCatalog.map((story) => (
              <button key={story.id} type="button" className="story-library-item" onClick={() => void loadCatalogStory(story)} disabled={isBooting}>
                <span>{story.title}</span><small>.{story.format}</small>
              </button>
            ))}
          </div>
        </CrtPageOverlay>
      ) : null}

      <div className="classic-if-footer">
        <span>Type directly on the keyboard. Enter submits a line; single-key prompts accept one key.</span>
      </div>

      <details className="classic-if-debug">
        <summary>Debug view</summary>
        <div>
          <p><strong>Loaded:</strong> {String(snapshot.loaded)}</p>
          <p><strong>Version:</strong> {snapshot.version ?? "unknown"}</p>
          <p><strong>Request:</strong> {snapshot.request.kind}</p>
          <p><strong>Last command:</strong> {snapshot.lastCommand || "—"}</p>
          <p><strong>Error:</strong> {snapshot.error || "—"}</p>
        </div>
      </details>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".z3,.z4,.z5,.z8,.zblorb,.blorb,.blb,application/octet-stream"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void startStory(file);
        }}
      />
    </div>
  );
}

export const classicIfFrame: PlayerFrameView = {
  kind: "default-crt",
};

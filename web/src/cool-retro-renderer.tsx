import { useEffect, useRef, useState } from "react";
import type { UIEvent, WheelEvent } from "react";
import * as THREE from "three";
import { TerminalText } from "cool-retro-term-renderer";
import type { CrtThemeId } from "./crt-themes";

type CoolRetroRendererProps = {
  text: string;
  color: CrtThemeId;
  effects: RendererEffects;
  palette?: { ink: string; paper: string };
  cursor?: { visible: boolean; blinking?: boolean };
  onScrollInteraction?: () => void;
  scrollEnabled?: boolean;
  layoutMode?: "inline" | "fullscreen";
  followOutput?: boolean;
  centerContent?: boolean;
};

export type RendererEffects = {
  curvature: number;
  bloom: number;
  brightness: number;
  flickering: number;
  ambientLight: number;
  rgbShift: number;
  horizontalSync: number;
  jitter: number;
  staticNoise: number;
  burnIn: number;
  chromaColor: number;
  glowingLine: number;
  rasterizationMode: number;
  rasterizationIntensity: number;
  scale: number;
  /** cool-retro-term profile values not exposed by the package setters. */
  contrast?: number;
  saturationColor?: number;
  windowOpacity?: number;
};

export const defaultRendererEffects: RendererEffects = {
  curvature: 0.09,
  bloom: 0.25,
  brightness: 0.5,
  flickering: 0.015,
  ambientLight: 0.67,
  rgbShift: 0,
  horizontalSync: 0,
  jitter: 0.27,
  burnIn: 0,
  staticNoise: 0.18,
  chromaColor: 0,
  glowingLine: 0.22,
  rasterizationMode: 0,
  rasterizationIntensity: 0.79,
  scale: 0.33,
  contrast: 0.85,
  saturationColor: 0,
  windowOpacity: 1,
};

/**
 * cool-retro-term's XTerm connector paints the active xterm viewport rather
 * than the entire scrollback buffer. LoreSight keeps the WebGL surface fixed
 * and uses a transparent DOM scroll track to select which rows are painted
 * into that viewport.
 */
function wrappedLines(text: string, columns: number): string[] {
  const width = Math.max(12, columns);
  return text.split("\n").flatMap((line) => {
    if (line.length <= width) return [line];
    const words = line.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (!current) { current = word; continue; }
      if ((current.length + 1 + word.length) <= width) current += ` ${word}`;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  });
}

function fitViewport(text: string, terminal: TerminalText, scrollTop: number, rowHeight: number, centerContent = false): { text: string; cursorRow: number; cursorCol: number; totalRows: number } {
  const grid = terminal.getGridSize();
  const lines = wrappedLines(text, grid.cols);
  // TerminalText keeps a small bottom margin for its phosphor pass. Reserve
  // Use the full measured grid. The renderer's own glyph baseline handles its
  // final row; reserving extra rows creates a visible dark strip over the CLI.
  const rows = Math.max(1, grid.rows);
  const topPadding = centerContent && lines.length < rows ? Math.floor((rows - lines.length) / 2) : 0;
  const centeredLines = topPadding ? [...Array.from({ length: topPadding }, () => ""), ...lines] : lines;
  const start = Math.max(0, Math.min(Math.max(0, centeredLines.length - rows), Math.floor(scrollTop / Math.max(1, rowHeight))));
  const visibleLines = centeredLines.slice(start, start + rows);
  return {
    text: visibleLines.join("\n"),
    cursorRow: Math.max(0, visibleLines.length - 1),
    cursorCol: visibleLines.at(-1)?.length ?? 0,
    totalRows: centeredLines.length,
  };
}

const colors = {
  // Values from the package README's documented Green and Amber profiles.
  orange: { ink: "#ffb000", paper: "#000000" },
  green: { ink: "#0ccc68", paper: "#000000" },
  // The package has no named blue preset; this uses its public setFontColor API.
  blue: { ink: "#00aaff", paper: "#000000" },
} as const;

// Fullscreen uses the same saved theme profile as inline mode. These are
// presentation multipliers only: they compensate for the taller viewport so
// the curved shader does not push a reflected/black edge into the readable
// area, while keeping glyphs legible at the larger size.
const FULLSCREEN_RENDERER_MULTIPLIERS = {
  glyphScale: 1.18,
  curvature: 0.62,
} as const;

/** Optional WebGL presentation layer. The DOM transcript remains in the tree for accessibility and fallback. */
export function CoolRetroRenderer({ text, color, effects, palette: suppliedPalette, cursor = { visible: false, blinking: false }, onScrollInteraction, scrollEnabled = true, layoutMode = "inline", followOutput = true, centerContent = false }: CoolRetroRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<TerminalText | null>(null);
  const textValueRef = useRef(text);
  const renderViewportRef = useRef<(scrollTop: number) => void>(() => undefined);
  const rowHeightRef = useRef(16);
  const scrollTopRef = useRef(0);
  const maxScrollRef = useRef(0);
  const [scrollModel, setScrollModel] = useState({ height: 1, rowHeight: 16 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof window === "undefined" || !window.WebGLRenderingContext) return;

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    host.style.opacity = String(effects.windowOpacity ?? 1);
    // The WebGL package exposes chromaColor for colorfulness. Its separate
    // saturationColor value is used while deriving the phosphor background,
    // so do not apply it as a CSS grayscale/saturation filter.
    host.style.filter = `contrast(${effects.contrast ?? 1})`;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    // Keep the transparent scroll view mounted above the WebGL canvas. Using
    // replaceChildren here removes that scroll view and leaves its React ref
    // pointing at a detached element, which makes in-glass scrolling appear
    // completely inert.
    host.querySelector("canvas")?.remove();
    host.append(renderer.domElement);

    const scene = new THREE.Scene();
    // Keep the terminal's orthographic framing (the glass is a 2D surface),
    // but place the camera at a predictable depth so future layered effects
    // can use the same scene depth without changing the visible scale.
    const CAMERA_DISTANCE = 15;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, CAMERA_DISTANCE + 10);
    camera.position.z = CAMERA_DISTANCE;
    const terminal = new TerminalText(width, height);
    const fullscreen = layoutMode === "fullscreen";
    const effectiveScale = Math.min(1, effects.scale * (fullscreen ? FULLSCREEN_RENDERER_MULTIPLIERS.glyphScale : 1));
    const effectiveCurvature = Math.max(0, effects.curvature * (fullscreen ? FULLSCREEN_RENDERER_MULTIPLIERS.curvature : 1));
    terminal.mesh.position.z = 0;
    scene.add(terminal.mesh);
    const palette = suppliedPalette ?? colors[color as keyof typeof colors] ?? colors.orange;
    terminal.setFontColor(palette.ink);
    terminal.setBackgroundColor(palette.paper);
    terminal.setScreenCurvature(effectiveCurvature);
    terminal.setBloom(effects.bloom);
    terminal.setBrightness(effects.brightness);
    terminal.setFlickering(effects.flickering);
    terminal.setAmbientLight(effects.ambientLight);
    terminal.setRgbShift(effects.rgbShift);
    terminal.setHorizontalSync(effects.horizontalSync);
    terminal.setJitter(effects.jitter);
    terminal.setBurnIn(effects.burnIn);
    terminal.setChromaColor(effects.chromaColor);
    terminal.setStaticNoise(effects.staticNoise);
    terminal.setGlowingLine(effects.glowingLine);
    terminal.setRasterizationMode(effects.rasterizationMode);
    terminal.setRasterizationIntensity(effects.rasterizationIntensity);
    // Keep the canvas full size while reducing the package's fixed 12px glyphs.
    // The package's default terminal margin is intended for a standalone
    // window. LoreSight already has the physical black bezel as its mask, so
    // retaining that margin creates the visible top/bottom inset inside the
    // glass.
    const internals = terminal as unknown as { screenScaling: number; totalMargin: number; calculateFontMetrics: () => void; render: () => void };
    internals.screenScaling *= effectiveScale;
    internals.totalMargin = 0;
    internals.calculateFontMetrics();
    internals.render();
    const rowHeight = height / Math.max(1, terminal.getGridSize().rows);
    rowHeightRef.current = rowHeight;
    const updateViewport = (scrollTop: number) => {
      const currentRowHeight = rowHeightRef.current;
      const viewport = fitViewport(textValueRef.current, terminal, scrollTop, currentRowHeight, centerContent);
      terminal.setText(viewport.text);
      terminal.setCursorPosition(viewport.cursorCol, viewport.cursorRow);
      const currentHeight = host.clientHeight;
      const contentHeight = Math.max(currentHeight, viewport.totalRows * currentRowHeight);
      maxScrollRef.current = Math.max(0, contentHeight - Math.max(1, currentHeight - currentRowHeight));
      setScrollModel({ height: contentHeight, rowHeight: currentRowHeight });
    };
    renderViewportRef.current = updateViewport;
    updateViewport(0);
    terminal.setCursorVisible(cursor.visible);
    terminal.setCursorBlinking(Boolean(cursor.blinking && cursor.visible));
    textRef.current = terminal;

    let frame = 0;
    const render = (time: number) => {
      terminal.updateTime(time);
      terminal.renderStaticPass(renderer);
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);

    const resize = () => {
      const nextWidth = Math.max(1, host.clientWidth);
      const nextHeight = Math.max(1, host.clientHeight);
      renderer.setSize(nextWidth, nextHeight, false);
      terminal.updateSize(nextWidth, nextHeight);
      const nextRowHeight = nextHeight / Math.max(1, terminal.getGridSize().rows);
      rowHeightRef.current = nextRowHeight;
      const lines = wrappedLines(textValueRef.current, terminal.getGridSize().cols);
      const contentHeight = Math.max(nextHeight, lines.length * nextRowHeight);
      maxScrollRef.current = Math.max(0, contentHeight - Math.max(1, nextHeight - nextRowHeight));
      setScrollModel({ height: contentHeight, rowHeight: nextRowHeight });
      renderViewportRef.current(scrollRef.current?.scrollTop ?? 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      terminal.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      textRef.current = null;
    };
  }, [color, effects, suppliedPalette, layoutMode, centerContent]);

  useEffect(() => {
    textValueRef.current = text;
    const scroll = scrollRef.current;
    const wasAtBottom = followOutput && (!scroll || scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < Math.max(24, rowHeightRef.current * 1.5));
    const update = () => {
      if (!scroll) return;
      const terminal = textRef.current;
      if (!terminal) return;
      const lines = wrappedLines(text, terminal.getGridSize().cols);
      const rowHeight = rowHeightRef.current;
      const contentHeight = Math.max(scroll.clientHeight, lines.length * rowHeight);
      maxScrollRef.current = Math.max(0, contentHeight - Math.max(1, scroll.clientHeight - rowHeight));
      setScrollModel({ height: contentHeight, rowHeight });
      // The spacer height is committed by React after this callback. Defer
      // the bottom snap one more frame so scrollHeight includes the newly
      // appended rows; otherwise the viewport can stop one prompt short.
      requestAnimationFrame(() => {
        if (!scroll.isConnected) return;
        const maxScroll = maxScrollRef.current;
        scrollTopRef.current = wasAtBottom ? maxScroll : 0;
        scroll.scrollTop = scrollTopRef.current;
        renderViewportRef.current(scrollTopRef.current);
      });
    };
    requestAnimationFrame(update);
  }, [text, followOutput]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const captureWheel = (event: globalThis.WheelEvent) => {
      if (!scrollEnabled || !maxScrollRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      scrollTopRef.current = Math.max(0, Math.min(maxScrollRef.current, scrollTopRef.current + event.deltaY));
      if (scrollRef.current) scrollRef.current.scrollTop = scrollTopRef.current;
      renderViewportRef.current(scrollTopRef.current);
      onScrollInteraction?.();
    };
    // Listen on the widget window as well. Some embedded browser hosts route
    // wheel events around absolutely positioned descendants, so the window
    // listener is the reliable fallback for a pointer over the glass.
    const captureWindowWheel = (event: globalThis.WheelEvent) => {
      const rect = host.getBoundingClientRect();
      const targetInside = event.target instanceof Node && host.contains(event.target);
      const inside = targetInside || (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom);
      if (!inside || !maxScrollRef.current) return;
      if (!scrollEnabled) return;
      captureWheel(event);
    };
    host.addEventListener("wheel", captureWheel, { passive: false });
    window.addEventListener("wheel", captureWindowWheel, { passive: false });
    return () => {
      host.removeEventListener("wheel", captureWheel);
      window.removeEventListener("wheel", captureWindowWheel);
    };
  }, [onScrollInteraction, scrollEnabled]);

  useEffect(() => {
    const terminal = textRef.current;
    if (terminal) {
      terminal.setCursorVisible(cursor.visible);
      terminal.setCursorBlinking(Boolean(cursor.blinking && cursor.visible));
    }
  }, [cursor.visible, cursor.blinking]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = Math.max(0, Math.min(maxScrollRef.current, event.currentTarget.scrollTop));
    renderViewportRef.current(scrollTopRef.current);
    onScrollInteraction?.();
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    // Keep the monitor fixed while routing wheel movement into the in-glass
    // transcript viewport. This also works when the pointer is over the WebGL
    // canvas rather than directly over the transparent scroll track.
    event.preventDefault();
    scrollTopRef.current = Math.max(0, Math.min(maxScrollRef.current, scrollTopRef.current + event.deltaY));
    scroll.scrollTop = scrollTopRef.current;
    renderViewportRef.current(scrollTopRef.current);
    onScrollInteraction?.();
  };

  return (
    <div ref={hostRef} className="cool-retro-renderer" onWheel={handleWheel}>
      <div ref={scrollRef} className="cool-retro-scrollview" onScroll={handleScroll} aria-label="Story transcript scroll area">
        <div className="cool-retro-scroll-spacer" style={{ height: `${scrollModel.height}px` }} />
      </div>
    </div>
  );
}

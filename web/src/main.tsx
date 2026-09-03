import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import BubbleMenu from "./react-bits/BubbleMenu/BubbleMenu";
import { ArrowLeft } from "pixelarticons/react/ArrowLeft";
import { Expand } from "pixelarticons/react/Expand";
import "@openai/apps-sdk-ui/css";
import { ClassicIfSurface, classicIfFrame } from "./classic-if";
import { PlayerShell } from "./player-shell";
import { PlayerTheme } from "./ui";
import { defaultRendererEffects, type RendererEffects } from "./cool-retro-renderer";
import type { DisplayMode, WidgetState } from "./types";
import { getCrtTheme, type CrtThemeId } from "./crt-themes";
import { beginCreateStoryIntake, beginRemixStoryIntake, emitLoreSightAction } from "./app-actions";
import ASCIIText from "./react-bits/ASCIIText/ASCIIText";
import { installDiagnostics, type FeedbackPayload } from "./diagnostics";
import deskBackground from "./assets/retro-desk.png";
import "./styles.css";

installDiagnostics();

type CrtTheme = CrtThemeId;
const savedThemeEffectsKey = "storyframe.rendererEffectsByTheme.v2";
const savedUserThemeEffectsKey = "storyframe.userThemeEffects.v1";
const savedThemeKey = "storyframe.crtTheme.v1";

const rendererLabFields: Array<{ key: keyof RendererEffects; label: string; min: number; max: number; step: number }> = [
  { key: "curvature", label: "Curve", min: 0, max: 1, step: 0.01 },
  { key: "bloom", label: "Bloom", min: 0, max: 1, step: 0.01 },
  { key: "brightness", label: "Brightness", min: 0, max: 1, step: 0.01 },
  { key: "flickering", label: "Flicker", min: 0, max: 0.3, step: 0.005 },
  { key: "ambientLight", label: "Ambient", min: 0, max: 1, step: 0.01 },
  { key: "rgbShift", label: "RGB shift", min: 0, max: 0.01, step: 0.001 },
  { key: "horizontalSync", label: "Sync", min: 0, max: 1, step: 0.01 },
  { key: "jitter", label: "Jitter", min: 0, max: 1, step: 0.01 },
  { key: "burnIn", label: "Burn-in", min: 0, max: 1, step: 0.01 },
  { key: "staticNoise", label: "Noise", min: 0, max: 1, step: 0.01 },
  { key: "glowingLine", label: "Glow line", min: 0, max: 1, step: 0.01 },
  { key: "rasterizationIntensity", label: "Scanline", min: 0, max: 1, step: 0.01 },
  { key: "contrast", label: "Contrast", min: 0, max: 1, step: 0.01 },
  { key: "saturationColor", label: "Saturation", min: 0, max: 1, step: 0.01 },
  { key: "windowOpacity", label: "Opacity", min: 0, max: 1, step: 0.01 },
  { key: "scale", label: "Text size", min: 0.2, max: 1, step: 0.01 },
];

function initialWidgetState(): WidgetState {
  return window.openai?.widgetState ?? {};
}

function initialDisplayMode(): DisplayMode {
  const saved = initialWidgetState().displayMode;
  if (saved === "inline" || saved === "fullscreen") return saved;
  const host = window.openai?.displayMode;
  // Local previews and hosts that do not announce a mode should start as an
  // inline card. Fullscreen remains an explicit user action (double-tap or
  // the expand control), so the landing experience is never stranded in a
  // screen-only surface without a path back to the card.
  return host === "inline" || host === "fullscreen" ? host : "inline";
}

function initialCrtTheme(): CrtTheme {
  try {
    const local = window.localStorage.getItem(savedThemeKey);
    if (local && getCrtTheme(local as CrtThemeId).id === local) return local as CrtThemeId;
  } catch { /* local preview storage is optional */ }
  const saved = initialWidgetState().crtTheme;
  return saved && getCrtTheme(saved as CrtThemeId) ? saved as CrtThemeId : "orange";
}

function initialRendererEffects(): RendererEffects {
  const theme = initialCrtTheme();
  const widgetEffects = initialWidgetState().rendererEffects;
  let localEffects: Record<string, number> | null = null;
  try {
    const saved = window.localStorage.getItem("storyframe.rendererEffects");
    if (saved) localEffects = JSON.parse(saved);
  } catch { /* local preview storage is optional */ }
  let savedTheme: Partial<RendererEffects> = {};
  try {
    const saved = window.localStorage.getItem(savedUserThemeEffectsKey) ?? window.localStorage.getItem(savedThemeEffectsKey);
    const map = saved ? JSON.parse(saved) as Record<string, Partial<RendererEffects>> : {};
    savedTheme = map[theme] ?? {};
  } catch { /* optional storage */ }
  const profile = getCrtTheme(theme);
  if (widgetEffects || localEffects || Object.keys(savedTheme).length) return { ...defaultRendererEffects, ...profile.effects, ...(widgetEffects ?? {}), ...(localEffects ?? {}), ...savedTheme } as RendererEffects;
  return { ...defaultRendererEffects, ...profile.effects } as RendererEffects;
}

type HostLayoutState = {
  theme: "light" | "dark";
  maxHeight: number | null;
  safeArea: { top: number; right: number; bottom: number; left: number };
};

function readHostLayout(): HostLayoutState {
  const host = window.openai;
  const safeArea = host?.safeArea ?? {};
  return {
    theme: host?.theme === "dark" ? "dark" : "light",
    maxHeight: typeof host?.maxHeight === "number" && host.maxHeight > 0 ? host.maxHeight : null,
    safeArea: {
      top: Math.max(0, safeArea.top ?? 0),
      right: Math.max(0, safeArea.right ?? 0),
      bottom: Math.max(0, safeArea.bottom ?? 0),
      left: Math.max(0, safeArea.left ?? 0),
    },
  };
}

function hasSavedRendererEffects(): boolean {
  try {
    const saved = window.localStorage.getItem(savedUserThemeEffectsKey) ?? window.localStorage.getItem(savedThemeEffectsKey);
    const map = saved ? JSON.parse(saved) as Record<string, Partial<RendererEffects>> : {};
    return Boolean(map[initialCrtTheme()]);
  } catch { return false; }
}

function StoryframePlayer() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initialDisplayMode);
  const [crtTheme, setCrtTheme] = useState<CrtTheme>(initialCrtTheme);
  const [rendererEffects, setRendererEffects] = useState<RendererEffects>(initialRendererEffects);
  const [rendererLocked, setRendererLocked] = useState(hasSavedRendererEffects);
  const [connected, setConnected] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [remixOpen, setRemixOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [storyLoaded, setStoryLoaded] = useState(false);
  const [predictiveActions, setPredictiveActions] = useState<string[]>([]);
  const [hostLayout, setHostLayout] = useState<HostLayoutState>(readHostLayout);
  const appRef = useRef<App | null>(null);
  const rendererDraftDirty = useRef(false);
  const rendererEffectsRef = useRef(rendererEffects);
  const latestRendererState = useRef({ displayMode, crtTheme, rendererEffects });

  // ChatGPT can resize the fullscreen sheet as the native composer and safe
  // areas change. Re-read host globals on resize so the CRT never grows under
  // the system chrome. The custom event names are harmless in local preview
  // and support hosts that announce global updates without a resize.
  useEffect(() => {
    const syncHostLayout = () => setHostLayout(readHostLayout());
    window.addEventListener("resize", syncHostLayout);
    window.addEventListener("openai:globals-changed", syncHostLayout);
    window.addEventListener("openai:display-mode-changed", syncHostLayout);
    syncHostLayout();
    return () => {
      window.removeEventListener("resize", syncHostLayout);
      window.removeEventListener("openai:globals-changed", syncHostLayout);
      window.removeEventListener("openai:display-mode-changed", syncHostLayout);
    };
  }, []);

  useEffect(() => {
    latestRendererState.current = { displayMode, crtTheme, rendererEffects };
    rendererEffectsRef.current = rendererEffects;
  }, [displayMode, crtTheme, rendererEffects]);

  // Keep the active draft available to the host, but only write a local user
  // override when the player explicitly presses Save appearance.
  useEffect(() => {
    window.openai?.setWidgetState?.({ displayMode, crtTheme, rendererEffects });
  }, [displayMode, crtTheme, rendererEffects]);

  useEffect(() => {
    const setTheme = (event: Event) => applyTheme((event as CustomEvent<CrtTheme>).detail);
    const setEffect = (event: Event) => {
      const detail = (event as CustomEvent<{ key: keyof RendererEffects; value: number }>).detail;
      setRendererEffects((current) => ({ ...current, [detail.key]: detail.value }));
      rendererDraftDirty.current = true;
      setRendererLocked(false);
    };
    window.addEventListener("storyframe:set-theme", setTheme);
    window.addEventListener("storyframe:set-effect", setEffect);
    const lockEffects = () => lockRendererEffects();
    window.addEventListener("storyframe:lock-effects", lockEffects);
    return () => { window.removeEventListener("storyframe:set-theme", setTheme); window.removeEventListener("storyframe:set-effect", setEffect); window.removeEventListener("storyframe:lock-effects", lockEffects); };
  }, []);

  function applyTheme(themeId: CrtTheme) {
    const profile = getCrtTheme(themeId);
    let saved: Partial<RendererEffects> = {};
    try {
      const raw = window.localStorage.getItem(savedUserThemeEffectsKey) ?? window.localStorage.getItem(savedThemeEffectsKey);
      const map = raw ? JSON.parse(raw) as Record<string, Partial<RendererEffects>> : {};
      saved = map[themeId] ?? {};
    } catch { /* optional storage */ }
    setCrtTheme(themeId);
    rendererDraftDirty.current = false;
    try { window.localStorage.setItem(savedThemeKey, themeId); } catch { /* optional storage */ }
    const nextEffects = { ...defaultRendererEffects, ...profile.effects, ...saved } as RendererEffects;
    rendererEffectsRef.current = nextEffects;
    setRendererEffects(nextEffects);
    setRendererLocked(Object.keys(saved).length > 0);
  }

  useEffect(() => {
    let disposed = false;
    const app = new App({ name: "loresight-player", version: "0.5.0" }, {});
    app.ontoolresult = (result) => {
      const payload = result.structuredContent as { action?: string; theme?: string } | undefined;
      if (!payload?.action) return;
      if (payload.action === "set_theme" && payload.theme) {
        window.dispatchEvent(new CustomEvent("storyframe:set-theme", { detail: payload.theme }));
      } else if (payload.action === "open_library") {
        emitLoreSightAction("library");
      } else if (payload.action === "load_file") {
        emitLoreSightAction("load");
      } else if (payload.action === "load_sample") {
        window.dispatchEvent(new Event("storyframe:load-sample"));
      } else if (payload.action === "open_controls") {
        setControlsOpen(true);
      }
    };
    app.connect(new PostMessageTransport(window.parent, window.parent))
      .then(() => { if (!disposed) { appRef.current = app; setConnected(true); } })
      .catch(() => { appRef.current = null; if (!disposed) setConnected(false); });
    return () => { disposed = true; appRef.current = null; app.close(); };
  }, []);

  useEffect(() => {
    window.openai?.setWidgetState?.({ displayMode, crtTheme, rendererEffects });
    window.openai?.notifyIntrinsicHeight?.();
  }, [displayMode, crtTheme, rendererEffects]);

  // Admin commits are server-backed so production does not depend on which
  // browser context originally opened the Theme Lab. Server values win over
  // local drafts for the active profile.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/theme-profiles", { cache: "no-store" })
      .then((response): Promise<Record<string, Partial<RendererEffects>>> => response.ok ? response.json() as Promise<Record<string, Partial<RendererEffects>>> : Promise.resolve({}))
      .then((profiles) => {
        if (cancelled || !profiles || typeof profiles !== "object") return;
        const serverEffects = profiles[crtTheme];
        if (!serverEffects) return;
        if (rendererDraftDirty.current) return;
        let savedUser: Partial<RendererEffects> = {};
        try {
          const raw = window.localStorage.getItem(savedUserThemeEffectsKey) ?? window.localStorage.getItem(savedThemeEffectsKey);
          const map = raw ? JSON.parse(raw) as Record<string, Partial<RendererEffects>> : {};
          savedUser = map[crtTheme] ?? {};
        } catch { /* optional storage */ }
        setRendererEffects((current) => ({ ...current, ...serverEffects, ...savedUser }));
        setRendererLocked(Object.keys(savedUser).length > 0);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [crtTheme]);

  async function requestMode(mode: DisplayMode) {
    setDisplayMode(mode);
    try { await window.openai?.requestDisplayMode?.({ mode }); } catch { /* Local preview keeps its selection. */ }
  }

  function updateRendererEffect(key: keyof RendererEffects, value: number) {
    const nextEffects = { ...rendererEffectsRef.current, [key]: value } as RendererEffects;
    rendererEffectsRef.current = nextEffects;
    setRendererEffects(nextEffects);
    rendererDraftDirty.current = true;
    setRendererLocked(false);
  }

  function lockRendererEffects() {
    const { displayMode: currentMode, crtTheme: currentTheme, rendererEffects: currentEffects } = latestRendererState.current;
    const currentEffectsFromRef = rendererEffectsRef.current;
    const state = { displayMode: currentMode, crtTheme: currentTheme, rendererEffects: currentEffectsFromRef };
    try {
      const raw = window.localStorage.getItem(savedUserThemeEffectsKey) ?? window.localStorage.getItem(savedThemeEffectsKey);
      const map = raw ? JSON.parse(raw) as Record<string, Partial<RendererEffects>> : {};
      window.localStorage.setItem(savedUserThemeEffectsKey, JSON.stringify({ ...map, [currentTheme]: currentEffectsFromRef }));
      void navigator.storage?.persist?.();
    } catch { /* ignore unavailable storage */ }
    window.openai?.setWidgetState?.(state);
    rendererDraftDirty.current = false;
    setRendererLocked(true);
  }

  const screenOnly = displayMode === "fullscreen";
  const showBack = storyLoaded || settingsOpen || controlsOpen || libraryOpen || createOpen || remixOpen;
  const isPortfolioEmbed = new URLSearchParams(window.location.search).get("embed") === "portfolio";
  const shellClass = `storyframe-shell mode-${displayMode}${screenOnly ? " is-screen-only" : ""}${isPortfolioEmbed ? " is-portfolio-embed" : ""}`;
  const hostLayoutStyle = {
    "--host-max-height": hostLayout.maxHeight ? `${hostLayout.maxHeight}px` : "100vh",
    "--host-safe-top": `${hostLayout.safeArea.top}px`,
    "--host-safe-right": `${hostLayout.safeArea.right}px`,
    "--host-safe-bottom": `${hostLayout.safeArea.bottom}px`,
    "--host-safe-left": `${hostLayout.safeArea.left}px`,
  } as React.CSSProperties;
  async function runCreateStoryIntake(context: { premise: string; tone: string }): Promise<"mcp" | "openai" | "local"> {
    return beginCreateStoryIntake(appRef.current, context);
  }

  async function sendFeedback(payload: FeedbackPayload): Promise<void> {
    if (appRef.current) {
      const result = await appRef.current.callServerTool({ name: "submit_feedback", arguments: { ...payload } });
      if (!result?.isError) return;
      throw new Error("Feedback could not be sent.");
    }
    if (window.openai?.callTool) {
      const result = await window.openai.callTool("submit_feedback", { ...payload });
      if (!(result as { isError?: boolean } | undefined)?.isError) return;
      throw new Error("Feedback could not be sent.");
    }
    const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(result.error || "Feedback could not be sent.");
    }
  }

  useEffect(() => {
    const continueRemix = (event: Event) => {
      const detail = (event as CustomEvent<{ storyId?: string; title?: string; format?: string; sourceUrl?: string; prompt?: string }>).detail;
      if (!detail.storyId || !detail.title || !detail.format || !detail.sourceUrl) return;
      void beginRemixStoryIntake(appRef.current, {
        storyId: detail.storyId,
        title: detail.title,
        format: detail.format,
        sourceUrl: detail.sourceUrl,
        prompt: detail.prompt ?? "",
      }).then((result) => { if (result !== "local") setRemixOpen(false); });
    };
    window.addEventListener("loresight:remix-story", continueRemix);
    return () => window.removeEventListener("loresight:remix-story", continueRemix);
  }, []);

  const emitNativeAction = (name: string) => window.dispatchEvent(new Event(name));

  const handleBubbleMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='#']");
    if (!link) return;
    event.preventDefault();
    const action = link.getAttribute("href")?.slice(1);
    (document.querySelector(".loresight-bubble-menu .toggle-bubble") as HTMLButtonElement | null)?.click();
    setMenuOpen(false);
    if (["create", "remix", "library", "controls", "settings"].includes(action ?? "")) {
      setCreateOpen(false);
      setRemixOpen(false);
      setLibraryOpen(false);
      setControlsOpen(false);
      setSettingsOpen(false);
    }
    if (action === "create") setCreateOpen(true);
    if (action === "remix") setRemixOpen(true);
    if (action === "library") setLibraryOpen(true);
    if (action === "controls") setControlsOpen(true);
    if (action === "settings") setSettingsOpen(true);
    if (action === "load") emitNativeAction("storyframe:load-file");
  };

  return (
    <main className={shellClass} data-crt-theme={crtTheme} data-host-theme={hostLayout.theme} style={{ ...hostLayoutStyle, "--crt-glow": getCrtTheme(crtTheme).ink, "--crt-glow-soft": `color-mix(in srgb, ${getCrtTheme(crtTheme).ink} 12%, transparent)`, "--crt-screen-bg": getCrtTheme(crtTheme).paper, "--crt-screen-mid": getCrtTheme(crtTheme).paper } as React.CSSProperties} aria-label="Story terminal" aria-busy={false}>
      <div className="crt-top-actions">
        <div className="loresight-bubble-menu-host" onClick={handleBubbleMenuClick}>
          <BubbleMenu
          className="loresight-bubble-menu"
          logo={null}
          useFixedPosition={screenOnly}
          menuBg="#ffffff"
          menuContentColor="#111111"
          toggleBg="#17130d"
          toggleContentColor="var(--crt-glow)"
          menuAriaLabel="Toggle LoreSight navigation"
          animationEase="back.out(1.5)"
          animationDuration={0.5}
          staggerDelay={0.12}
          onMenuClick={setMenuOpen}
          overlayTargetSelector=".loresight-monitor .screen-trim"
          items={[
            { label: "Settings", href: "#settings", ariaLabel: "Settings", rotation: -8, hoverStyles: { bgColor: "#000000", textColor: "#00e6ff", glowColor: "#00e6ff", paperColor: "#000000", textShadow: "0 0 9px #00e6ff" } },
            { label: "Controls", href: "#controls", ariaLabel: "Controls", rotation: 8, hoverStyles: { bgColor: "#000000", textColor: "#0ccc68", glowColor: "#0ccc68", paperColor: "#000000", textShadow: "0 0 9px #0ccc68" } },
            { label: "Library", href: "#library", ariaLabel: "Library", rotation: 8, hoverStyles: { bgColor: "#36209b", textColor: "#ffffff", glowColor: "#7664d9", paperColor: "#36209b", textShadow: "0 0 5px #7664d9" } },
            { label: "Play/Remix", href: "#remix", ariaLabel: "Play or remix a story", rotation: 8, hoverStyles: { bgColor: "#020000", textColor: "#5efaac", glowColor: "#5efaac", paperColor: "#020000", textShadow: "0 0 12px #5efaac" } },
            { label: "New", href: "#create", ariaLabel: "Create a new story", rotation: -8, hoverStyles: { bgColor: "#000000", textColor: "#ffb000", glowColor: "#ffb000", paperColor: "#000000", textShadow: "0 0 9px #ffb000" } },
            { label: "Load", href: "#load", ariaLabel: "Load a Z-machine file", rotation: -8, hoverStyles: { bgColor: "#ff0000", textColor: "#ffffff", glowColor: "#ffffff", paperColor: "#ff0000", textShadow: "0 0 6px #ffffff" } },
          ]}
          />
        </div>
      </div>
      <button type="button" className="crt-fab crt-mode-fab" aria-label={screenOnly ? "Return to inline view" : "Open fullscreen view"} title={screenOnly ? "Return to inline view" : "Open fullscreen view"} onClick={() => void requestMode(screenOnly ? "inline" : "fullscreen")}><Expand aria-hidden="true" focusable="false" /></button>
      {showBack ? <button type="button" className="crt-fab crt-back-fab" aria-label="Back" title="Back" onClick={() => { window.dispatchEvent(new Event("storyframe:navigate-back")); setStoryLoaded(false); }}><ArrowLeft aria-hidden="true" focusable="false" /></button> : null}
      <PlayerShell frame={classicIfFrame} screenOnly={screenOnly} predictiveActions={predictiveActions} onDoubleTap={() => void requestMode("fullscreen")}>
        <ClassicIfSurface crtTheme={crtTheme} rendererEffects={rendererEffects} rendererLocked={rendererLocked} settingsOpen={settingsOpen} onSettingsOpenChange={setSettingsOpen} controlsOpen={controlsOpen} onControlsOpenChange={setControlsOpen} libraryOpen={libraryOpen} onLibraryOpenChange={setLibraryOpen} createOpen={createOpen} onCreateOpenChange={setCreateOpen} remixOpen={remixOpen} onRemixOpenChange={setRemixOpen} menuOpen={menuOpen} onMenuOpenChange={setMenuOpen} isFullscreen={screenOnly} onThemeChange={applyTheme} onRendererEffectChange={updateRendererEffect} onLockEffects={lockRendererEffects} onStoryLoaded={() => setStoryLoaded(true)} onPredictiveActions={setPredictiveActions} onSubmitFeedback={sendFeedback} onCreateStory={runCreateStoryIntake} />
      </PlayerShell>
    </main>
  );
}

function DeskScene() {
  return (
    <main className="loresight-desk-scene" aria-label="LoreSight on a retro desk">
      <img className="loresight-desk-background" src={deskBackground} alt="" aria-hidden="true" />
      <div className="loresight-desk-player">
        <StoryframePlayer />
      </div>
    </main>
  );
}

type DemoPanel = "instructions" | "supports" | "built" | null;

function LoreSightDemo() {
  const [panel, setPanel] = useState<DemoPanel>(null);
  const [themeInk, setThemeInk] = useState(() => getCrtTheme(initialCrtTheme()).ink);
  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const themeId = (event as CustomEvent<string>).detail as CrtThemeId;
      setThemeInk(getCrtTheme(themeId).ink);
    };
    window.addEventListener("storyframe:set-theme", handleThemeChange);
    return () => window.removeEventListener("storyframe:set-theme", handleThemeChange);
  }, []);
  const panelContent: Record<Exclude<DemoPanel, null>, { title: string; body: React.ReactNode }> = {
    instructions: {
      title: "How to play",
      body: <p>Choose a story, then type a command in the CRT terminal. Press Enter after each line. You can use classic phrases such as <code>look</code>, <code>take lamp</code>, or <code>go north</code>.</p>,
    },
    supports: {
      title: "What it supports",
      body: <p>LoreSight plays Z-machine fiction in <code>.z3</code>, <code>.z5</code>, <code>.z8</code>, and <code>.zblorb</code> formats. It also includes a story library, theme controls, optional narration, and local file loading.</p>,
    },
    built: {
      title: "How it was built",
      body: <p>The player is a React interface around a deterministic Z-machine runtime. The CRT is a presentation layer; story state stays separate and can be used in the browser or through the ChatGPT Apps SDK and MCP bridge.</p>,
    },
  };
  return (
    <main className="loresight-demo-page" aria-label="LoreSight demo">
      <div className="loresight-demo-desk" aria-hidden="true">
        <img src={deskBackground} alt="" />
      </div>
      <header className="loresight-demo-header">
        <div className="loresight-demo-ascii-row" aria-label="LoreSight" style={{ "--ascii-theme-color": themeInk } as React.CSSProperties}>
          <ASCIIText
            text="Loresight"
            textColor={themeInk}
            asciiFontSize={10}
            textFontSize={600}
            planeBaseHeight={24}
            enableWaves={true}
          />
        </div>
        <p className="loresight-demo-lede">Interactive fiction gaming in its natural habitat.<br />Play a classic, load your own, or create something fresh and new.</p>
      </header>
      <div className="loresight-demo-console"><StoryframePlayer /></div>
      <nav className="loresight-demo-links" aria-label="LoreSight information">
        <button type="button" onClick={() => setPanel("instructions")}>Instructions</button>
        <button type="button" onClick={() => setPanel("supports")}>What it supports</button>
        <button type="button" onClick={() => setPanel("built")}>How it was built</button>
        <a href="https://hunterpriester.com" target="_blank" rel="noreferrer">Created by Hunter Priester</a>
      </nav>
      {panel ? <div className="loresight-demo-backdrop" role="presentation" onClick={() => setPanel(null)}>
        <section className="loresight-demo-sheet" role="dialog" aria-modal="true" aria-labelledby="loresight-demo-sheet-title" onClick={(event) => event.stopPropagation()}>
          <button className="loresight-demo-close" type="button" aria-label="Close information" onClick={() => setPanel(null)}>×</button>
          <p className="loresight-demo-kicker">LORESIGHT</p>
          <h2 id="loresight-demo-sheet-title">{panelContent[panel].title}</h2>
          {panelContent[panel].body}
        </section>
      </div> : null}
    </main>
  );
}

const page = window.location.pathname;
const isDeskScene = page === "/desk";
const isDemo = page === "/demo";
createRoot(document.getElementById("root")!).render(<React.StrictMode><PlayerTheme>{isDemo ? <LoreSightDemo /> : isDeskScene ? <DeskScene /> : <StoryframePlayer />}</PlayerTheme></React.StrictMode>);

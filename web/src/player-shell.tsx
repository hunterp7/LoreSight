import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { PlayerFrameView } from "./types";
import loreSightCrtBezel from "./assets/loresight-crt-bezel-clean.png";
import buttonClickSound from "./assets/audio/mixkit-classic-click-1117.wav";

type ShellProps = {
  frame: PlayerFrameView;
  screenOnly: boolean;
  children: ReactNode;
  onDoubleTap?: () => void;
};

type AuthoredShellProps = {
  frame: PlayerFrameView;
  children: ReactNode;
};

const physicalNavigation = [
  { id: "library", label: "Library", event: "storyframe:open-library" },
  { id: "remix", label: "Play/Remix", event: "storyframe:open-remix" },
  { id: "load", label: "Load", event: "storyframe:load-file" },
  { id: "new", label: "New", event: "storyframe:open-create" },
  { id: "settings", label: "Settings", event: "storyframe:open-settings" },
] as const;

const authoredDefaults = {
  surround: "#161b22",
  surface: "#26313a",
  edge: "#89a89a",
  accent: "#d7b56d",
};

export const authoredFramePreview: PlayerFrameView = {
  kind: "authored",
  preset: "institutional",
  label: "Continuity archive",
  mark: "71 / 442",
  colors: authoredDefaults,
};

function SpeakerGrille({ side }: { side: "left" | "right" }) {
  return <div className={`speaker-grille speaker-${side}`} aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>;
}

function TerminalViewport({ children, chromeless = false }: { children: ReactNode; chromeless?: boolean }) {
  return (
    <div className={`screen-glass terminal-viewport${chromeless ? " is-chromeless" : ""}`}>
      {children}
    </div>
  );
}

/**
 * Transparent hit targets preserve the artwork's physical buttons without
 * painting a second HTML button row over the bezel.
 */
function PhysicalNavigationButtons({ hidden = false, predictiveActions = [] }: { hidden?: boolean; predictiveActions?: string[] }) {
  const [pressed, setPressed] = useState<string | null>(null);
  if (hidden) return null;
  const buttons = predictiveActions.length
    ? predictiveActions.slice(0, 5).map((label, index) => ({ id: `predictive-${index}`, label, command: label }))
    : physicalNavigation;
  return (
    <div className="bezel-physical-controls" aria-label="CRT secondary navigation">
      {buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          className={`bezel-physical-button bezel-physical-button-${button.id}${"command" in button ? ` bezel-physical-button-predictive-${button.id.slice(-1)}` : ""}${pressed === button.id ? " is-pressed" : ""}`}
          aria-label={button.label}
          onPointerDown={() => setPressed(button.id)}
          onPointerUp={() => setPressed(null)}
          onPointerCancel={() => setPressed(null)}
          onPointerLeave={() => setPressed(null)}
          onClick={() => {
            if ("command" in button) window.dispatchEvent(new CustomEvent("storyframe:predictive-action", { detail: { command: button.command } }));
            else window.dispatchEvent(new Event(button.event));
          }}
        ><span>{button.label}</span></button>
      ))}
    </div>
  );
}

function ScreenOnlyShell({ children }: { children: ReactNode }) {
  return (
    <div className="crt-screen-shell" data-player-shell="screen-only">
      <TerminalViewport chromeless>{children}</TerminalViewport>
    </div>
  );
}

function DefaultCrtShell({ children, screenOnly = false, onDoubleTap, predictiveActions = [] }: { children: ReactNode; screenOnly?: boolean; onDoubleTap?: () => void; predictiveActions?: string[] }) {
  const [signalLocking, setSignalLocking] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const clickAudio = new Audio(buttonClickSound);
    clickAudio.preload = "auto";
    clickAudio.volume = 0.38;
    const play = () => {
      setSignalLocking(false);
      window.requestAnimationFrame(() => setSignalLocking(true));
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setSignalLocking(false), 900);
    };
    const playButtonClick = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(".bezel-physical-button, .classic-action, .crt-gamepad-grid button, .crt-gamepad-aux button, .crt-gamepad-action-grid button, .story-library-item, .crt-settings-save")) return;
      clickAudio.currentTime = 0;
      void clickAudio.play().catch(() => { /* autoplay policy may require a later gesture */ });
    };
    window.addEventListener("storyframe:signal-lock", play);
    document.addEventListener("pointerdown", playButtonClick, true);
    return () => {
      window.removeEventListener("storyframe:signal-lock", play);
      document.removeEventListener("pointerdown", playButtonClick, true);
      clickAudio.pause();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className={`crt-monitor loresight-monitor${screenOnly ? " is-screen-only-shell" : ""}`} data-player-shell="default-crt">
      <img className="loresight-bezel-art" src={loreSightCrtBezel} alt="" aria-hidden="true" />
      {signalLocking && <span className="crt-signal-lock" aria-hidden="true" />}
      <div className="loresight-bezel-overlay">
        <div className="screen-trim" onDoubleClick={!screenOnly ? onDoubleTap : undefined} title={!screenOnly ? "Double-tap to fullscreen" : undefined}><TerminalViewport>{children}</TerminalViewport></div>
      </div>
      <PhysicalNavigationButtons hidden={screenOnly} predictiveActions={predictiveActions} />
    </div>
  );
}

function AuthoredShell({ frame, children }: AuthoredShellProps) {
  const colors = { ...authoredDefaults, ...frame.colors };
  const style = {
    "--frame-surround": colors.surround,
    "--frame-surface": colors.surface,
    "--frame-edge": colors.edge,
    "--frame-accent": colors.accent,
  } as CSSProperties;
  return (
    <div className="authored-shell" data-player-shell="authored" data-frame-preset={frame.preset ?? "minimal"} style={style}>
      <div className="authored-shell-band authored-shell-band-top" aria-hidden="true"><span>{frame.label ?? "LoreSight world"}</span><i /><strong>{frame.mark ?? "ARCHIVE"}</strong></div>
      <div className="authored-shell-body">
        <aside className="authored-ornament" aria-hidden="true"><span>◆</span><i /><span>◆</span></aside>
        <div className="authored-terminal-well"><TerminalViewport>{children}</TerminalViewport></div>
        <aside className="authored-ornament" aria-hidden="true"><span>◆</span><i /><span>◆</span></aside>
      </div>
      <div className="authored-shell-band authored-shell-band-bottom" aria-hidden="true"><span>AUTHORED SURROUND</span><i /><strong>LORESIGHT</strong></div>
    </div>
  );
}

export function PlayerShell({ frame, screenOnly, children, onDoubleTap, predictiveActions = [] }: ShellProps & { predictiveActions?: string[] }) {
  return frame.kind === "authored" ? <AuthoredShell frame={frame}>{children}</AuthoredShell> : <DefaultCrtShell screenOnly={screenOnly} onDoubleTap={onDoubleTap} predictiveActions={predictiveActions}>{children}</DefaultCrtShell>;
}

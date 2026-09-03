import { useEffect, useRef, useState } from "react";
import threshold8Hz from "./assets/audio/threshold-8hz.mp3";
import drift4Hz from "./assets/audio/drift-4hz.mp3";
import signal10Hz from "./assets/audio/signal-10hz.mp3";
import carrier10Hz from "./assets/audio/carrier-10hz.mp3";
import relay12Hz from "./assets/audio/relay-12hz.mp3";

const tracks = [
  { id: "drift", label: "Deep drift · 4 Hz", source: drift4Hz },
  { id: "threshold", label: "Threshold · 8 Hz", source: threshold8Hz },
  { id: "signal", label: "Signal + noise · 10 Hz", source: signal10Hz },
  { id: "carrier", label: "High carrier · 10 Hz", source: carrier10Hz },
  { id: "relay", label: "Relay · 12 Hz", source: relay12Hz },
] as const;

type AudioConsoleProps = {
  narrationText: string;
  requestNarration: (text: string) => Promise<string>;
};

export function AudioConsole({ narrationText, requestNarration }: AudioConsoleProps) {
  const backgroundRef = useRef<HTMLAudioElement>(null);
  const narrationRef = useRef<HTMLAudioElement>(null);
  const enabledRef = useRef(false);
  const narrationRequestRef = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(50);
  const [trackId, setTrackId] = useState<(typeof tracks)[number]["id"]>("threshold");
  const [narrationStatus, setNarrationStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [narrationError, setNarrationError] = useState("");
  const selectedTrack = tracks.find((track) => track.id === trackId) ?? tracks[0];

  function setElementVolumes(nextVolume: number, narrationPlaying = narrationStatus === "playing") {
    const normalized = nextVolume / 100;
    if (backgroundRef.current) backgroundRef.current.volume = normalized * (narrationPlaying ? 0.22 : 1);
    if (narrationRef.current) narrationRef.current.volume = normalized;
  }

  useEffect(() => {
    setElementVolumes(volume);
  }, [volume, narrationStatus]);

  useEffect(() => {
    if (!enabled || !backgroundRef.current) return;
    backgroundRef.current.load();
    void backgroundRef.current.play().catch(() => setNarrationStatus("error"));
  }, [enabled, selectedTrack.source]);

  async function playNarration(force = false) {
    if ((!enabled && !force) || narrationStatus === "loading") return;
    const requestId = ++narrationRequestRef.current;
    setNarrationError("");
    setNarrationStatus("loading");
    try {
      const audioDataUrl = await requestNarration(narrationText);
      if (!enabledRef.current || requestId !== narrationRequestRef.current) return;
      const narration = narrationRef.current;
      if (!narration) return;
      narration.src = audioDataUrl;
      narration.volume = volume / 100;
      setNarrationStatus("playing");
      await narration.play();
    } catch (error) {
      setNarrationError(error instanceof Error ? error.message : "Narration is temporarily unavailable.");
      setNarrationStatus("error");
    }
  }

  async function toggleAudio() {
    if (enabled) {
      enabledRef.current = false;
      narrationRequestRef.current += 1;
      backgroundRef.current?.pause();
      narrationRef.current?.pause();
      setEnabled(false);
      setNarrationError("");
      setNarrationStatus("idle");
      return;
    }

    setVolume(50);
    enabledRef.current = true;
    setEnabled(true);
    setElementVolumes(50, false);
    try {
      await backgroundRef.current?.play();
    } catch {
      // The track effect retries after React commits the enabled state.
    }
    void playNarration(true);
  }

  function finishNarration() {
    setNarrationStatus("idle");
    setElementVolumes(volume, false);
  }

  return (
    <div className={`audio-console${enabled ? " is-enabled" : ""}`}>
      <button type="button" className="audio-toggle" aria-pressed={enabled} aria-controls="story-audio-panel" onClick={() => void toggleAudio()}>
        <span>Audio</span>
        <strong>{enabled ? `${volume}%` : "Off"}</strong>
      </button>

      {enabled && (
        <div id="story-audio-panel" className="audio-panel" role="group" aria-label="Story audio controls">
          <label>
            <span>Background</span>
            <select aria-label="Background audio track" value={trackId} onChange={(event) => setTrackId(event.target.value as typeof trackId)}>
              {tracks.map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}
            </select>
          </label>
          <label>
            <span>Volume {volume}%</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={volume}
              aria-label="Story audio volume"
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </label>
          <button type="button" className="narration-action" disabled={narrationStatus === "loading"} onClick={() => void playNarration()}>
            {narrationStatus === "loading" ? "Generating…" : narrationStatus === "playing" ? "Reading…" : "Read this screen"}
          </button>
          <small>AI-generated voice · headphones recommended</small>
          <div className="audio-status" aria-live="polite">
            {narrationStatus === "error" ? narrationError || "Playback paused. Try Read this screen." : ""}
          </div>
        </div>
      )}

      <audio ref={backgroundRef} src={selectedTrack.source} loop preload="none" />
      <audio ref={narrationRef} preload="none" onEnded={finishNarration} onPause={() => narrationStatus === "playing" && finishNarration()} />
    </div>
  );
}

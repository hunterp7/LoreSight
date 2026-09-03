import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ArtifactRecord, Overview, SessionDetail, SessionSummary } from "./types";
import { AdminIcon, artifactIconName, type AdminIconName } from "./icons";
import { AdminPanel, StatusBadge, StoryButton, StoryInput, StorySelect, StoryframeTheme } from "./ui";
import { crtThemeProfiles, getCrtTheme, type CrtThemeId } from "../../web/src/crt-themes";
import type { RendererEffects } from "../../web/src/cool-retro-renderer";
import { CoolRetroRenderer } from "../../web/src/cool-retro-renderer";
import "./styles.css";

type View = "overview" | "sessions" | "studio" | "artifacts" | "runbook" | "themes" | "connect" | "launch";
type StudioTab = "story" | "enhancements";

type DevopsAction = { id: string; title: string; description: string; command: string };
type DevopsJob = {
  id: string;
  actionId: string;
  title: string;
  status: "running" | "passed" | "failed" | "timed_out";
  output: string;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
};

type StudioEnhancements = {
  shell: "default-crt" | "authored";
  audio: "off" | "on";
  imagery: "text-first" | "occasional" | "rich";
  motion: "calm" | "subtle" | "alive";
  guidance: "minimal" | "balanced" | "hands-on";
  notes: string;
};

const NAV_ITEMS: Array<{ id: View; label: string; icon: AdminIconName }> = [
  { id: "overview", label: "Home", icon: "home" },
  { id: "sessions", label: "Playtests", icon: "playtests" },
  { id: "studio", label: "Studio", icon: "draft" },
  { id: "artifacts", label: "Clues", icon: "clues" },
  { id: "runbook", label: "Help", icon: "help" },
  { id: "themes", label: "Themes", icon: "repair" },
  { id: "connect", label: "Connect", icon: "world" },
  { id: "launch", label: "Launch", icon: "play" },
];

const VIEW_TITLES: Record<View, string> = {
  overview: "Stories",
  sessions: "Playtests",
  studio: "Studio",
  artifacts: "Clues",
  runbook: "Help",
  themes: "Theme Lab",
  connect: "ChatGPT connection",
  launch: "Launch control",
};

const THEME_FIELDS: Array<{ key: keyof RendererEffects; label: string; min: number; max: number; step: number }> = [
  { key: "brightness", label: "Brightness", min: 0, max: 1, step: .01 }, { key: "curvature", label: "Curve", min: 0, max: 1, step: .01 },
  { key: "bloom", label: "Bloom", min: 0, max: 1, step: .01 }, { key: "flickering", label: "Flicker", min: 0, max: .3, step: .005 },
  { key: "ambientLight", label: "Ambient", min: 0, max: 1, step: .01 }, { key: "rgbShift", label: "RGB shift", min: 0, max: .01, step: .001 },
  { key: "horizontalSync", label: "Sync", min: 0, max: 1, step: .01 }, { key: "jitter", label: "Jitter", min: 0, max: 1, step: .01 },
  { key: "burnIn", label: "Burn-in", min: 0, max: 1, step: .01 }, { key: "staticNoise", label: "Noise", min: 0, max: 1, step: .01 },
  { key: "glowingLine", label: "Glow line", min: 0, max: 1, step: .01 }, { key: "rasterizationIntensity", label: "Scanline", min: 0, max: 1, step: .01 },
  { key: "contrast", label: "Contrast", min: 0, max: 1, step: .01 }, { key: "saturationColor", label: "Saturation", min: 0, max: 1, step: .01 },
  { key: "windowOpacity", label: "Opacity", min: 0, max: 1, step: .01 },
  { key: "scale", label: "Text size", min: .2, max: 1, step: .01 },
];
const DEFAULT_EFFECTS: RendererEffects = { curvature: .09, bloom: .25, brightness: .5, flickering: .015, ambientLight: .67, rgbShift: 0, horizontalSync: 0, jitter: .27, burnIn: 0, staticNoise: .18, chromaColor: 0, glowingLine: .22, rasterizationMode: 0, rasterizationIntensity: .79, scale: .33, contrast: .85, saturationColor: 0, windowOpacity: 1 };

const STUDIO_TABS: Array<{ id: StudioTab; label: string; description: string }> = [
  { id: "story", label: "Story", description: "Write the scene and save the draft." },
  { id: "enhancements", label: "Enhancements", description: "Set the retro shell, audio, and visual layer." },
];

const DEFAULT_SCENE = {
  title: "Opening scene",
  text: "The archive door is locked, but a red thread crosses the broken wax seal.\nThe room is quiet enough to hear the clock losing time.",
  exact: "The archive was locked overnight.",
  establish: "Three physical details conflict with the official record.\nThe player must choose what to inspect first.",
  suggest: "Keep the room quiet and the evidence visually precise.",
  never: "Identify the culprit before the evidence reveals it.\nResolve the archive patron's identity.",
  fallback: "The thread, wax, and clock cannot all be telling the same story.\nChoose what to inspect first.",
};

const DEFAULT_ENHANCEMENTS: StudioEnhancements = {
  shell: "default-crt",
  audio: "off",
  imagery: "text-first",
  motion: "calm",
  guidance: "minimal",
  notes: "Keep the core story playable as text even if every enhancement is off.",
};

function sourceLines(value: string): string {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => `    - ${line}`).join("\n");
}

function buildSceneSource(scene: typeof DEFAULT_SCENE): string {
  return `WORLD draft.creator-studio v1.0.0
  title: Creator Studio Draft
  owner: LoreSight Operator
  rights: original
  engine: 0.1.0

FRAME start
  title: ${scene.title.trim() || "Untitled scene"}
  text:
${sourceLines(scene.text)}
  exact:
${sourceLines(scene.exact)}
  establish:
${sourceLines(scene.establish)}
  suggest:
${sourceLines(scene.suggest)}
  never:
${sourceLines(scene.never)}
  fallback:
${sourceLines(scene.fallback)}

ENDING complete

STATE
  frame: start

INTENT finish
  title: Finish review
  description: Complete the remote compiler check.
  frames: start
  effects:
    - go complete
    - complete
`;
}

function parseSceneSource(source: string): typeof DEFAULT_SCENE {
  const allLines = source.split("\n");
  const frameStart = allLines.findIndex((line) => line === "FRAME start");
  const lines = frameStart >= 0 ? allLines.slice(frameStart + 1) : allLines;
  function property(key: string): string {
    const start = lines.findIndex((line) => line.startsWith(`  ${key}:`));
    if (start < 0) return "";
    const inline = lines[start].slice(`  ${key}:`.length).trim();
    if (inline) return inline;
    const values: string[] = [];
    for (let index = start + 1; index < lines.length && lines[index].startsWith("    "); index += 1) {
      const value = lines[index].replace(/^    -\s*/, "").trim();
      if (value) values.push(value);
    }
    return values.join("\n");
  }
  return {
    title: property("title") || DEFAULT_SCENE.title,
    text: property("text"),
    exact: property("exact"),
    establish: property("establish"),
    suggest: property("suggest"),
    never: property("never"),
    fallback: property("fallback"),
  };
}

function iconLabel(icon: AdminIconName, label: string) {
  return <span className="icon-label"><AdminIcon name={icon} />{label}</span>;
}

function normalizeEnhancements(value: unknown): StudioEnhancements {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_ENHANCEMENTS };
  const item = value as Record<string, unknown>;
  return {
    shell: item.shell === "authored" ? "authored" : "default-crt",
    audio: item.audio === "on" ? "on" : "off",
    imagery: item.imagery === "occasional" || item.imagery === "rich" ? item.imagery : "text-first",
    motion: item.motion === "subtle" || item.motion === "alive" ? item.motion : "calm",
    guidance: item.guidance === "balanced" || item.guidance === "hands-on" ? item.guidance : "minimal",
    notes: typeof item.notes === "string" && item.notes.trim() ? item.notes.trim().slice(0, 280) : DEFAULT_ENHANCEMENTS.notes,
  };
}

function enhancementRows(enhancements: StudioEnhancements): Array<{ label: string; value: string }> {
  return [
    {
      label: "Shell",
      value: enhancements.shell === "authored" ? "Use an authored surround around the terminal." : "Use the default CRT shell.",
    },
    {
      label: "Audio",
      value: enhancements.audio === "on" ? "Start audio at mid volume and allow narration." : "Keep audio off until the player asks for it.",
    },
    {
      label: "Visuals",
      value: enhancements.imagery === "text-first"
        ? "Prefer text with only occasional imagery."
        : enhancements.imagery === "occasional"
          ? "Add a few clear visual clues."
          : "Use visuals more often, while keeping text complete.",
    },
    {
      label: "Motion",
      value: enhancements.motion === "calm"
        ? "Use subtle or no motion."
        : enhancements.motion === "subtle"
          ? "Use restrained motion for emphasis."
          : "Allow more expressive motion for highlights.",
    },
    {
      label: "Help",
      value: enhancements.guidance === "minimal"
        ? "Keep helper prompts out of the way."
        : enhancements.guidance === "balanced"
          ? "Offer plain-language help when the player slows down."
          : "Offer more active recovery, recap, and next-step support.",
    },
  ];
}

function AdminConsole() {
  const [token, setToken] = useState(() => sessionStorage.getItem("storyframe-admin-token") ?? "");
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState<View>(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return NAV_ITEMS.some((item) => item.id === requested) ? requested as View : "overview";
  });
  const [studioTab, setStudioTab] = useState<StudioTab>("story");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [scene, setScene] = useState(DEFAULT_SCENE);
  const [enhancements, setEnhancements] = useState<StudioEnhancements>(DEFAULT_ENHANCEMENTS);
  const generatedSource = useMemo(() => buildSceneSource(scene), [scene]);
  const [source, setSource] = useState(() => buildSceneSource(DEFAULT_SCENE));
  const [sourceEdited, setSourceEdited] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [compileResult, setCompileResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionIntent, setCorrectionIntent] = useState("");
  const [forkVersion, setForkVersion] = useState("0");
  const [announcement, setAnnouncement] = useState("");
  const [themeDrafts, setThemeDrafts] = useState<Record<string, RendererEffects>>(() => {
    let saved: Record<string, Partial<RendererEffects>> = {};
    try { saved = JSON.parse(localStorage.getItem("storyframe.rendererEffectsByTheme.v2") || "{}"); } catch { /* optional storage */ }
    return Object.fromEntries(crtThemeProfiles.map((profile) => [profile.id, { ...DEFAULT_EFFECTS, ...profile.effects, ...(saved[profile.id] ?? {}) }])) as Record<string, RendererEffects>;
  });
  const [themesCommittedAt, setThemesCommittedAt] = useState("");
  const [tunnelBaseUrl, setTunnelBaseUrl] = useState(() => localStorage.getItem("loresight.mcpTunnelBaseUrl") ?? "");
  const [devopsActions, setDevopsActions] = useState<DevopsAction[]>([]);
  const [devopsEnabled, setDevopsEnabled] = useState(false);
  const [devopsJob, setDevopsJob] = useState<DevopsJob | null>(null);
  const [devopsLoading, setDevopsLoading] = useState(false);
  const mcpUrl = useMemo(() => {
    const normalized = tunnelBaseUrl.trim().replace(/\/+$/, "").replace(/\/mcp$/i, "");
    return normalized ? `${normalized}/mcp` : "";
  }, [tunnelBaseUrl]);

  function saveTunnelBaseUrl(value: string) {
    setTunnelBaseUrl(value);
    localStorage.setItem("loresight.mcpTunnelBaseUrl", value.trim());
  }

  async function copyMcpUrl() {
    if (!mcpUrl) return;
    await navigator.clipboard.writeText(mcpUrl);
    setAnnouncement("MCP URL copied.");
  }

  async function commitThemeDrafts() {
    localStorage.setItem("storyframe.rendererEffectsByTheme.v2", JSON.stringify(themeDrafts));
    setThemesCommittedAt(new Date().toLocaleTimeString());
    setAnnouncement("All CRT themes committed.");
    try {
      await api("/admin/api/theme-profiles", { method: "POST", body: JSON.stringify({ profiles: themeDrafts }) });
    } catch (caught) {
      setError(caught instanceof Error ? `Saved in this browser, but server sync failed: ${caught.message}` : "Saved in this browser, but server sync failed.");
    }
  }

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
      ...options,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? `That request could not be completed (${response.status}).`);
    return payload;
  }

  async function refreshOverview() {
    const next = await api<Overview>("/admin/api/overview");
    setOverview(next);
    setAuthenticated(true);
    sessionStorage.setItem("storyframe-admin-token", token);
  }

  async function authenticate() {
    setBusy(true);
    setError("");
    try {
      await refreshOverview();
      const saved = await api<{ drafts: Array<{ id: string }> }>("/admin/api/drafts");
      if (saved.drafts.some((draft) => draft.id === "creator-studio")) {
        const draft = await api<{ source: string; updatedAt: string; enhancements?: unknown }>("/admin/api/drafts/creator-studio");
        setScene(parseSceneSource(draft.source));
        setSource(draft.source);
        setSourceEdited(false);
        setDraftSavedAt(draft.updatedAt);
        setEnhancements(normalizeEnhancements(draft.enhancements));
      } else {
        setEnhancements({ ...DEFAULT_ENHANCEMENTS });
      }
    } catch (caught) {
      setAuthenticated(false);
      setError(caught instanceof Error ? caught.message : "That password did not work.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (token.length > 0) void authenticate();
  }, []);

  async function openSession(sessionId: string) {
    setBusy(true);
    setError("");
    try {
      const next = await api<SessionDetail>(`/admin/api/sessions/${encodeURIComponent(sessionId)}`);
      setSelectedSessionId(sessionId);
      setDetail(next);
      setForkVersion(String(Math.max(0, Number(next.state.stateVersion ?? 0) - 1)));
      setCorrectionIntent(next.availableIntents[0]?.id ?? "");
      setView("sessions");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That playtest could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  async function createPlaytest(worldId: string) {
    setBusy(true);
    setError("");
    try {
      const next = await api<SessionDetail>("/admin/api/playtests", {
        method: "POST",
        body: JSON.stringify({ worldId, seed: 42 }),
      });
      const sessionId = String(next.state.sessionId);
      setAnnouncement(`Opened ${next.scene?.title ?? "a new playtest"}.`);
      await refreshOverview();
      await openSession(sessionId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The playtest could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function submitIntent(intentId: string) {
    if (!detail || !selectedSessionId) return;
    setBusy(true);
    setError("");
    try {
      const payload = await api<{ session: SessionDetail }>(
        `/admin/api/playtests/${encodeURIComponent(selectedSessionId)}/intents`,
        {
          method: "POST",
          body: JSON.stringify({
            intentId,
            expectedStateVersion: detail.state.stateVersion,
            mutationId: crypto.randomUUID(),
          }),
        },
      );
      setDetail(payload.session);
      const completedChoice = payload.session.history?.at(-1)?.title ?? "Choice completed";
      const newestClue = payload.session.playerView?.artifacts.at(-1)?.title;
      setAnnouncement(`${completedChoice}. ${newestClue ? `Clue revealed: ${newestClue}.` : "The story path has been updated."}`);
      await refreshOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That choice could not be played.");
    } finally {
      setBusy(false);
    }
  }

  async function proposeCorrection() {
    setBusy(true);
    setError("");
    try {
      await api("/admin/api/corrections", {
        method: "POST",
        body: JSON.stringify({
          sessionId: selectedSessionId,
          forkAtVersion: Number(forkVersion),
          intentId: correctionIntent,
          reason: correctionReason,
        }),
      });
      setCorrectionReason("");
      await refreshOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The alternate path could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function compileDraft() {
    setBusy(true);
    setError("");
    try {
      const result = await api<Record<string, unknown>>("/admin/api/compile", {
        method: "POST",
        body: JSON.stringify({ sourceId: "creator-studio.storyframe", source: sourceEdited ? source : generatedSource }),
      });
      setCompileResult(result);
    } catch (caught) {
      setCompileResult({ ok: false, error: caught instanceof Error ? caught.message : "The draft check failed." });
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setError("");
    try {
      const currentSource = sourceEdited ? source : generatedSource;
      const result = await api<{ draft: { updatedAt: string } }>("/admin/api/drafts/creator-studio", {
        method: "PUT",
        body: JSON.stringify({ title: scene.title, source: currentSource, enhancements }),
      });
      setDraftSavedAt(result.draft.updatedAt);
      setAnnouncement("Draft saved privately.");
      await refreshOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The draft could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function updateScene(field: keyof typeof DEFAULT_SCENE, value: string) {
    const next = { ...scene, [field]: value };
    setScene(next);
    if (!sourceEdited) setSource(buildSceneSource(next));
    setCompileResult(null);
  }

  function resetAdvancedSource() {
    setSource(generatedSource);
    setSourceEdited(false);
    setCompileResult(null);
  }

  function updateEnhancement<K extends keyof StudioEnhancements>(key: K, value: StudioEnhancements[K]) {
    setEnhancements((current) => ({ ...current, [key]: value }));
  }

  async function loadArtifacts() {
    try {
      const result = await api<{ artifacts: ArtifactRecord[] }>("/admin/api/artifacts");
      setArtifacts(result.artifacts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The clues could not be loaded.");
    }
  }

  useEffect(() => {
    if (authenticated && view === "artifacts") void loadArtifacts();
  }, [authenticated, view]);

  useEffect(() => {
    if (!authenticated || view !== "launch") return;
    void api<{ enabled: boolean; actions: DevopsAction[] }>("/admin/api/devops/actions")
      .then((result) => {
        setDevopsEnabled(result.enabled);
        setDevopsActions(result.actions);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Launch controls could not be loaded."));
  }, [authenticated, view]);

  useEffect(() => {
    if (!devopsJob || devopsJob.status !== "running") return;
    const timer = window.setInterval(() => {
      void api<{ job: DevopsJob }>(`/admin/api/devops/jobs/${devopsJob.id}`)
        .then(({ job }) => {
          setDevopsJob(job);
          if (job.status !== "running") {
            setDevopsLoading(false);
            setAnnouncement(`${job.title} ${job.status === "passed" ? "passed" : "finished with a problem"}.`);
          }
        })
        .catch((caught) => {
          setDevopsLoading(false);
          setError(caught instanceof Error ? caught.message : "The running operation could not be checked.");
        });
    }, 700);
    return () => window.clearInterval(timer);
  }, [devopsJob?.id, devopsJob?.status]);

  async function runDevopsAction(actionId: string) {
    setDevopsLoading(true);
    setError("");
    try {
      const { job } = await api<{ job: DevopsJob }>("/admin/api/devops/jobs", {
        method: "POST",
        body: JSON.stringify({ actionId }),
      });
      setDevopsJob(job);
      setAnnouncement(`${job.title} started.`);
    } catch (caught) {
      setDevopsLoading(false);
      setError(caught instanceof Error ? caught.message : "That operation could not start.");
    }
  }

  const sessions = overview?.sessions ?? [];
  const worldTitles = useMemo(
    () => new Map((overview?.worlds ?? []).map((world) => [world.id, world.title])),
    [overview],
  );
  const selectedSummary = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId),
    [sessions, selectedSessionId],
  );

  if (!authenticated) {
    return (
      <main className="login-shell">
        <AdminPanel title="LORESIGHT">
          <div className="login-mark"><AdminIcon name="locked" size={30} /></div>
          <p className="kicker">Private workspace</p>
          <h1>Welcome back.</h1>
          <p>Enter the admin password to review stories, tune themes, and run playtests.</p>
          <StoryInput
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            label="Admin password"
            aria-label="Admin password"
            autoComplete="current-password"
          />
          {error ? <p className="error-message" role="alert">{error}</p> : null}
          <StoryButton onClick={() => void authenticate()} disabled={busy || token.length === 0}>
            {busy ? "Opening…" : iconLabel("locked", "Open admin")}
          </StoryButton>
        </AdminPanel>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="kicker">LoreSight</p>
          <h1>{VIEW_TITLES[view]}</h1>
        </div>
        <div className="header-status" title="Your workspace is connected">
          <span className="connection-dot" aria-hidden="true" />
          <span>Connected</span>
          <button className="refresh-button" onClick={() => void refreshOverview()} aria-label="Refresh story information" title="Refresh">
            <AdminIcon name="refresh" />
          </button>
        </div>
      </header>

      <nav className="admin-nav" aria-label="LoreSight sections">
        {NAV_ITEMS.map((item) => (
          <StoryButton key={item.id} variant={view === item.id ? "primary" : "flat"} onClick={() => setView(item.id)}>
            {iconLabel(item.icon, item.label)}
          </StoryButton>
        ))}
      </nav>

      {error ? <div className="global-error" role="alert">{error}</div> : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      {view === "launch" ? (
        <section className="page-stack devops-page" aria-labelledby="devops-heading">
          <div className="page-heading">
            <div>
              <h2 id="devops-heading">Run LoreSight safely</h2>
              <p>Each button runs one approved command on this computer. You can watch what happens below.</p>
            </div>
            <a className="story-button story-button-flat" href="/widget" target="_blank" rel="noreferrer">Open preview</a>
          </div>

          <div className="devops-warning" role="note">
            <AdminIcon name="locked" size={22} />
            <div><strong>These buttons are real.</strong><span>Only the commands shown here are allowed. There is no free-form terminal box.</span></div>
          </div>

          <div className="devops-grid">
            {devopsActions.map((action) => {
              const isRelease = action.id === "release-check";
              const isThisRunning = devopsJob?.actionId === action.id && devopsJob.status === "running";
              return (
                <article className={`devops-card${isRelease ? " devops-card-featured" : ""}`} key={action.id}>
                  <div className="devops-card-icon"><AdminIcon name={isRelease ? "check" : "play"} size={25} /></div>
                  <h3>{action.title}</h3>
                  <p>{action.description}</p>
                  <code>{action.command}</code>
                  <StoryButton
                    variant={isRelease ? "primary" : "flat"}
                    onClick={() => void runDevopsAction(action.id)}
                    disabled={!devopsEnabled || devopsLoading || devopsJob?.status === "running"}
                  >
                    {isThisRunning ? "Running…" : isRelease ? "Run every check" : "Run now"}
                  </StoryButton>
                </article>
              );
            })}
          </div>

          <AdminPanel title="Live command output">
            <div className="devops-output-heading">
              <div>
                <strong>{devopsJob?.title ?? "Nothing running yet"}</strong>
                <span>{devopsJob ? new Date(devopsJob.startedAt).toLocaleTimeString() : "Choose a button above to begin."}</span>
              </div>
              {devopsJob ? <StatusBadge
                label={devopsJob.status === "running" ? "RUNNING" : devopsJob.status === "passed" ? "PASSED" : "NEEDS ATTENTION"}
                tone={devopsJob.status === "passed" ? "success" : devopsJob.status === "running" ? "warning" : "error"}
              /> : null}
            </div>
            <pre className="devops-console" aria-live="polite">{devopsJob?.output || "Command output will appear here as it happens."}</pre>
          </AdminPanel>

          <div className="devops-unavailable-grid">
            <article>
              <AdminIcon name="refresh" />
              <div><strong>Restart server</strong><p>Unavailable here because restarting would turn off this dashboard. Use a process manager for that later.</p></div>
            </article>
            <article>
              <AdminIcon name="world" />
              <div><strong>Deploy publicly</strong><p>Unavailable until a hosting provider, project, and confirmation step are connected.</p></div>
            </article>
          </div>
          {!devopsEnabled ? <p className="devops-disabled">Command buttons are disabled in this environment.</p> : null}
        </section>
      ) : null}

      {view === "connect" ? (
        <section className="page-stack connection-page" aria-labelledby="connection-heading">
          <div className="page-heading">
            <div>
              <h2 id="connection-heading">Connect LoreSight to ChatGPT</h2>
              <p>Paste the HTTPS address from your tunnel. We will make the exact MCP URL ChatGPT needs.</p>
            </div>
          </div>
          <AdminPanel title="ChatGPT connector">
            <label className="connection-field">
              <span>Tunnel address</span>
              <StoryInput
                value={tunnelBaseUrl}
                onChange={(event) => saveTunnelBaseUrl(event.target.value)}
                placeholder="https://your-name.trycloudflare.com"
                inputMode="url"
                aria-describedby="connection-help"
              />
            </label>
            <div className="connection-launcher">
              <span className="connection-result-label">First step: start a tunnel</span>
              <code>node scripts/start-chatgpt-tunnel.mjs</code>
              <p>Run this from the LoreSight project folder. It starts Cloudflare, finds the temporary HTTPS address, and prints the complete MCP URL automatically.</p>
            </div>
            <p id="connection-help" className="connection-help">Keep the address at its root. If you paste a URL ending in <code>/mcp</code>, we clean it up automatically.</p>
            <div className="connection-result" aria-live="polite">
              <span className="connection-result-label">Full MCP URL</span>
              <code>{mcpUrl || "Enter a tunnel address above"}</code>
              <StoryButton variant="primary" onClick={() => void copyMcpUrl()} disabled={!mcpUrl}>{iconLabel("check", "Copy URL")}</StoryButton>
            </div>
            <div className="connection-steps">
              <p><strong>1.</strong> Keep the LoreSight server, proxy, and tunnel running.</p>
              <p><strong>2.</strong> Copy the generated URL into ChatGPT Developer Mode.</p>
              <p><strong>3.</strong> Refresh the connection, start a new chat, and say <em>“Launch LoreSight.”</em></p>
            </div>
            <div className="connection-actions">
              <a className="story-button story-button-flat" href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">Open ChatGPT connections</a>
              <a className="story-button story-button-flat" href="/widget" target="_blank" rel="noreferrer">Open local preview</a>
            </div>
          </AdminPanel>
        </section>
      ) : null}

      {view === "themes" ? (
        <section className="page-stack theme-lab-admin" aria-labelledby="theme-lab-heading">
          <div className="page-heading"><div><h2 id="theme-lab-heading">Tune every CRT theme</h2><p>Adjust each profile with a live preview. Nothing reaches players until you commit all themes.</p></div><StoryButton variant="primary" onClick={commitThemeDrafts}>{iconLabel("check", "Commit all themes")}</StoryButton></div>
          {themesCommittedAt ? <p className="theme-commit-status">Committed at {themesCommittedAt}. Reloading the player will use these values.</p> : null}
          <div className="theme-admin-grid">
            {crtThemeProfiles.map((profile) => {
              const effects = themeDrafts[profile.id];
              return <article key={profile.id} className="theme-admin-card" style={{ "--theme-ink": profile.ink, "--theme-paper": profile.paper } as React.CSSProperties}>
                <div className="theme-admin-preview">
                  <CoolRetroRenderer text={`LoreSight\n\n${profile.name.toUpperCase()} DISPLAY\n\nThe archive terminal is ready.\nA faint mark crosses the lower glass.\n\n> LOOK\nYou notice a message waiting in the dark.\n\n>`} color={profile.id as CrtThemeId} effects={effects} palette={{ ink: profile.ink, paper: profile.paper }} cursor={{ visible: true, blinking: true }} layoutMode="inline" scrollEnabled={false} followOutput={true} />
                </div>
                <div className="theme-admin-card-heading"><div><h3>{profile.name}</h3><p>{profile.description}</p></div><code>{profile.id}</code></div>
                <div className="theme-admin-fields">
                  {THEME_FIELDS.map((field) => {
                    const applyValue = (event: React.FormEvent<HTMLInputElement>) => setThemeDrafts((current) => ({ ...current, [profile.id]: { ...current[profile.id], [field.key]: Number(event.currentTarget.value) } }));
                    return <label key={field.key}><span>{field.label}</span><input type="range" min={field.min} max={field.max} step={field.step} value={effects[field.key] ?? 0} onInput={applyValue} onChange={applyValue} /><output>{Number(effects[field.key] ?? 0).toFixed(field.step < .01 ? 3 : 2)}</output></label>;
                  })}
                </div>
              </article>;
            })}
          </div>
        </section>
      ) : null}

      {view === "overview" && overview ? (
        <section className="page-stack" aria-labelledby="stories-heading">
          <div className="page-heading">
            <div>
              <h2 id="stories-heading">Choose a story</h2>
              <p>Start a private playtest to experience the opening and try its choices.</p>
            </div>
          </div>
          <div className="world-grid">
            {overview.worlds.map((world) => {
              const testCount = world.authoredTests.passed + world.authoredTests.failed;
              const healthy = world.compileStatus === "ready" && world.authoredTests.failed === 0;
              return (
                <article className="world-card" key={world.id}>
                  <div className="world-card-top">
                    <div className="world-icon"><AdminIcon name={healthy ? "world" : "error"} size={26} /></div>
                    <StatusBadge label={healthy ? "READY" : "NEEDS ATTENTION"} tone={healthy ? "success" : "error"} />
                  </div>
                  <h3>{world.title}</h3>
                  <p className="world-message">
                    {world.compileStatus !== "ready"
                      ? "This story has a problem that must be fixed before testing."
                      : world.opening ?? "Open the story to discover its first scene and available choices."}
                  </p>
                  {world.compileStatus === "ready" ? (
                    <StoryButton onClick={() => void createPlaytest(world.id)} disabled={busy}>
                      {iconLabel("play", "Start playtest")}
                    </StoryButton>
                  ) : null}
                  <details className="technical-details">
                    <summary>Story checks</summary>
                    <p className="mono-id">{world.id}</p>
                    <dl>
                      <div><dt>Scenes</dt><dd>{world.frames}</dd></div>
                      <div><dt>Choices</dt><dd>{world.intents}</dd></div>
                      <div><dt>Clues</dt><dd>{world.artifacts}</dd></div>
                    </dl>
                    <p className="mono-id">Version {world.version} · {testCount === 0 ? "No automated checks" : `${world.authoredTests.passed} checks passed`}</p>
                    {world.branchCoverage ? <p className="mono-id">Coverage: {world.branchCoverage.coverage.frames}% scenes · {world.branchCoverage.deadEnds} dead ends</p> : null}
                  </details>
                </article>
              );
            })}
          </div>
          {sessions.length > 0 ? (
            <AdminPanel title="RECENT PLAYTESTS">
              <SessionList sessions={sessions.slice(0, 5)} worldTitles={worldTitles} onOpen={openSession} />
            </AdminPanel>
          ) : null}
        </section>
      ) : null}

      {view === "sessions" ? (
        <section className="session-layout">
          <AdminPanel title="PLAYTESTS">
            <p className="panel-intro">Open a playtest to continue it or see where the story changed.</p>
            <SessionList sessions={sessions} active={selectedSessionId} worldTitles={worldTitles} onOpen={openSession} />
          </AdminPanel>
          <AdminPanel title={selectedSummary ? "CURRENT PLAYTEST" : "CHOOSE A PLAYTEST"} className="session-inspector">
            {!detail ? (
              <EmptyState icon="search" title="Nothing selected" copy="Choose a playtest from the list to review it." />
            ) : (
              <div className="detail-stack">
                <div className="session-title-row">
                  <div>
                    <p className="kicker">{selectedSummary ? (worldTitles.get(selectedSummary.worldId) ?? selectedSummary.worldId) : "Story path"}</p>
                    <h2>{detail.scene?.title ?? (detail.kind === "playtest" ? "Current scene" : "Recorded story run")}</h2>
                  </div>
                  <span className="step-chip">{detail.state.status === "complete" ? "Finished" : `Step ${Number(detail.state.stateVersion ?? 0) + 1}`}</span>
                </div>

                {detail.scene ? <div className="scene-card"><p>{detail.scene.text}</p></div> : null}

                {detail.audit.issues.length > 0 ? (
                  <section className="story-problems">
                    <h3>{iconLabel("error", "Story needs attention")}</h3>
                    <ul className="finding-list">
                      {detail.audit.issues.map((issue, index) => (
                        <li key={`${issue.code}-${index}`}>
                          <AdminIcon name="error" />
                          <div><strong>{issue.message}</strong><p>Open technical details below if a developer needs the exact location.</p></div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section>
                  <h3>{iconLabel("play", "What would you like to try?")}</h3>
                  {detail.availableIntents.length === 0 ? <p>This path has ended.</p> : (
                    <div className="intent-grid">
                      {detail.availableIntents.map((intent) => (
                        <StoryButton key={intent.id} variant="outline" disabled={busy || detail.kind !== "playtest"} onClick={() => void submitIntent(intent.id)}>
                          <strong>{intent.title}</strong>
                          {intent.description ? <small>{intent.description}</small> : null}
                        </StoryButton>
                      ))}
                    </div>
                  )}
                </section>

                {(detail.playerView?.artifacts.length ?? 0) > 0 ? (
                  <section>
                    <h3>{iconLabel("clues", detail.playerView!.artifacts.length === 1 ? "Clue revealed" : "Clues revealed")}</h3>
                    <div className="session-artifacts">
                      {detail.playerView!.artifacts.map((artifact) => (
                        <article className="session-artifact" key={artifact.id}>
                          <div className="session-artifact-icon" role="img" aria-label={artifact.altText}><AdminIcon name={artifactIconName(artifact.kind)} size={30} /></div>
                          <div><strong>{artifact.title}</strong><p>{artifact.summary}</p></div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {(detail.history?.length ?? 0) > 0 ? (
                  <section>
                    <h3>{iconLabel("notes", "Your path")}</h3>
                    <ol className="event-list">
                      {detail.history!.slice(-8).map((event) => (
                        <li key={event.id}><span>{event.step}</span><div><strong>{event.title}</strong>{event.description ? <small>{event.description}</small> : null}</div></li>
                      ))}
                    </ol>
                  </section>
                ) : null}

                {detail.kind === "playtest" && detail.events.length > 0 && detail.availableIntents.length > 0 ? (
                  <details className="correction-disclosure">
                    <summary>{iconLabel("repair", "Try a different path")}</summary>
                    <div className="correction-box">
                      <p>Test a replacement choice without changing the original playtest.</p>
                      <div className="correction-grid">
                        <StoryInput type="number" min="0" value={forkVersion} onChange={(event) => setForkVersion(event.target.value)} label="Return to step" aria-label="Return to step" />
                        <StorySelect value={correctionIntent} onChange={(event) => setCorrectionIntent(event.target.value)} label="Try this choice instead" aria-label="Try this choice instead">
                          {detail.availableIntents.map((intent) => <option key={intent.id} value={intent.id}>{intent.title}</option>)}
                        </StorySelect>
                      </div>
                      <StoryInput multiline rows={3} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} label="What should improve?" aria-label="What should improve?" />
                      <StoryButton variant="warning" disabled={busy || correctionReason.trim().length < 8 || !correctionIntent} onClick={() => void proposeCorrection()}>
                        {iconLabel("repair", "Save alternate path")}
                      </StoryButton>
                    </div>
                  </details>
                ) : null}

                {detail.audit.issues.length === 0 ? <p className="story-health-note"><AdminIcon name="check" /> No story problems detected on this path.</p> : null}

                <details className="technical-details">
                  <summary>Technical details</summary>
                  <p>Story step: {String(detail.state.frameId ?? detail.state.status ?? "legacy")} · Data version: {String(detail.state.stateVersion ?? "—")}</p>
                  <pre>{JSON.stringify(detail.state, null, 2)}</pre>
                </details>
              </div>
            )}
          </AdminPanel>
        </section>
      ) : null}

      {view === "studio" ? (
        <section className="page-stack">
          <div className="page-heading">
            <div>
              <h2 id="studio-heading">Studio</h2>
              <p>Write the story, then choose how much retro presentation should sit on top of it.</p>
            </div>
          </div>

          <div className="studio-tabs" role="tablist" aria-label="Studio sections">
            {STUDIO_TABS.map((tab) => (
              <StoryButton
                key={tab.id}
                type="button"
                variant={studioTab === tab.id ? "primary" : "flat"}
                aria-pressed={studioTab === tab.id}
                onClick={() => setStudioTab(tab.id)}
              >
                <span className="studio-tab-button">
                  <strong>{tab.label}</strong>
                  <small>{tab.description}</small>
                </span>
              </StoryButton>
            ))}
          </div>

          <div className="studio-layout">
            <AdminPanel title={studioTab === "story" ? "SCENE EDITOR" : "PRESENTATION SETTINGS"} className="studio-editor">
              {studioTab === "story" ? (
                <>
                  <div className="section-lead"><AdminIcon name="draft" size={24} /><div><h2>Shape one important moment</h2><p>Write what the player sees, what must land, and what the story must protect.</p></div></div>
                  <div className="studio-fields">
                    <StoryInput value={scene.title} onChange={(event) => updateScene("title", event.target.value)} label="Scene name" aria-label="Scene name" />
                    <StoryInput multiline rows={4} value={scene.text} onChange={(event) => updateScene("text", event.target.value)} label="What the player reads first" aria-label="What the player reads first" />
                    <div className="studio-field-group">
                      <p className="kicker">What must happen</p>
                      <StoryInput multiline rows={2} value={scene.exact} onChange={(event) => updateScene("exact", event.target.value)} label="Exact wording" aria-label="Exact wording" />
                      <StoryInput multiline rows={3} value={scene.establish} onChange={(event) => updateScene("establish", event.target.value)} label="Meaning the player must understand" aria-label="Meaning the player must understand" />
                    </div>
                    <details className="studio-more">
                      <summary>{iconLabel("notes", "Fine-tune the storytelling")}</summary>
                      <div className="studio-field-group">
                        <StoryInput multiline rows={2} value={scene.suggest} onChange={(event) => updateScene("suggest", event.target.value)} label="Direction for the storyteller" aria-label="Direction for the storyteller" />
                        <StoryInput multiline rows={2} value={scene.never} onChange={(event) => updateScene("never", event.target.value)} label="What must stay protected" aria-label="What must stay protected" />
                        <StoryInput multiline rows={3} value={scene.fallback} onChange={(event) => updateScene("fallback", event.target.value)} label="Backup narration" aria-label="Backup narration" />
                      </div>
                    </details>
                  </div>
                  <div className="studio-actions">
                    <StoryButton onClick={() => void compileDraft()} disabled={busy}>{busy ? "Working…" : iconLabel("check", "Check this scene")}</StoryButton>
                    <StoryButton variant="outline" onClick={() => void saveDraft()} disabled={busy}>{iconLabel("draft", "Save draft")}</StoryButton>
                    {draftSavedAt ? <small>Saved {new Date(draftSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small> : null}
                  </div>
                  <details className="technical-details studio-source">
                    <summary>Advanced LoreSight source</summary>
                    <p>Edit the compiled source only when you need precise control. Reset to return to the guided scene.</p>
                    <StoryInput multiline rows={18} value={sourceEdited ? source : generatedSource} onChange={(event) => { setSource(event.target.value); setSourceEdited(true); setCompileResult(null); }} aria-label="Advanced LoreSight source" />
                    {sourceEdited ? <StoryButton variant="flat" onClick={resetAdvancedSource}>{iconLabel("refresh", "Reset from scene editor")}</StoryButton> : null}
                  </details>
                </>
              ) : (
                <>
                  <div className="section-lead"><AdminIcon name="world" size={24} /><div><h2>Shape the retro layer</h2><p>Choose how the command-line story is dressed without changing the story itself.</p></div></div>
                  <div className="studio-fields enhancements-fields">
                    <div className="studio-field-group">
                      <p className="kicker">Shell</p>
                      <StorySelect value={enhancements.shell} onChange={(event) => updateEnhancement("shell", event.target.value as StudioEnhancements["shell"])} label="Shell" aria-label="Shell">
                        <option value="default-crt">Default CRT</option>
                        <option value="authored">Authored surround</option>
                      </StorySelect>
                      <p className="field-help">The shell changes the frame around the command line, not the story rules.</p>
                    </div>
                    <div className="studio-field-group">
                      <p className="kicker">Audio</p>
                      <StorySelect value={enhancements.audio} onChange={(event) => updateEnhancement("audio", event.target.value as StudioEnhancements["audio"])} label="Audio" aria-label="Audio">
                        <option value="off">Off</option>
                        <option value="on">On</option>
                      </StorySelect>
                      <p className="field-help">When on, the player can start music at a middle volume and hear narration.</p>
                    </div>
                    <div className="studio-field-group">
                      <p className="kicker">Visual clues</p>
                      <StorySelect value={enhancements.imagery} onChange={(event) => updateEnhancement("imagery", event.target.value as StudioEnhancements["imagery"])} label="Visual clues" aria-label="Visual clues">
                        <option value="text-first">Text first</option>
                        <option value="occasional">Occasional imagery</option>
                        <option value="rich">More frequent imagery</option>
                      </StorySelect>
                      <p className="field-help">Images and pixel art should deepen the scene, never replace the text.</p>
                    </div>
                    <div className="studio-field-group">
                      <p className="kicker">Motion</p>
                      <StorySelect value={enhancements.motion} onChange={(event) => updateEnhancement("motion", event.target.value as StudioEnhancements["motion"])} label="Motion" aria-label="Motion">
                        <option value="calm">Calm</option>
                        <option value="subtle">Subtle</option>
                        <option value="alive">Lively</option>
                      </StorySelect>
                      <p className="field-help">Keep motion restrained so the story still feels like a command-line game.</p>
                    </div>
                    <div className="studio-field-group">
                      <p className="kicker">Player help</p>
                      <StorySelect value={enhancements.guidance} onChange={(event) => updateEnhancement("guidance", event.target.value as StudioEnhancements["guidance"])} label="Player help" aria-label="Player help">
                        <option value="minimal">Minimal</option>
                        <option value="balanced">Balanced</option>
                        <option value="hands-on">Hands-on</option>
                      </StorySelect>
                      <p className="field-help">This controls how much ChatGPT should help with recaps, recovery, and next-step guidance.</p>
                    </div>
                    <StoryInput multiline rows={3} value={enhancements.notes} onChange={(event) => updateEnhancement("notes", event.target.value)} label="Notes for this presentation" aria-label="Notes for this presentation" />
                  </div>
                  <div className="studio-actions">
                    <StoryButton variant="outline" onClick={() => void saveDraft()} disabled={busy}>{iconLabel("draft", "Save draft")}</StoryButton>
                    <StoryButton variant="flat" onClick={() => setEnhancements({ ...DEFAULT_ENHANCEMENTS })} disabled={busy}>{iconLabel("refresh", "Reset presentation")}</StoryButton>
                    {draftSavedAt ? <small>Saved {new Date(draftSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small> : null}
                  </div>
                </>
              )}
            </AdminPanel>
            <AdminPanel title={studioTab === "story" ? "PLAYER PREVIEW" : "PRESENTATION PREVIEW"} className="studio-preview-panel">
              {studioTab === "story" ? (
                <>
                  <div className="player-preview" aria-label="Player preview">
                    <p className="player-preview-signal">LORESIGHT // SCENE READY</p>
                    <h2>{scene.title.trim() || "Untitled scene"}</h2>
                    {scene.text.split("\n").filter(Boolean).map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
                    <div className="player-preview-choice"><AdminIcon name="play" /><span>Player choices appear here during a playtest.</span></div>
                  </div>
                  <section className="engine-understood">
                    <p className="kicker">What the engine understood</p>
                    <p><strong>Must land:</strong> {scene.establish.split("\n").filter(Boolean).length || 0} story {scene.establish.split("\n").filter(Boolean).length === 1 ? "point" : "points"}.</p>
                    <p><strong>Exact:</strong> {scene.exact.trim() ? "One or more lines stay unchanged." : "No wording is locked yet."}</p>
                    <p><strong>Protected:</strong> {scene.never.split("\n").filter(Boolean).length || 0} {scene.never.split("\n").filter(Boolean).length === 1 ? "boundary" : "boundaries"}.</p>
                  </section>
                  {!compileResult ? <p className="preview-note"><AdminIcon name="check" /> Check the scene when the meaning looks right.</p> : <DraftResult result={compileResult} />}
                </>
              ) : (
                <>
                  <div className="enhancement-preview" aria-label="Presentation preview">
                    <p className="player-preview-signal">LORESIGHT // PRESENTATION LAYER</p>
                    <h2>{scene.title.trim() || "Untitled scene"}</h2>
                    <p>{enhancements.shell === "authored" ? "This world uses an authored surround around the terminal." : "This world keeps the default CRT shell."}</p>
                    <ul className="enhancement-preview-list">
                      {enhancementRows(enhancements).map((item) => (
                        <li key={item.label}>
                          <strong>{item.label}</strong>
                          <span>{item.value}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="player-preview-choice"><AdminIcon name="check" /><span>{enhancements.notes}</span></div>
                  </div>
                  <section className="engine-understood">
                    <p className="kicker">What still stays true</p>
                    <p>The story should still be playable as plain text if audio, motion, or imagery is turned off.</p>
                    <p>The enhancements only add atmosphere, recovery, and clarity.</p>
                  </section>
                  <p className="preview-note"><AdminIcon name="world" /> Test the presentation without changing the underlying story draft.</p>
                </>
              )}
            </AdminPanel>
          </div>
        </section>
      ) : null}

      {view === "artifacts" ? (
        <section className="page-stack">
          <div className="page-heading"><div><h2>Clues and story objects</h2><p>Graphics add atmosphere. The text always carries the meaning.</p></div></div>
          {artifacts.length === 0 ? <EmptyState icon="clues" title="No clues yet" copy="Visual clues will appear here when a story includes them." /> : (
            <div className="artifact-admin-grid">
              {artifacts.map((artifact) => (
                <article key={`${artifact.worldId}:${artifact.id}`} className="artifact-preview">
                  <div className={`artifact-visual artifact-${artifact.kind}`} role="img" aria-label={artifact.altText}>
                    <AdminIcon name={artifactIconName(artifact.kind)} size={52} />
                  </div>
                  <div>
                    <p className="kicker">{artifact.kind}</p>
                    <h2>{artifact.title}</h2>
                    <p>{artifact.summary}</p>
                    {artifact.caption ? <small>{artifact.caption}</small> : null}
                    <details className="technical-details"><summary>Clue text and details</summary><p>{artifact.altText}</p>{artifact.textFallback.map((line) => <p key={line}>{line}</p>)}<code>{artifact.asset?.key ?? "text-only"}</code></details>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {view === "runbook" && overview ? (
        <section className="page-stack">
          <div className="page-heading"><div><h2>When something goes wrong</h2><p>Start with the situation that sounds most like what you see.</p></div></div>
          <ul className="runbook-list">
            {overview.scenarios.map((scenario) => <li key={scenario.id}><AdminIcon name="help" size={24} /><div><h2>{scenario.label}</h2><p>{scenario.response}</p></div></li>)}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function DraftResult({ result }: { result: Record<string, unknown> }) {
  const ok = result.ok !== false;
  return (
    <div className={`draft-result ${ok ? "is-good" : "is-error"}`}>
      <AdminIcon name={ok ? "check" : "error"} size={36} />
      <h2>{ok ? "This draft is ready to test." : "This draft needs attention."}</h2>
      <p>{ok ? "The story structure passed its checks." : String(result.error ?? "Review the reported story problem and try again.")}</p>
      <details className="technical-details"><summary>Show technical result</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
    </div>
  );
}

function EmptyState({ icon, title, copy }: { icon: AdminIconName; title: string; copy: string }) {
  return <div className="empty-state"><AdminIcon name={icon} size={32} /><h2>{title}</h2><p>{copy}</p></div>;
}

function SessionList({ sessions, active, worldTitles, onOpen }: { sessions: SessionSummary[]; active?: string; worldTitles?: Map<string, string>; onOpen: (id: string) => Promise<void> }) {
  if (sessions.length === 0) return <EmptyState icon="playtests" title="No playtests yet" copy="Start one from Home when you are ready." />;
  return (
    <ul className="session-list">
      {sessions.map((session) => (
        <li key={session.sessionId}>
          <button className={active === session.sessionId ? "active" : ""} onClick={() => void onOpen(session.sessionId)}>
            <AdminIcon name="playtests" />
            <span><strong>{worldTitles?.get(session.worldId) ?? session.worldId}</strong><small>{session.status === "complete" ? "Finished" : "In progress"} · Started {new Date(session.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></span>
            {session.issueCount ? <span className="issue-count" aria-label={`${session.issueCount} story problems`}>{session.issueCount}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><StoryframeTheme><AdminConsole /></StoryframeTheme></React.StrictMode>);

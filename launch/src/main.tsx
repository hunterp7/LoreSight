import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type StepStatus = "ready" | "working" | "done";

type LaunchStep = {
  id: string;
  number: number;
  title: string;
  explanation: string;
  buttonLabel: string;
  command: string;
  success: string;
};

const STEPS: LaunchStep[] = [
  {
    id: "check",
    number: 1,
    title: "Check the code",
    explanation: "Look for typing mistakes and broken pieces.",
    buttonLabel: "Run a practice check",
    command: "npm run check",
    success: "Practice check passed. The code looks tidy.",
  },
  {
    id: "test",
    number: 2,
    title: "Try every test",
    explanation: "Make sure the important parts still work.",
    buttonLabel: "Run practice tests",
    command: "npm test",
    success: "Practice tests passed. Nothing important broke.",
  },
  {
    id: "build",
    number: 3,
    title: "Pack the app",
    explanation: "Turn the project into files a server can use.",
    buttonLabel: "Make a practice build",
    command: "npm run build",
    success: "Practice build finished. LoreSight is packed and ready.",
  },
  {
    id: "preview",
    number: 4,
    title: "Open a preview",
    explanation: "Start LoreSight on this computer so we can look at it.",
    buttonLabel: "Start a pretend preview",
    command: "npm run dev",
    success: "Pretend preview started at http://127.0.0.1:8787/widget.",
  },
  {
    id: "link",
    number: 5,
    title: "Make a test link",
    explanation: "Give ChatGPT a safe temporary door to the preview.",
    buttonLabel: "Make a pretend link",
    command: "npm run chatgpt:tunnel",
    success: "Pretend test link is ready. It ends with /mcp.",
  },
  {
    id: "publish",
    number: 6,
    title: "Publish the app",
    explanation: "Send an approved version to the public server.",
    buttonLabel: "Practice publishing",
    command: "git push origin main  →  Render deploys it",
    success: "Pretend publish finished. No real server was changed.",
  },
];

const INITIAL_STATUS = Object.fromEntries(STEPS.map((step) => [step.id, "ready"])) as Record<string, StepStatus>;

function LaunchPad() {
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>(INITIAL_STATUS);
  const [activeStep, setActiveStep] = useState<LaunchStep>(STEPS[0]);
  const [message, setMessage] = useState("Choose a card. We will practice one safe step at a time.");

  const doneCount = useMemo(() => Object.values(statuses).filter((status) => status === "done").length, [statuses]);
  const nextStep = STEPS.find((step) => statuses[step.id] !== "done") ?? STEPS[STEPS.length - 1];

  function practice(step: LaunchStep) {
    if (statuses[step.id] === "working") return;
    setActiveStep(step);
    setStatuses((current) => ({ ...current, [step.id]: "working" }));
    setMessage(`Practicing step ${step.number}: ${step.title.toLowerCase()}…`);
    window.setTimeout(() => {
      setStatuses((current) => ({ ...current, [step.id]: "done" }));
      setMessage(step.success);
    }, 650);
  }

  function reset() {
    setStatuses(INITIAL_STATUS);
    setActiveStep(STEPS[0]);
    setMessage("Practice reset. Nothing on a real server was changed.");
  }

  return (
    <main className="launch-shell">
      <header className="launch-header">
        <div>
          <p className="eyebrow">LoreSight practice tool</p>
          <h1>Launch Pad</h1>
          <p className="lede">Learn how to check, test, and publish LoreSight—without touching the real app.</p>
        </div>
        <div className="practice-badge" role="status"><span aria-hidden="true">●</span> Practice only</div>
      </header>

      <section className="safety-note" aria-label="Safety notice">
        <strong>Nothing here is real.</strong>
        <span>These buttons only show what would happen. They cannot run commands, spend money, or publish LoreSight.</span>
      </section>

      <section className="progress-card" aria-labelledby="progress-title">
        <div>
          <p className="eyebrow" id="progress-title">Your practice trip</p>
          <strong>{doneCount} of {STEPS.length} steps finished</strong>
        </div>
        <div className="progress-track" aria-hidden="true"><span style={{ width: `${(doneCount / STEPS.length) * 100}%` }} /></div>
        <button className="next-button" type="button" onClick={() => practice(nextStep)}>{doneCount === STEPS.length ? "Practice the last step again" : `Do step ${nextStep.number}`}</button>
      </section>

      <section className="step-grid" aria-label="Practice deployment steps">
        {STEPS.map((step) => {
          const status = statuses[step.id];
          return (
            <article className={`step-card is-${status}`} key={step.id}>
              <div className="step-topline">
                <span className="step-number">{step.number}</span>
                <span className="step-status">{status === "done" ? "Done" : status === "working" ? "Working…" : "Ready"}</span>
              </div>
              <h2>{step.title}</h2>
              <p>{step.explanation}</p>
              <button type="button" onClick={() => practice(step)} disabled={status === "working"}>{status === "done" ? "Practice again" : step.buttonLabel}</button>
            </article>
          );
        })}
      </section>

      <section className="computer-card" aria-live="polite">
        <div className="computer-copy">
          <p className="eyebrow">What the computer would type</p>
          <h2>{activeStep.title}</h2>
          <p>{message}</p>
        </div>
        <code>{activeStep.command}</code>
      </section>

      <footer>
        <button className="reset-button" type="button" onClick={reset}>Reset practice</button>
        <p>When this feels easy, we can connect each approved button to a guarded real operation.</p>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<LaunchPad />);

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT_LIMIT = 120_000;
const JOB_TIMEOUT_MS = 5 * 60_000;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

type DevopsStep = { label: string; args: string[] };

export type DevopsAction = {
  id: string;
  title: string;
  description: string;
  command: string;
  steps: DevopsStep[];
};

export type DevopsJobStatus = "running" | "passed" | "failed" | "timed_out";

export type DevopsJob = {
  id: string;
  actionId: string;
  title: string;
  status: DevopsJobStatus;
  output: string;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
};

export const DEVOPS_ACTIONS: readonly DevopsAction[] = [
  {
    id: "check",
    title: "Check the code",
    description: "Looks for TypeScript and wiring mistakes without changing files.",
    command: "npm run check",
    steps: [{ label: "Code check", args: ["run", "check"] }],
  },
  {
    id: "test",
    title: "Run all tests",
    description: "Exercises the engine rules, replay safety, projections, and server behavior.",
    command: "npm test",
    steps: [{ label: "Tests", args: ["test"] }],
  },
  {
    id: "build",
    title: "Build the app",
    description: "Creates fresh production files for the player, admin, launch pad, and server.",
    command: "npm run build",
    steps: [{ label: "Production build", args: ["run", "build"] }],
  },
  {
    id: "smoke",
    title: "Test the running app",
    description: "Connects to the local MCP server and checks the real ChatGPT app loop.",
    command: "npm run smoke",
    steps: [{ label: "MCP smoke test", args: ["run", "smoke"] }],
  },
  {
    id: "submission",
    title: "Check app submission",
    description: "Checks the files and metadata needed for the ChatGPT app directory.",
    command: "npm run check:submission:live",
    steps: [{ label: "Live submission check", args: ["run", "check:submission:live"] }],
  },
  {
    id: "release-check",
    title: "Run the release checklist",
    description: "Runs the important checks in order. This verifies a release but does not publish it.",
    command: "check → test → build → smoke → submission",
    steps: [
      { label: "Code check", args: ["run", "check"] },
      { label: "Tests", args: ["test"] },
      { label: "Production build", args: ["run", "build"] },
      { label: "MCP smoke test", args: ["run", "smoke"] },
      { label: "Submission check", args: ["run", "check:submission:live"] },
    ],
  },
] as const;

const jobs = new Map<string, DevopsJob>();
let activeJobId = "";

function appendOutput(job: DevopsJob, chunk: string): void {
  job.output += chunk.replace(/\u001b\[[0-9;]*m/g, "");
  if (job.output.length > OUTPUT_LIMIT) {
    job.output = `[Earlier output removed to keep this page responsive.]\n${job.output.slice(-OUTPUT_LIMIT)}`;
  }
}

function trimHistory(): void {
  const completed = [...jobs.values()]
    .filter((job) => job.status !== "running")
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  for (const job of completed.slice(20)) jobs.delete(job.id);
}

async function runStep(job: DevopsJob, step: DevopsStep): Promise<number> {
  appendOutput(job, `\n=== ${step.label} ===\n$ npm ${step.args.join(" ")}\n\n`);
  return await new Promise<number>((finish) => {
    const child = spawn(npmCommand, step.args, {
      cwd: projectRoot,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      job.status = "timed_out";
      appendOutput(job, `\nStopped after ${JOB_TIMEOUT_MS / 60_000} minutes.\n`);
    }, JOB_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => appendOutput(job, chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => appendOutput(job, chunk.toString("utf8")));
    child.on("error", (error) => {
      clearTimeout(timer);
      appendOutput(job, `\nCould not start command: ${error.message}\n`);
      finish(1);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish(code ?? 1);
    });
  });
}

async function runJob(job: DevopsJob, action: DevopsAction): Promise<void> {
  try {
    for (const step of action.steps) {
      const exitCode = await runStep(job, step);
      job.exitCode = exitCode;
      if (job.status === "timed_out" || exitCode !== 0) {
        if (job.status !== "timed_out") job.status = "failed";
        appendOutput(job, `\n${step.label} did not pass (exit ${exitCode}).\n`);
        return;
      }
      appendOutput(job, `\n${step.label} passed.\n`);
    }
    job.status = "passed";
    job.exitCode = 0;
    appendOutput(job, "\nAll requested steps passed.\n");
  } finally {
    job.finishedAt = new Date().toISOString();
    if (activeJobId === job.id) activeJobId = "";
    trimHistory();
  }
}

export function devopsActions(): Array<Omit<DevopsAction, "steps">> {
  return DEVOPS_ACTIONS.map(({ steps: _steps, ...action }) => action);
}

export function startDevopsJob(actionId: string): DevopsJob {
  const action = DEVOPS_ACTIONS.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error("That operation is not available.");
  if (activeJobId) throw new Error("Another operation is already running. Wait for it to finish.");
  const job: DevopsJob = {
    id: randomUUID(),
    actionId: action.id,
    title: action.title,
    status: "running",
    output: "",
    startedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  activeJobId = job.id;
  void runJob(job, action);
  return job;
}

export function getDevopsJob(jobId: string): DevopsJob | undefined {
  return jobs.get(jobId);
}

export function devopsIsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.STORYFRAME_DEVOPS_ENABLED === "true";
}

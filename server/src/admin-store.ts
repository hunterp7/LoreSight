import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DomainEvent, GameState } from "@storyframe/world-schema";

export interface StoredPlaytest {
  worldId: string;
  worldVersion: string;
  initialState: GameState;
  state: GameState;
  events: DomainEvent[];
  startedAt: string;
}

export interface StoredCorrectionProposal {
  id: string;
  createdAt: string;
  sessionId: string;
  forkAtVersion: number;
  intentId: string;
  reason: string;
  status: string;
  differences: unknown[];
}

export interface StoredDraft {
  id: string;
  title: string;
  source: string;
  updatedAt: string;
  compileStatus: "ready" | "error";
  enhancements?: {
    shell: "default-crt" | "authored";
    audio: "off" | "on";
    imagery: "text-first" | "occasional" | "rich";
    motion: "calm" | "subtle" | "alive";
    guidance: "minimal" | "balanced" | "hands-on";
    notes?: string;
  };
}

export interface AdminStoreSnapshot {
  formatVersion: 1;
  playtests: StoredPlaytest[];
  correctionProposals: StoredCorrectionProposal[];
  drafts: StoredDraft[];
}

export const EMPTY_ADMIN_STORE: AdminStoreSnapshot = {
  formatVersion: 1,
  playtests: [],
  correctionProposals: [],
  drafts: [],
};

function isSnapshot(value: unknown): value is AdminStoreSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.formatVersion === 1 && Array.isArray(item.playtests) &&
    Array.isArray(item.correctionProposals) && Array.isArray(item.drafts);
}

export class JsonAdminStore {
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(readonly filePath: string) {}

  async load(): Promise<AdminStoreSnapshot> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      if (!isSnapshot(parsed)) throw new Error("Unsupported StoryFrame admin data format.");
      return structuredClone(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_ADMIN_STORE);
      throw error;
    }
  }

  async save(snapshot: AdminStoreSnapshot): Promise<void> {
    const next = structuredClone(snapshot);
    this.saveQueue = this.saveQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, this.filePath);
    });
    return this.saveQueue;
  }
}

import { randomUUID } from "node:crypto";

export type LoreSightSession = {
  id: string;
  ownerId: string;
  storyId?: string;
  storyTitle?: string;
  stateVersion: number;
  status: "active" | "complete";
  transcript: string[];
  createdAt: string;
};

const sessions = new Map<string, LoreSightSession>();

export const storyLibrary = [
  { id: "sample-figaro", title: "Figaro", author: "Victor Gijsbers", format: "zblorb", source: "Bundled sample" },
  { id: "zork-1", title: "Zork I", author: "Infocom", format: "z3", source: "Z-code catalog" },
  { id: "hitchhikers-guide", title: "The Hitchhiker's Guide to the Galaxy", author: "Infocom", format: "z3", source: "Z-code catalog" },
  { id: "planetfall", title: "Planetfall", author: "Infocom", format: "z3", source: "Z-code catalog" },
  { id: "dreamhold", title: "Dreamhold", author: "Andrew Plotkin", format: "z8", source: "Z-code catalog" },
  { id: "varicella", title: "Varicella", author: "Adam Thornton", format: "z8", source: "Z-code catalog" },
] as const;

export function createSession(ownerId: string): LoreSightSession {
  const session: LoreSightSession = {
    id: randomUUID(),
    ownerId,
    stateVersion: 0,
    status: "active",
    transcript: ["LoreSight is ready. Choose a story from the terminal, then type commands as you play."],
    createdAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  return structuredClone(session);
}

export function getSession(sessionId: string, ownerId: string): LoreSightSession {
  const session = sessions.get(sessionId);
  if (!session || session.ownerId !== ownerId) throw new Error("LoreSight session not found.");
  return structuredClone(session);
}

export function selectStory(sessionId: string, ownerId: string, storyId: string): LoreSightSession {
  const session = sessions.get(sessionId);
  if (!session || session.ownerId !== ownerId) throw new Error("LoreSight session not found.");
  const story = storyLibrary.find((candidate) => candidate.id === storyId);
  if (!story) throw new Error("That story is not in the LoreSight library.");
  session.storyId = story.id;
  session.storyTitle = story.title;
  session.stateVersion += 1;
  session.transcript.push(`Loaded ${story.title}. The interpreter is ready for your first command.`);
  return structuredClone(session);
}

export function submitCommand(input: {
  sessionId: string;
  ownerId: string;
  command: string;
  expectedStateVersion: number;
}): { session: LoreSightSession; status: "committed" | "rejected"; message?: string } {
  const session = sessions.get(input.sessionId);
  if (!session || session.ownerId !== input.ownerId) throw new Error("LoreSight session not found.");
  if (session.stateVersion !== input.expectedStateVersion) {
    return { session: structuredClone(session), status: "rejected", message: "The story changed. Refresh the terminal and try again." };
  }
  const command = input.command.trim();
  if (!command) return { session: structuredClone(session), status: "rejected", message: "Enter a command to continue." };
  session.transcript.push(`> ${command}`);
  session.stateVersion += 1;
  return { session: structuredClone(session), status: "committed" };
}


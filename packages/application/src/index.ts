import { createSession, replay, resolveTurn } from "@storyframe/engine-core";
import type {
  StorySessionRepository,
  StoredStorySession,
  WorldReleaseRepository,
} from "@storyframe/persistence";
import { projectPlayerView, type PlayerView } from "@storyframe/projections";
import type { ResolveTurnResult, StoryCommand } from "@storyframe/world-schema";

export type StoryScope =
  | "story:sessions:read"
  | "story:sessions:write"
  | "story:worlds:read"
  | "story:worlds:write"
  | "story:worlds:publish";

export interface ActorContext {
  subjectId: string;
  scopes: StoryScope[];
  traceId?: string;
}

export interface ApplicationClock {
  now(): string;
}

export interface StartStoryInput {
  actor: ActorContext;
  sessionId: string;
  worldId: string;
  worldVersion: string;
  seed: number;
}

export interface SubmitIntentInput {
  actor: ActorContext;
  sessionId: string;
  command: StoryCommand;
  expectedStateVersion: number;
  mutationId: string;
}

export class StoryAccessError extends Error {
  readonly code = "access-denied";
}

export class StoryNotFoundError extends Error {
  readonly code = "not-found";
}

export class StoryIntegrityError extends Error {
  readonly code = "integrity-failure";
}

export type SubmitIntentApplicationResult =
  | { status: "committed" | "duplicate"; view: PlayerView; engine: ResolveTurnResult }
  | { status: "rejected"; view: PlayerView; engine: ResolveTurnResult }
  | { status: "conflict"; view: PlayerView };

function requireScope(actor: ActorContext, scope: StoryScope): void {
  if (!actor.subjectId.trim() || !actor.scopes.includes(scope)) {
    throw new StoryAccessError(`The authenticated subject lacks ${scope}.`);
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class StoryApplicationService {
  constructor(
    private readonly sessions: StorySessionRepository,
    private readonly releases: WorldReleaseRepository,
    private readonly clock: ApplicationClock,
  ) {}

  async startStory(input: StartStoryInput): Promise<PlayerView> {
    requireScope(input.actor, "story:sessions:write");
    const release = await this.releases.getRelease(input.worldId, input.worldVersion);
    if (!release) throw new StoryNotFoundError("The requested published world release was not found.");
    const state = createSession(release.world, {
      sessionId: input.sessionId,
      ownerId: input.actor.subjectId,
      seed: input.seed,
    });
    const createdAt = this.clock.now();
    const stored: StoredStorySession = {
      sessionId: state.sessionId,
      ownerId: state.ownerId,
      worldId: state.worldId,
      worldVersion: state.worldVersion,
      engineVersion: state.engineVersion,
      initialState: state,
      state,
      events: [],
      createdAt,
      updatedAt: createdAt,
    };
    const result = await this.sessions.create(stored);
    if (result === "existing") {
      const existing = await this.sessions.getOwned(input.actor.subjectId, input.sessionId);
      if (!existing) throw new StoryNotFoundError("The story session was not found.");
      return this.projectVerified(existing, release.world);
    }
    if (result !== "created") throw new StoryIntegrityError(`Unexpected create result: ${result}.`);
    return projectPlayerView(release.world, state);
  }

  async getStory(actor: ActorContext, sessionId: string): Promise<PlayerView> {
    requireScope(actor, "story:sessions:read");
    const { session, world } = await this.loadOwned(actor.subjectId, sessionId);
    return this.projectVerified(session, world);
  }

  async submitIntent(input: SubmitIntentInput): Promise<SubmitIntentApplicationResult> {
    requireScope(input.actor, "story:sessions:write");
    const { session, world } = await this.loadOwned(input.actor.subjectId, input.sessionId);
    this.verifyReplay(session, world);
    const engine = resolveTurn({
      world,
      state: session.state,
      command: input.command,
      expectedStateVersion: input.expectedStateVersion,
      mutationId: input.mutationId,
    });
    if (engine.status === "rejected") {
      return { status: "rejected", view: projectPlayerView(world, engine.state), engine };
    }
    if (engine.status === "duplicate") {
      return { status: "duplicate", view: projectPlayerView(world, engine.state), engine };
    }
    const committed = await this.sessions.commitTurn({
      ownerId: input.actor.subjectId,
      sessionId: input.sessionId,
      expectedStateVersion: input.expectedStateVersion,
      state: engine.state,
      events: engine.events,
      committedAt: this.clock.now(),
    });
    if (committed === "conflict") {
      const latest = await this.sessions.getOwned(input.actor.subjectId, input.sessionId);
      if (!latest) throw new StoryNotFoundError("The story session was not found.");
      return { status: "conflict", view: this.projectVerified(latest, world) };
    }
    if (committed !== "created") throw new StoryNotFoundError("The story session was not found.");
    return { status: "committed", view: projectPlayerView(world, engine.state), engine };
  }

  private async loadOwned(ownerId: string, sessionId: string) {
    const session = await this.sessions.getOwned(ownerId, sessionId);
    if (!session) throw new StoryNotFoundError("The story session was not found.");
    const release = await this.releases.getRelease(session.worldId, session.worldVersion);
    if (!release) throw new StoryIntegrityError("The session's pinned world release is unavailable.");
    return { session, world: release.world };
  }

  private verifyReplay(session: StoredStorySession, world: Parameters<typeof replay>[0]): void {
    const replayed = replay(world, session.initialState, session.events);
    if (!sameJson(replayed, session.state)) {
      throw new StoryIntegrityError("Stored state does not match deterministic event replay.");
    }
  }

  private projectVerified(
    session: StoredStorySession,
    world: Parameters<typeof projectPlayerView>[0],
  ): PlayerView {
    this.verifyReplay(session, world);
    return projectPlayerView(world, session.state);
  }
}

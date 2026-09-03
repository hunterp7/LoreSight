import { getAvailableIntents } from "@storyframe/engine-core";
import type {
  Audience,
  ArtifactDefinition,
  CanonFact,
  CharacterLedgerEntry,
  GameState,
  SessionStatus,
  WorldPack,
} from "@storyframe/world-schema";

export interface IntentView {
  id: string;
  title: string;
  description: string;
}

export interface CanonView {
  id: string;
  classification: CanonFact["classification"];
  statement: string;
}

export interface ArtifactView {
  id: string;
  kind: ArtifactDefinition["kind"];
  title: string;
  summary: string;
  caption?: string;
  altText: string;
  textFallback: string[];
  presentation: ArtifactDefinition["presentation"];
  clueId?: string;
  asset?: ArtifactDefinition["asset"];
}

export interface SafeStateView {
  sessionId: string;
  worldId: string;
  worldVersion: string;
  stateVersion: number;
  turn: number;
  status: SessionStatus;
  frameId: string;
  locationId?: string;
  flags: Record<string, boolean>;
  resources: Record<string, number>;
  clocks: Record<string, number>;
  relationships: Record<string, number>;
  inventory: Record<string, number>;
  clues: string[];
  knowledge: string[];
}

export interface PlayerView {
  audience: "player";
  state: SafeStateView;
  canon: CanonView[];
  artifacts: ArtifactView[];
  characterLedger: CharacterLedgerEntry[];
  availableIntents: IntentView[];
}

export interface ModelView {
  audience: "model";
  state: SafeStateView;
  canon: CanonView[];
  artifacts: ArtifactView[];
  characterLedger: CharacterLedgerEntry[];
  availableIntents: IntentView[];
  directives: Array<{ canonId: string; instruction: string }>;
}

export interface CreatorView {
  audience: "creator";
  state: GameState;
  canon: CanonFact[];
  artifacts: ArtifactDefinition[];
  characterLedger: CharacterLedgerEntry[];
  availableIntents: IntentView[];
}

export interface DebugView {
  audience: "debug";
  state: GameState;
  world: WorldPack;
  characterLedger: CharacterLedgerEntry[];
  availableIntents: IntentView[];
}

export type ViewModel = PlayerView | ModelView | CreatorView | DebugView;

function copy<T>(value: T): T {
  return structuredClone(value);
}

function audienceCanSee(audiences: Audience[], audience: Audience): boolean {
  return audience === "creator" || audience === "debug" || audiences.includes(audience);
}

function filterRecord<T>(
  values: Record<string, T>,
  definitions: Record<string, { audiences: Audience[] }> | undefined,
  audience: Audience,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([id]) => {
        const definition = definitions?.[id];
        return definition ? audienceCanSee(definition.audiences, audience) : false;
      })
      .map(([id, value]) => [id, copy(value)]),
  );
}

function filterIds(
  values: string[],
  definitions: Record<string, { audiences: Audience[] }> | undefined,
  audience: Audience,
): string[] {
  return values.filter((id) => {
    const definition = definitions?.[id];
    return definition ? audienceCanSee(definition.audiences, audience) : false;
  });
}

function projectState(world: WorldPack, state: GameState, audience: Audience): SafeStateView {
  const initial = world.initialState;
  return {
    sessionId: state.sessionId,
    worldId: state.worldId,
    worldVersion: state.worldVersion,
    stateVersion: state.stateVersion,
    turn: state.turn,
    status: state.status,
    frameId: state.frameId,
    locationId: state.locationId,
    flags: filterRecord(state.flags, initial.flags, audience),
    resources: filterRecord(state.resources, initial.resources, audience),
    clocks: filterRecord(state.clocks, initial.clocks, audience),
    relationships: filterRecord(state.relationships, initial.relationships, audience),
    inventory: filterRecord(state.inventory, initial.inventory, audience),
    clues: filterIds(state.clues, initial.clues, audience),
    knowledge: filterIds(state.knowledge, initial.knowledge, audience),
  };
}

function isCanonVisible(fact: CanonFact, state: GameState, audience: Audience): boolean {
  if (audience === "creator" || audience === "debug") return true;
  if (!audienceCanSee(fact.audiences, audience)) return false;
  if (fact.classification === "secret" || fact.classification === "branch") {
    return state.revealedCanonIds.includes(fact.id);
  }
  return fact.classification === "locked" || fact.classification === "open";
}

function projectCanon(world: WorldPack, state: GameState, audience: Audience): CanonView[] {
  return world.canon
    .filter((fact) => isCanonVisible(fact, state, audience))
    .map((fact) => ({
      id: fact.id,
      classification: fact.classification,
      statement: fact.statement,
    }));
}

function projectArtifacts(
  world: WorldPack,
  state: GameState,
  audience: Audience,
): ArtifactView[] {
  return (world.artifacts ?? [])
    .filter((artifact) => {
      if (audience === "creator" || audience === "debug") return true;
      return (
        state.revealedArtifactIds.includes(artifact.id) &&
        audienceCanSee(artifact.audiences, audience)
      );
    })
    .map((artifact) => {
      const projected: ArtifactView = {
        id: artifact.id,
        kind: artifact.kind,
        title: artifact.title,
        summary: artifact.summary,
        caption: artifact.caption,
        altText: artifact.altText,
        textFallback: copy(artifact.textFallback),
        presentation: artifact.presentation,
        clueId: artifact.clueId,
        asset: audience === "model" ? undefined : copy(artifact.asset),
      };
      return projected;
    });
}

function projectLedger(state: GameState, audience: Audience): CharacterLedgerEntry[] {
  return state.characterLedger
    .filter((entry) => audienceCanSee(entry.audiences, audience))
    .map(copy);
}

function projectIntents(world: WorldPack, state: GameState): IntentView[] {
  return getAvailableIntents(world, state).map(({ id, title, description }) => ({
    id,
    title,
    description,
  }));
}

export function projectPlayerView(world: WorldPack, state: GameState): PlayerView {
  return {
    audience: "player",
    state: projectState(world, state, "player"),
    canon: projectCanon(world, state, "player"),
    artifacts: projectArtifacts(world, state, "player"),
    characterLedger: projectLedger(state, "player"),
    availableIntents: projectIntents(world, state),
  };
}

export function projectModelView(world: WorldPack, state: GameState): ModelView {
  return {
    audience: "model",
    state: projectState(world, state, "model"),
    canon: projectCanon(world, state, "model"),
    artifacts: projectArtifacts(world, state, "model"),
    characterLedger: projectLedger(state, "model"),
    availableIntents: projectIntents(world, state),
    directives: world.canon
      .filter(
        (fact) =>
          fact.modelDirective &&
          (fact.classification === "never" ||
            fact.classification === "unsaid" ||
            isCanonVisible(fact, state, "model")),
      )
      .map((fact) => ({ canonId: fact.id, instruction: fact.modelDirective! })),
  };
}

export function projectCreatorView(world: WorldPack, state: GameState): CreatorView {
  return {
    audience: "creator",
    state: copy(state),
    canon: copy(world.canon),
    artifacts: copy(world.artifacts ?? []),
    characterLedger: projectLedger(state, "creator"),
    availableIntents: projectIntents(world, state),
  };
}

export function projectDebugView(world: WorldPack, state: GameState): DebugView {
  return {
    audience: "debug",
    state: copy(state),
    world: copy(world),
    characterLedger: projectLedger(state, "debug"),
    availableIntents: projectIntents(world, state),
  };
}

export function projectView(world: WorldPack, state: GameState, audience: Audience): ViewModel {
  switch (audience) {
    case "player":
      return projectPlayerView(world, state);
    case "model":
      return projectModelView(world, state);
    case "creator":
      return projectCreatorView(world, state);
    case "debug":
      return projectDebugView(world, state);
  }
}

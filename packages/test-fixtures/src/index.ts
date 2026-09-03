import type { WorldPack } from "@storyframe/world-schema";

const rights = {
  classification: "original" as const,
  owner: "Storyframe conformance suite",
};

function sourceEntry(
  semanticId: string,
  kind: "canon" | "frame" | "intent" | "rule",
  line: number,
) {
  return {
    semanticId,
    kind,
    range: {
      sourceId: "fixtures/investigation.storyframe",
      start: { line, column: 1, offset: line * 100 },
      end: { line, column: 80, offset: line * 100 + 79 },
    },
  } as const;
}

export const investigationWorld: WorldPack = {
  manifest: {
    id: "conformance.investigation",
    version: "1.0.0",
    title: "The Missing Ledger",
    engineVersion: "0.1.0",
    rights,
  },
  initialState: {
    frameId: "investigate",
    locationId: "archive",
    flags: {
      internal_route_selected: { initial: false, audiences: ["creator", "debug"] },
    },
    clues: {
      red_thread: { initial: false, audiences: ["player", "model", "creator", "debug"] },
      broken_seal: { initial: false, audiences: ["player", "model", "creator", "debug"] },
      false_date: { initial: false, audiences: ["player", "model", "creator", "debug"] },
    },
  },
  canon: [
    {
      id: "archive_is_locked",
      classification: "locked",
      statement: "The archive was locked overnight.",
      audiences: ["player", "model", "creator", "debug"],
    },
    {
      id: "culprit",
      classification: "secret",
      statement: "The caretaker forged the missing ledger.",
      audiences: ["player", "model", "creator", "debug"],
      modelDirective: "Do not identify the culprit until the engine reveals that fact.",
    },
    {
      id: "patron_identity",
      classification: "unsaid",
      statement: "The archive patron's identity is intentionally unresolved.",
      audiences: ["creator", "debug"],
      modelDirective: "Do not invent the archive patron's identity.",
    },
  ],
  characters: [{ id: "caretaker", name: "The Caretaker", role: "Archive custodian" }],
  intents: [
    {
      id: "inspect_red_thread",
      title: "Inspect the red thread",
      description: "Examine the red thread caught in the ledger cabinet.",
      availableInFrames: ["investigate"],
      when: { kind: "clue", clueId: "red_thread", present: false },
      effects: [
        { kind: "add-clue", clueId: "red_thread" },
        {
          kind: "add-ledger-entry",
          entry: {
            id: "caretaker-private-motive",
            subjectId: "caretaker",
            kind: "fact",
            statement: "The caretaker forged the missing ledger.",
            truth: "true",
            audiences: ["creator", "debug"],
          },
        },
        {
          kind: "add-ledger-entry",
          entry: {
            id: "caretaker-observed",
            subjectId: "caretaker",
            kind: "fact",
            statement: "The caretaker watched the inspection carefully.",
            truth: "true",
            audiences: ["player", "model", "creator", "debug"],
          },
        },
      ],
    },
    {
      id: "inspect_broken_seal",
      title: "Inspect the broken seal",
      description: "Examine the wax seal on the archive door.",
      availableInFrames: ["investigate"],
      when: { kind: "clue", clueId: "broken_seal", present: false },
      effects: [{ kind: "add-clue", clueId: "broken_seal" }],
    },
    {
      id: "inspect_false_date",
      title: "Cross-check the date",
      description: "Compare the ledger date with the archive clock.",
      availableInFrames: ["investigate"],
      when: { kind: "clue", clueId: "false_date", present: false },
      effects: [{ kind: "add-clue", clueId: "false_date" }],
    },
  ],
  rules: [
    {
      id: "reveal_culprit_after_three_clues",
      once: true,
      when: { kind: "clue-count", operator: "gte", value: 3 },
      effects: [
        { kind: "reveal-canon", canonId: "culprit" },
        { kind: "transition", frameId: "resolution" },
      ],
    },
  ],
  sourceMap: {
    "canon:culprit": sourceEntry("culprit", "canon", 12),
    "frame:investigate": sourceEntry("investigate", "frame", 20),
    "frame:resolution": sourceEntry("resolution", "frame", 21),
    "intent:inspect_red_thread": sourceEntry("inspect_red_thread", "intent", 30),
    "intent:inspect_broken_seal": sourceEntry("inspect_broken_seal", "intent", 40),
    "intent:inspect_false_date": sourceEntry("inspect_false_date", "intent", 50),
    "rule:reveal_culprit_after_three_clues": sourceEntry(
      "reveal_culprit_after_three_clues",
      "rule",
      60,
    ),
  },
};

export const survivalWorld: WorldPack = {
  manifest: {
    id: "conformance.survival",
    version: "1.0.0",
    title: "Dust Road",
    engineVersion: "0.1.0",
    rights,
  },
  initialState: {
    frameId: "road",
    locationId: "mile-zero",
    resources: {
      supplies: { initial: 3, min: 0, max: 5, audiences: ["player", "model", "creator", "debug"] },
      health: { initial: 5, min: 0, max: 5, audiences: ["player", "model", "creator", "debug"] },
    },
    clocks: {
      day: { initial: 0, min: 0, max: 10, audiences: ["player", "model", "creator", "debug"] },
    },
    inventory: {
      salvage: { initial: 0, audiences: ["player", "model", "creator", "debug"] },
    },
  },
  canon: [],
  characters: [],
  intents: [
    {
      id: "travel_to_outpost",
      title: "Travel to the outpost",
      description: "Spend one supply and one day to reach the outpost.",
      availableInFrames: ["road"],
      when: { kind: "resource", resourceId: "supplies", operator: "gte", value: 1 },
      effects: [
        { kind: "adjust-resource", resourceId: "supplies", amount: -1 },
        { kind: "advance-clock", clockId: "day", amount: 1 },
        { kind: "set-location", locationId: "outpost" },
        { kind: "transition", frameId: "arrived" },
      ],
    },
    {
      id: "search_for_supplies",
      title: "Search for supplies",
      description: "Make a seeded search for one additional supply.",
      availableInFrames: ["road"],
      effects: [
        {
          kind: "seeded-check",
          checkId: "roadside_cache",
          chanceBasisPoints: 5000,
          onSuccess: [{ kind: "adjust-resource", resourceId: "supplies", amount: 1 }],
          onFailure: [{ kind: "adjust-resource", resourceId: "health", amount: -1 }],
        },
      ],
    },
  ],
};

export const tradingWorld: WorldPack = {
  manifest: {
    id: "conformance.trading",
    version: "1.0.0",
    title: "Lantern Market",
    engineVersion: "0.1.0",
    rights,
  },
  initialState: {
    frameId: "market",
    locationId: "lantern-market",
    resources: {
      credits: { initial: 10, min: 0, max: 100, audiences: ["player", "model", "creator", "debug"] },
    },
    inventory: {
      spice: { initial: 0, audiences: ["player", "model", "creator", "debug"] },
    },
  },
  canon: [],
  characters: [],
  intents: [
    {
      id: "buy_spice",
      title: "Buy spice",
      description: "Spend four credits to buy one unit of spice.",
      availableInFrames: ["market"],
      when: { kind: "resource", resourceId: "credits", operator: "gte", value: 4 },
      effects: [
        { kind: "adjust-resource", resourceId: "credits", amount: -4 },
        { kind: "add-inventory", itemId: "spice", quantity: 1 },
      ],
    },
  ],
};

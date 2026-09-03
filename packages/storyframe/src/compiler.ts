import type {
  Audience,
  CanonClass,
  Condition,
  Effect,
  FramePerformanceContract,
  InitialStateDefinition,
  IntentDefinition,
  ReactiveRule,
  SourceMapEntry,
  SourceRange,
  TweenContract,
  WorldPack,
} from "@storyframe/world-schema";
import type {
  BodyNode,
  CompileResult,
  CompilerDiagnostic,
  DeclarationNode,
  StoryframeDocument,
} from "./ast.js";
import { bodyValues, findProperty, parseStoryframe, propertyValue } from "./parser.js";

const AUDIENCES = new Set<Audience>(["player", "model", "creator", "debug"]);
const COMPARISONS = {
  "==": "eq",
  "!=": "neq",
  ">": "gt",
  ">=": "gte",
  "<": "lt",
  "<=": "lte",
} as const;

interface CompilerContext {
  document: StoryframeDocument;
  diagnostics: CompilerDiagnostic[];
  state: InitialStateDefinition;
  canonIds: Set<string>;
  characterIds: Set<string>;
  frameIds: Set<string>;
  artifactIds: Set<string>;
  canonStatements: Map<string, string[]>;
  artifactStatements: Map<string, string[]>;
  sourceMap: Record<string, SourceMapEntry>;
}

function diagnostic(
  context: CompilerContext,
  range: SourceRange,
  code: string,
  message: string,
  guidance: string,
  severity: "error" | "warning" = "error",
): void {
  context.diagnostics.push({ severity, code, message, guidance, range });
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseAudiences(
  value: string | undefined,
  range: SourceRange,
  context: CompilerContext,
): Audience[] {
  const values = value ? splitList(value) : ["player", "model", "creator", "debug"];
  const audiences: Audience[] = [];
  for (const value of values) {
    if (!AUDIENCES.has(value as Audience)) {
      diagnostic(
        context,
        range,
        "unknown-audience",
        `Unknown audience ${value}.`,
        "Use player, model, creator, or debug.",
      );
    } else {
      audiences.push(value as Audience);
    }
  }
  return audiences;
}

function addSourceMap(
  map: Record<string, SourceMapEntry>,
  semanticId: string,
  kind: SourceMapEntry["kind"],
  range: SourceRange,
): void {
  map[`${kind}:${semanticId}`] = { semanticId, kind, range };
}

function requireValue(
  declaration: DeclarationNode,
  key: string,
  context: CompilerContext,
): string {
  const value = propertyValue(declaration.children, key);
  if (!value) {
    diagnostic(
      context,
      declaration.range,
      "missing-property",
      `${declaration.kind} ${declaration.header || "declaration"} is missing ${key}.`,
      `Add an indented '${key}: ...' property.`,
    );
  }
  return value ?? "";
}

function duplicateIds(
  declarations: DeclarationNode[],
  kind: DeclarationNode["kind"],
  context: CompilerContext,
): void {
  const seen = new Set<string>();
  for (const declaration of declarations.filter((candidate) => candidate.kind === kind)) {
    const id = declaration.header.split(/\s+/)[0];
    if (!id) continue;
    if (seen.has(id)) {
      diagnostic(
        context,
        declaration.range,
        "duplicate-semantic-id",
        `${kind} ID ${id} is declared more than once.`,
        "Rename one declaration; semantic IDs must be stable and unique within their declaration kind.",
      );
    }
    seen.add(id);
  }
}

function parseState(declaration: DeclarationNode, context: CompilerContext): void {
  for (const node of declaration.children) {
    if (node.kind === "property" && (node.key === "frame" || node.key === "location")) {
      if (node.key === "frame") context.state.frameId = node.value;
      else context.state.locationId = node.value;
      continue;
    }
    const booleanState = node.value.match(
      /^(flag|clue|knowledge)\s+([A-Za-z][\w.-]*)\s*=\s*(true|false)(?:\s+audiences\s+(.+))?$/,
    );
    if (booleanState) {
      const [, domain, id, initial, audienceText] = booleanState;
      const definition = {
        initial: initial === "true",
        audiences: parseAudiences(audienceText, node.range, context),
      };
      if (domain === "flag") (context.state.flags ??= {})[id] = definition;
      if (domain === "clue") (context.state.clues ??= {})[id] = definition;
      if (domain === "knowledge") (context.state.knowledge ??= {})[id] = definition;
      addSourceMap(context.sourceMap, `${domain}.${id}`, "state", node.range);
      continue;
    }
    const numericState = node.value.match(
      /^(resource|clock|relationship)\s+([A-Za-z][\w.-]*)\s*=\s*(-?\d+(?:\.\d+)?)\s+range\s+(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)(?:\s+audiences\s+(.+))?$/,
    );
    if (numericState) {
      const [, domain, id, initialText, minText, maxText, audienceText] = numericState;
      const definition = {
        initial: Number(initialText),
        min: Number(minText),
        max: Number(maxText),
        audiences: parseAudiences(audienceText, node.range, context),
      };
      if (definition.min > definition.initial || definition.initial > definition.max) {
        diagnostic(
          context,
          node.range,
          "initial-outside-range",
          `${domain} ${id} starts outside ${definition.min}..${definition.max}.`,
          "Move the initial value inside the declared inclusive range.",
        );
      }
      if (domain === "resource") (context.state.resources ??= {})[id] = definition;
      if (domain === "clock") (context.state.clocks ??= {})[id] = definition;
      if (domain === "relationship") (context.state.relationships ??= {})[id] = definition;
      addSourceMap(context.sourceMap, `${domain}.${id}`, "state", node.range);
      continue;
    }
    const inventory = node.value.match(
      /^inventory\s+([A-Za-z][\w.-]*)\s*=\s*(\d+)(?:\s+audiences\s+(.+))?$/,
    );
    if (inventory) {
      const [, id, initial, audienceText] = inventory;
      (context.state.inventory ??= {})[id] = {
        initial: Number(initial),
        audiences: parseAudiences(audienceText, node.range, context),
      };
      addSourceMap(context.sourceMap, `inventory.${id}`, "state", node.range);
      continue;
    }
    const initiallyRevealed = node.value.match(/^reveal\s+(canon|artifact)\s+([A-Za-z][\w.-]*)$/);
    if (initiallyRevealed) {
      const [, domain, id] = initiallyRevealed;
      if (domain === "canon") {
        if (!context.canonIds.has(id)) unknownConditionTarget(context, node.range, "canon", id);
        (context.state.revealedCanonIds ??= []).push(id);
      } else {
        if (!context.artifactIds.has(id)) unknownConditionTarget(context, node.range, "artifact", id);
        (context.state.revealedArtifactIds ??= []).push(id);
      }
      addSourceMap(context.sourceMap, `initial-${domain}.${id}`, "state", node.range);
      continue;
    }
    diagnostic(
      context,
      node.range,
      "invalid-state-declaration",
      `Cannot interpret state declaration '${node.value}'.`,
      "Use frame/location properties, a typed state declaration, or 'reveal canon/artifact semantic_id'.",
    );
  }
}

function numericCondition(
  domain: "resource" | "clock" | "relationship",
  id: string,
  operator: keyof typeof COMPARISONS,
  value: string,
): Condition {
  return { kind: domain, [`${domain}Id`]: id, operator: COMPARISONS[operator], value: Number(value) } as Condition;
}

function parseCondition(text: string, range: SourceRange, context: CompilerContext): Condition {
  const source = text.trim();
  if (source === "always") return { kind: "always" };
  let match = source.match(/^flag\s+([\w.-]+)\s+is\s+(true|false)$/);
  if (match) {
    if (!stateHas(context, "flags", match[1])) unknownConditionTarget(context, range, "flag", match[1]);
    return { kind: "flag", flagId: match[1], equals: match[2] === "true" };
  }
  match = source.match(/^(resource|clock|relationship)\s+([\w.-]+)\s*(==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (match) {
    const domain = `${match[1]}s`;
    if (!stateHas(context, domain, match[2])) unknownConditionTarget(context, range, match[1], match[2]);
    return numericCondition(
      match[1] as "resource" | "clock" | "relationship",
      match[2],
      match[3] as keyof typeof COMPARISONS,
      match[4],
    );
  }
  match = source.match(/^clue_count\s*(==|!=|>=|<=|>|<)\s*(\d+)$/);
  if (match) return { kind: "clue-count", operator: COMPARISONS[match[1] as keyof typeof COMPARISONS], value: Number(match[2]) };
  match = source.match(/^inventory\s+([\w.-]+)\s*>=\s*(\d+)$/);
  if (match) {
    if (!stateHas(context, "inventory", match[1])) unknownConditionTarget(context, range, "inventory", match[1]);
    return { kind: "inventory", itemId: match[1], atLeast: Number(match[2]) };
  }
  match = source.match(/^(clue|knowledge)\s+([\w.-]+)\s+(present|absent)$/);
  if (match) {
    const domain = match[1] === "clue" ? "clues" : "knowledge";
    if (!stateHas(context, domain, match[2])) unknownConditionTarget(context, range, match[1], match[2]);
    return match[1] === "clue"
      ? { kind: "clue", clueId: match[2], present: match[3] === "present" }
      : { kind: "knowledge", knowledgeId: match[2], present: match[3] === "present" };
  }
  match = source.match(/^frame\s+([\w.-]+)$/);
  if (match) {
    if (!context.frameIds.has(match[1])) unknownConditionTarget(context, range, "frame", match[1]);
    return { kind: "frame", frameId: match[1] };
  }
  match = source.match(/^location\s+([\w.-]+)$/);
  if (match) return { kind: "location", locationId: match[1] };
  match = source.match(/^canon\s+([\w.-]+)\s+revealed$/);
  if (match) {
    if (!context.canonIds.has(match[1])) unknownConditionTarget(context, range, "canon", match[1]);
    return { kind: "canon-revealed", canonId: match[1] };
  }
  match = source.match(/^status\s+(active|complete|failed)$/);
  if (match) return { kind: "status", status: match[1] as "active" | "complete" | "failed" };
  diagnostic(
    context,
    range,
    "invalid-condition",
    `Cannot interpret condition '${source}'.`,
    "Use an explicit condition such as 'clue key present', 'resource supplies >= 1', or 'always'.",
  );
  return { kind: "always" };
}

function unknownConditionTarget(
  context: CompilerContext,
  range: SourceRange,
  domain: string,
  id: string,
): void {
  diagnostic(
    context,
    range,
    "unknown-condition-target",
    `Condition references unknown ${domain} ${id}.`,
    `Declare ${id} before using it or correct the semantic ID.`,
  );
}

function stateHas(context: CompilerContext, domain: string, id: string): boolean {
  const record = context.state[domain as keyof InitialStateDefinition] as Record<string, unknown> | undefined;
  return Boolean(record && id in record);
}

function parseEffect(node: BodyNode, context: CompilerContext): Effect[] {
  const text = node.value;
  let match = text.match(/^set\s+flag\s+([\w.-]+)\s*=\s*(true|false)$/);
  if (match) {
    if (!stateHas(context, "flags", match[1])) unknownEffectTarget(context, node, "flag", match[1]);
    return [{ kind: "set-flag", flagId: match[1], value: match[2] === "true" }];
  }
  match = text.match(/^adjust\s+(resource|relationship)\s+([\w.-]+)\s+by\s+(-?\d+(?:\.\d+)?)$/);
  if (match) {
    const domain = match[1] === "resource" ? "resources" : "relationships";
    if (!stateHas(context, domain, match[2])) unknownEffectTarget(context, node, match[1], match[2]);
    return match[1] === "resource"
      ? [{ kind: "adjust-resource", resourceId: match[2], amount: Number(match[3]) }]
      : [{ kind: "adjust-relationship", relationshipId: match[2], amount: Number(match[3]) }];
  }
  match = text.match(/^advance\s+clock\s+([\w.-]+)\s+by\s+(-?\d+(?:\.\d+)?)$/);
  if (match) {
    if (!stateHas(context, "clocks", match[1])) unknownEffectTarget(context, node, "clock", match[1]);
    return [{ kind: "advance-clock", clockId: match[1], amount: Number(match[2]) }];
  }
  match = text.match(/^(add|remove)\s+inventory\s+([\w.-]+)\s+(\d+)$/);
  if (match) {
    if (!stateHas(context, "inventory", match[2])) unknownEffectTarget(context, node, "inventory", match[2]);
    return [{ kind: match[1] === "add" ? "add-inventory" : "remove-inventory", itemId: match[2], quantity: Number(match[3]) }];
  }
  match = text.match(/^add\s+(clue|knowledge)\s+([\w.-]+)$/);
  if (match) {
    const domain = match[1] === "clue" ? "clues" : "knowledge";
    if (!stateHas(context, domain, match[2])) unknownEffectTarget(context, node, match[1], match[2]);
    return match[1] === "clue"
      ? [{ kind: "add-clue", clueId: match[2] }]
      : [{ kind: "add-knowledge", knowledgeId: match[2] }];
  }
  match = text.match(/^reveal\s+canon\s+([\w.-]+)$/);
  if (match) {
    if (!context.canonIds.has(match[1])) unknownEffectTarget(context, node, "canon", match[1]);
    return [{ kind: "reveal-canon", canonId: match[1] }];
  }
  match = text.match(/^reveal\s+artifact\s+([\w.-]+)$/);
  if (match) {
    if (!context.artifactIds.has(match[1])) unknownEffectTarget(context, node, "artifact", match[1]);
    return [{ kind: "reveal-artifact", artifactId: match[1] }];
  }
  match = text.match(/^set\s+location\s+([\w.-]+)$/);
  if (match) return [{ kind: "set-location", locationId: match[1] }];
  match = text.match(/^go\s+([\w.-]+)$/);
  if (match) {
    if (!context.frameIds.has(match[1])) unknownEffectTarget(context, node, "frame", match[1]);
    return [{ kind: "transition", frameId: match[1] }];
  }
  if (text === "complete") return [{ kind: "complete-session" }];
  if (text === "fail") return [{ kind: "fail-session" }];

  match = text.match(/^check\s+([\w.-]+)\s+chance\s+(\d+)$/);
  if (match) {
    const success = findProperty(node.children, "success");
    const failure = findProperty(node.children, "failure");
    if (!success || !failure) {
      diagnostic(
        context,
        node.range,
        "incomplete-seeded-check",
        `Seeded check ${match[1]} requires success and failure effect blocks.`,
        "Add indented 'success:' and 'failure:' blocks, each with at least one effect.",
      );
    }
    return [{
      kind: "seeded-check",
      checkId: match[1],
      chanceBasisPoints: Number(match[2]),
      onSuccess: (success?.children ?? []).flatMap((child) => parseEffect(child, context)),
      onFailure: (failure?.children ?? []).flatMap((child) => parseEffect(child, context)),
    }];
  }

  diagnostic(
    context,
    node.range,
    "invalid-effect",
    `Cannot interpret effect '${text}'.`,
    "Use a declared effect such as 'add clue clue_id', 'adjust resource supplies by -1', 'go frame_id', or 'complete'.",
  );
  return [];
}

function unknownEffectTarget(
  context: CompilerContext,
  node: BodyNode,
  domain: string,
  id: string,
): void {
  diagnostic(
    context,
    node.range,
    "unknown-effect-target",
    `Effect references unknown ${domain} ${id}.`,
    `Declare ${id} before using it or correct the semantic ID.`,
  );
}

function compileIntent(declaration: DeclarationNode, context: CompilerContext): IntentDefinition {
  const id = declaration.header.split(/\s+/)[0];
  const frames = splitList(propertyValue(declaration.children, "frames") ?? "");
  for (const frame of frames) {
    if (!context.frameIds.has(frame)) {
      diagnostic(
        context,
        declaration.range,
        "unknown-frame-reference",
        `Intent ${id} references unknown frame ${frame}.`,
        "Declare the frame or correct the frames property.",
      );
    }
  }
  const when = findProperty(declaration.children, "when");
  const effects = findProperty(declaration.children, "effects");
  if (!effects || effects.children.length === 0) {
    diagnostic(
      context,
      declaration.range,
      "missing-effects",
      `Intent ${id} has no effects.`,
      "Add an indented effects block with at least one explicit mechanical consequence.",
    );
  }
  return {
    id,
    title: requireValue(declaration, "title", context),
    description: requireValue(declaration, "description", context),
    availableInFrames: frames.length > 0 ? frames : undefined,
    when: when?.value ? parseCondition(when.value, when.range, context) : undefined,
    effects: (effects?.children ?? []).flatMap((node) => parseEffect(node, context)),
  };
}

function compileRule(declaration: DeclarationNode, context: CompilerContext): ReactiveRule {
  const id = declaration.header.split(/\s+/)[0];
  const when = findProperty(declaration.children, "when");
  const effects = findProperty(declaration.children, "effects");
  if (!when?.value) {
    diagnostic(context, declaration.range, "missing-condition", `Rule ${id} has no condition.`, "Add 'when: ...'.");
  }
  if (!effects || effects.children.length === 0) {
    diagnostic(context, declaration.range, "missing-effects", `Rule ${id} has no effects.`, "Add an effects block.");
  }
  return {
    id,
    once: propertyValue(declaration.children, "once") === "true",
    when: when?.value ? parseCondition(when.value, when.range, context) : { kind: "always" },
    effects: (effects?.children ?? []).flatMap((node) => parseEffect(node, context)),
  };
}

function propertyList(nodes: BodyNode[], key: string): string[] {
  const property = findProperty(nodes, key);
  if (!property) return [];
  if (property.value) return splitList(property.value);
  return bodyValues(property);
}

function propertyLines(nodes: BodyNode[], key: string): string[] {
  const property = findProperty(nodes, key);
  if (!property) return [];
  if (property.value) return [property.value];
  return bodyValues(property).filter(Boolean);
}

function compileFramePerformance(
  declaration: DeclarationNode,
  frameId: string,
  context: CompilerContext,
): { text?: string; performance?: FramePerformanceContract } {
  const textLines = propertyLines(declaration.children, "text");
  const exact = propertyLines(declaration.children, "exact");
  const establish = propertyLines(declaration.children, "establish");
  const suggest = propertyLines(declaration.children, "suggest");
  const forbiddenClaims = propertyLines(declaration.children, "never");
  const authoredFallback = propertyLines(declaration.children, "fallback");
  const usesPerformanceContract = exact.length + establish.length + suggest.length + forbiddenClaims.length + authoredFallback.length > 0;

  if (!usesPerformanceContract) {
    return { text: textLines.length > 0 ? textLines.join("\n\n") : undefined };
  }

  if (exact.length + establish.length === 0) {
    diagnostic(
      context,
      declaration.range,
      "frame-without-required-performance",
      `Frame ${frameId} has performance guidance but no required authored meaning.`,
      "Add at least one exact or establish line so the Director has a required target.",
    );
  }

  const fallback = authoredFallback.length > 0 ? authoredFallback : textLines;
  if (fallback.length === 0) {
    diagnostic(
      context,
      declaration.range,
      "missing-frame-fallback",
      `Frame ${frameId} has no authored fallback.`,
      "Add a fallback block (or a text block) so the scene remains playable when generation is unavailable.",
    );
  }

  const beats = ([
    ["exact", exact],
    ["establish", establish],
    ["suggest", suggest],
  ] as const).flatMap(([authority, lines]) =>
    lines.map((text, index) => ({
      id: `${frameId}.${authority}.${index + 1}`,
      authority,
      text,
    })),
  );

  for (const beat of beats) addSourceMap(context.sourceMap, beat.id, "frame", declaration.range);

  return {
    text: textLines.length > 0 ? textLines.join("\n\n") : fallback.join("\n\n"),
    performance: { beats, forbiddenClaims, fallback },
  };
}

function compileSpan(
  declaration: DeclarationNode,
  context: CompilerContext,
  intentIds: Set<string>,
) {
  const header = declaration.header.match(/^([A-Za-z][\w.-]*)\s*->\s*([A-Za-z][\w.-]*)$/);
  const spanId = header?.[1] ?? declaration.header.split(/\s+/)[0];
  const targetFrameId = header?.[2] ?? "";
  if (targetFrameId && !context.frameIds.has(targetFrameId)) {
    diagnostic(
      context,
      declaration.range,
      "unknown-span-target",
      `Span ${spanId} targets unknown frame ${targetFrameId}.`,
      "Declare the target frame or correct the SPAN header.",
    );
  }

  const turnsNode = findProperty(declaration.children, "turns");
  const turnMatch = turnsNode?.value.match(/^(\d+)\.\.(\d+)$/);
  const min = Number(turnMatch?.[1] ?? 0);
  const max = Number(turnMatch?.[2] ?? 0);
  if (!turnMatch || min < 1 || max < min) {
    diagnostic(
      context,
      turnsNode?.range ?? declaration.range,
      "invalid-span-turn-range",
      `Span ${spanId} requires an inclusive positive turn range.`,
      "Add a value such as 'turns: 2..4' with maximum greater than or equal to minimum.",
    );
  }

  const beatTexts = propertyList(declaration.children, "required_beats");
  if (beatTexts.length === 0) {
    diagnostic(
      context,
      declaration.range,
      "missing-required-beats",
      `Span ${spanId} has no required beats.`,
      "Add at least one required beat so interpolation has explicit dramatic work.",
    );
  }

  const curveNode = findProperty(declaration.children, "curve");
  const curves = splitList(curveNode?.value ?? "").flatMap((value) => {
    const match = value.match(/^([A-Za-z][\w.-]*)\s+(-?\d+(?:\.\d+)?)\s*->\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) {
      diagnostic(
        context,
        curveNode?.range ?? declaration.range,
        "invalid-narrative-curve",
        `Cannot interpret narrative curve '${value}'.`,
        "Use comma-separated values such as 'dread 1 -> 5, humor 4 -> 2'.",
      );
      return [];
    }
    return [{ dimension: match[1], start: Number(match[2]), end: Number(match[3]) }];
  });

  const mayInvent = propertyList(declaration.children, "may_invent");
  const mayNotInvent = propertyList(declaration.children, "may_not_invent");
  if (mayInvent.length === 0 || mayNotInvent.length === 0) {
    diagnostic(
      context,
      declaration.range,
      "ambiguous-invention-scope",
      `Span ${spanId} must explicitly declare both permitted and prohibited invention space.`,
      "Add non-empty 'may invent:' and 'may not invent:' blocks. Use 'nothing' when no invention is allowed.",
    );
  }

  const persistence = propertyValue(declaration.children, "persist_inventions") || "turn";
  if (!["turn", "scene", "session", "proposal"].includes(persistence)) {
    diagnostic(
      context,
      declaration.range,
      "invalid-invention-persistence",
      `Span ${spanId} uses unsupported persistence scope ${persistence}.`,
      "Use turn, scene, session, or proposal.",
    );
  }

  const hiddenCanonIds: string[] = [];
  const hiddenArtifactIds: string[] = [];
  for (const protectedId of propertyList(declaration.children, "hide")) {
    const match = protectedId.match(/^(canon|artifact)\s+([A-Za-z][\w.-]*)$/);
    if (!match) {
      diagnostic(
        context,
        declaration.range,
        "invalid-span-protection",
        `Span ${spanId} cannot interpret protected value '${protectedId}'.`,
        "Use 'canon fact_id' or 'artifact artifact_id'.",
      );
      continue;
    }
    if (match[1] === "canon") {
      if (!context.canonIds.has(match[2])) unknownConditionTarget(context, declaration.range, "canon", match[2]);
      hiddenCanonIds.push(match[2]);
    } else {
      if (!context.artifactIds.has(match[2])) unknownConditionTarget(context, declaration.range, "artifact", match[2]);
      hiddenArtifactIds.push(match[2]);
    }
  }

  const availableIntentIds = propertyList(declaration.children, "offer");
  if (availableIntentIds.length === 0) {
    diagnostic(
      context,
      declaration.range,
      "span-without-intents",
      `Span ${spanId} exposes no legal intent.`,
      "Add 'offer: intent_id, other_intent_id' so player language can map to bounded actions.",
    );
  }
  for (const intentId of availableIntentIds) {
    if (!intentIds.has(intentId)) {
      diagnostic(
        context,
        declaration.range,
        "unknown-span-intent",
        `Span ${spanId} offers unknown intent ${intentId}.`,
        "Declare the intent or correct the offer list.",
      );
    }
  }

  const exitNode = findProperty(declaration.children, "exit_when");
  let requiredBeatsComplete = false;
  let exitCondition: Condition | undefined;
  if (!exitNode?.value) {
    diagnostic(
      context,
      declaration.range,
      "missing-span-exit",
      `Span ${spanId} has no exit contract.`,
      "Add 'exit when: required_beats complete' with an optional explicit condition.",
    );
  } else {
    const parts = exitNode.value.match(/^required_beats\s+complete(?:\s+and\s+(.+))?$/);
    if (!parts) {
      diagnostic(
        context,
        exitNode.range,
        "invalid-span-exit",
        `Cannot interpret span exit '${exitNode.value}'.`,
        "Use 'required_beats complete' followed optionally by 'and' plus a supported condition.",
      );
    } else {
      requiredBeatsComplete = true;
      if (parts[1]) exitCondition = parseCondition(parts[1], exitNode.range, context);
    }
  }

  const fallback = propertyList(declaration.children, "fallback");
  if (fallback.length === 0) {
    diagnostic(
      context,
      declaration.range,
      "missing-span-fallback",
      `Span ${spanId} has no authored fallback.`,
      "Add fallback text so generation failure cannot make the story unplayable.",
    );
  }

  const protectedStatements = [
    ...hiddenCanonIds.flatMap((id) => context.canonStatements.get(id) ?? []),
    ...hiddenArtifactIds.flatMap((id) => context.artifactStatements.get(id) ?? []),
  ].map((value) => value.toLocaleLowerCase());
  const normalizedProtectedIds = [...hiddenCanonIds, ...hiddenArtifactIds]
    .map((value) => value.replace(/[._-]+/g, " ").toLocaleLowerCase());
  for (const permission of mayInvent) {
    const normalizedPermission = permission.replace(/[._-]+/g, " ").toLocaleLowerCase();
    if (
      normalizedProtectedIds.some((id) => normalizedPermission.includes(id)) ||
      protectedStatements.some((statement) => statement && normalizedPermission.includes(statement))
    ) {
      diagnostic(
        context,
        declaration.range,
        "invention-protection-conflict",
        `Span ${spanId} permits invention involving protected content '${permission}'.`,
        "Remove the protected subject from may invent and place it in may not invent.",
      );
    }
  }
  for (const line of fallback) {
    if (protectedStatements.some((statement) => statement && line.toLocaleLowerCase().includes(statement))) {
      diagnostic(
        context,
        declaration.range,
        "fallback-secret-leak",
        `Fallback for span ${spanId} contains protected content.`,
        "Rewrite the fallback using only canon and artifacts visible during the span.",
      );
    }
  }

  return {
    spanId,
    targetFrameId,
    purpose: requireValue(declaration, "purpose", context),
    turnRange: { min, max },
    requiredBeats: beatTexts.map((text, index) => ({ id: `${spanId}.beat.${index + 1}`, text })),
    curves,
    mayInvent,
    mayNotInvent,
    inventionPersistence: persistence as "turn" | "scene" | "session" | "proposal",
    hiddenCanonIds,
    hiddenArtifactIds,
    availableIntentIds,
    exit: { requiredBeatsComplete, condition: exitCondition },
    fallback,
  };
}

function compileThread(declaration: DeclarationNode, context: CompilerContext) {
  const id = declaration.header.split(/\s+/)[0];
  let plantFrameId = "";
  let revealFrameId: string | undefined;
  let payoffFrameId: string | undefined;
  let echoIds: string[] = [];
  let neverResolveIds: string[] = [];
  for (const node of declaration.children) {
    let match = node.value.match(/^plant\s+at\s+([\w.-]+)$/);
    if (match) { plantFrameId = match[1]; continue; }
    match = node.value.match(/^echo\s+with\s+(.+)$/);
    if (match) { echoIds = splitList(match[1]); continue; }
    match = node.value.match(/^reveal\s+at\s+([\w.-]+)$/);
    if (match) { revealFrameId = match[1]; continue; }
    match = node.value.match(/^pay_off\s+at\s+([\w.-]+)$/);
    if (match) { payoffFrameId = match[1]; continue; }
    match = node.value.match(/^never\s+resolve\s+(.+)$/);
    if (match) { neverResolveIds = splitList(match[1]); continue; }
    if (node.kind !== "property" || node.key !== "optional") {
      diagnostic(context, node.range, "invalid-thread-clause", `Cannot interpret thread clause '${node.value}'.`, "Use plant at, echo with, reveal at, pay_off at, never resolve, or optional: true.");
    }
  }
  const optional = propertyValue(declaration.children, "optional") === "true";
  if (!plantFrameId) {
    diagnostic(context, declaration.range, "missing-thread-plant", `Thread ${id} has no plant frame.`, "Add 'plant at frame_id'.");
  }
  if (!optional && !payoffFrameId) {
    diagnostic(context, declaration.range, "missing-thread-payoff", `Required thread ${id} has no payoff.`, "Add 'pay_off at frame_id' or explicitly mark the thread optional.");
  }
  for (const [label, frameId] of [["plant", plantFrameId], ["reveal", revealFrameId], ["payoff", payoffFrameId]] as const) {
    if (frameId && !context.frameIds.has(frameId)) {
      diagnostic(context, declaration.range, "unknown-thread-frame", `Thread ${id} ${label} references unknown frame ${frameId}.`, "Declare the frame/span or correct the thread clause.");
    }
  }
  return { id, plantFrameId, echoIds, revealFrameId, payoffFrameId, neverResolveIds, optional };
}

function compileChoice(declaration: DeclarationNode, context: CompilerContext, intentIds: Set<string>) {
  const id = declaration.header.split(/\s+/)[0];
  const availableInFrames = propertyList(declaration.children, "frames");
  const choiceIntentIds = propertyList(declaration.children, "offer");
  if (availableInFrames.length === 0 || choiceIntentIds.length === 0) {
    diagnostic(context, declaration.range, "incomplete-choice", `Choice ${id} requires frames and offered intents.`, "Add non-empty 'frames:' and 'offer:' properties.");
  }
  for (const frameId of availableInFrames) {
    if (!context.frameIds.has(frameId)) diagnostic(context, declaration.range, "unknown-choice-frame", `Choice ${id} references unknown frame ${frameId}.`, "Declare or correct the frame.");
  }
  for (const intentId of choiceIntentIds) {
    if (!intentIds.has(intentId)) diagnostic(context, declaration.range, "unknown-choice-intent", `Choice ${id} references unknown intent ${intentId}.`, "Declare or correct the intent.");
  }
  return { id, availableInFrames, intentIds: choiceIntentIds };
}

function compileAuthoredTest(declaration: DeclarationNode, context: CompilerContext, intentIds: Set<string>) {
  const id = declaration.header.split(/\s+/)[0];
  const play = propertyValue(declaration.children, "play") ?? "";
  const testIntentIds = play.split(/\s*->\s*/).map((value) => value.trim()).filter(Boolean);
  for (const intentId of testIntentIds) {
    if (!intentIds.has(intentId)) diagnostic(context, declaration.range, "unknown-test-intent", `Test ${id} references unknown intent ${intentId}.`, "Use semantic intent IDs in the play sequence.");
  }
  const assertions: Array<
    | { kind: "hidden-canon"; canonId: string }
    | { kind: "hidden-artifact"; artifactId: string }
    | { kind: "revealed-canon"; canonId: string }
    | { kind: "revealed-artifact"; artifactId: string }
    | { kind: "frame"; frameId: string }
    | { kind: "status"; status: "active" | "complete" | "failed" }
  > = [];
  for (const node of declaration.children) {
    if (node.kind !== "property" || !node.key?.startsWith("assert_")) continue;
    if (node.key === "assert_hidden" || node.key === "assert_revealed") {
      for (const value of splitList(node.value)) {
        const match = value.match(/^(canon|artifact)\s+([\w.-]+)$/);
        if (!match) {
          diagnostic(context, node.range, "invalid-test-assertion", `Test ${id} cannot interpret '${value}'.`, "Use 'canon fact_id' or 'artifact artifact_id'.");
          continue;
        }
        const hidden = node.key === "assert_hidden";
        if (match[1] === "canon") assertions.push({ kind: hidden ? "hidden-canon" : "revealed-canon", canonId: match[2] });
        else assertions.push({ kind: hidden ? "hidden-artifact" : "revealed-artifact", artifactId: match[2] });
      }
    } else if (node.key === "assert_frame") {
      assertions.push({ kind: "frame", frameId: node.value });
    } else if (node.key === "assert_status") {
      if (["active", "complete", "failed"].includes(node.value)) {
        assertions.push({ kind: "status", status: node.value as "active" | "complete" | "failed" });
      } else {
        diagnostic(context, node.range, "invalid-test-status", `Test ${id} uses unsupported status '${node.value}'.`, "Use active, complete, or failed.");
      }
    } else {
      diagnostic(context, node.range, "invalid-test-assertion", `Test ${id} cannot interpret assertion '${node.value}'.`, "Use assert hidden, assert revealed, assert frame, or assert status.");
    }
  }
  if (assertions.length === 0) {
    diagnostic(context, declaration.range, "test-without-assertions", `Test ${id} has no supported assertion.`, "Add assert hidden, assert revealed, assert frame, or assert status.");
  }
  const seed = Number(propertyValue(declaration.children, "seed") ?? 42);
  if (!Number.isSafeInteger(seed)) {
    diagnostic(context, declaration.range, "invalid-test-seed", `Test ${id} seed must be a safe integer.`, "Use an integer seed such as 42.");
  }
  return { id, seed, intentIds: testIntentIds, assertions };
}

function validateInitialFrame(context: CompilerContext, range: SourceRange): void {
  if (!context.state.frameId) {
    diagnostic(context, range, "missing-initial-frame", "STATE has no initial frame.", "Add 'frame: frame_id' inside STATE.");
  } else if (!context.frameIds.has(context.state.frameId)) {
    diagnostic(
      context,
      range,
      "unknown-initial-frame",
      `Initial frame ${context.state.frameId} is not declared.`,
      "Declare the FRAME or correct STATE frame.",
    );
  }
}

function transitionTargets(effects: Effect[]): string[] {
  return effects.flatMap((effect) => {
    if (effect.kind === "transition") return [effect.frameId];
    if (effect.kind === "seeded-check") {
      return [...transitionTargets(effect.onSuccess), ...transitionTargets(effect.onFailure)];
    }
    return [];
  });
}

function validateStoryGraph(args: {
  context: CompilerContext;
  frames: Array<{ id: string; terminal?: boolean }>;
  spans: TweenContract[];
  intents: IntentDefinition[];
  rules: ReactiveRule[];
  sourceMap: Record<string, SourceMapEntry>;
}): void {
  const { context, frames, spans, intents, rules, sourceMap } = args;
  const nodes = [
    ...frames,
    ...spans.map((span) => ({ id: span.spanId, terminal: false, span: true })),
  ];
  const allFrameIds = nodes.map((frame) => frame.id);
  const edges = new Map(allFrameIds.map((id) => [id, new Set<string>()]));
  for (const intent of intents) {
    const sources = intent.availableInFrames ?? allFrameIds;
    for (const source of sources) {
      for (const target of transitionTargets(intent.effects)) edges.get(source)?.add(target);
    }
  }
  for (const rule of rules) {
    for (const source of allFrameIds) {
      for (const target of transitionTargets(rule.effects)) edges.get(source)?.add(target);
    }
  }
  for (const span of spans) edges.get(span.spanId)?.add(span.targetFrameId);

  const reachable = new Set<string>();
  const queue = context.state.frameId ? [context.state.frameId] : [];
  while (queue.length > 0) {
    const frameId = queue.shift()!;
    if (reachable.has(frameId)) continue;
    reachable.add(frameId);
    for (const target of edges.get(frameId) ?? []) queue.push(target);
  }

  for (const frame of nodes) {
    const source = sourceMap[`frame:${frame.id}`] ?? sourceMap[`ending:${frame.id}`] ?? sourceMap[`span:${frame.id}`];
    if (!reachable.has(frame.id) && source) {
      diagnostic(
        context,
        source.range,
        "unreachable-frame",
        `Frame ${frame.id} cannot be reached from initial frame ${context.state.frameId}.`,
        "Add a legal transition path to this frame or remove the unused declaration.",
      );
    }
    const span = spans.find((candidate) => candidate.spanId === frame.id);
    const hasIntent = span
      ? span.availableIntentIds.length > 0
      : intents.some((intent) => !intent.availableInFrames || intent.availableInFrames.includes(frame.id));
    if (!frame.terminal && !hasIntent && source) {
      diagnostic(
        context,
        source.range,
        "static-dead-end",
        `Non-terminal frame ${frame.id} has no declared intent.`,
        "Add at least one intent for this frame or mark it as terminal.",
      );
    }
  }
}

export function compileStoryframe(
  source: string,
  sourceId = "storyframe://memory",
): CompileResult {
  const parsed = parseStoryframe(source, sourceId);
  const context: CompilerContext = {
    document: parsed.document,
    diagnostics: [...parsed.diagnostics],
    state: { frameId: "" },
    canonIds: new Set(),
    characterIds: new Set(),
    frameIds: new Set(),
    artifactIds: new Set(),
    canonStatements: new Map(),
    artifactStatements: new Map(),
    sourceMap: {},
  };
  const declarations = parsed.document.declarations;
  const worldDeclarations = declarations.filter((item) => item.kind === "WORLD");
  if (worldDeclarations.length !== 1) {
    const range = declarations[0]?.range ?? {
      sourceId,
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    };
    diagnostic(
      context,
      range,
      "world-declaration-count",
      `Expected exactly one WORLD declaration; found ${worldDeclarations.length}.`,
      "Add one WORLD id vversion declaration and remove duplicates.",
    );
  }
  for (const kind of ["FRAME", "CAST", "ARTIFACT", "SPAN", "THREAD", "CHOICE", "INTENT", "RULE", "ENDING", "TEST"] as const) {
    duplicateIds(declarations, kind, context);
  }
  const sourceMap = context.sourceMap;
  const spanDeclarations = declarations.filter((item) => item.kind === "SPAN");
  for (const declaration of spanDeclarations) {
    const match = declaration.header.match(/^([A-Za-z][\w.-]*)\s*->\s*([A-Za-z][\w.-]*)$/);
    if (!match) {
      diagnostic(
        context,
        declaration.range,
        "invalid-span-header",
        `SPAN header '${declaration.header}' is invalid.`,
        "Use 'SPAN span_id -> target_frame_id'.",
      );
      continue;
    }
    context.frameIds.add(match[1]);
    addSourceMap(sourceMap, match[1], "span", declaration.range);
  }
  const frames = declarations
    .filter((item) => item.kind === "FRAME" || item.kind === "ENDING")
    .map((declaration) => {
      const id = declaration.header.split(/\s+/)[0];
      context.frameIds.add(id);
      addSourceMap(sourceMap, id, declaration.kind === "ENDING" ? "ending" : "frame", declaration.range);
      if (declaration.kind === "ENDING") addSourceMap(sourceMap, id, "frame", declaration.range);
      const authored = compileFramePerformance(declaration, id, context);
      return {
        id,
        title: propertyValue(declaration.children, "title") || undefined,
        ...authored,
        terminal: declaration.kind === "ENDING" || propertyValue(declaration.children, "terminal") === "true",
      };
    });

  const canon = declarations.flatMap((declaration) => {
    if (declaration.kind !== "CANON") return [];
    return declaration.children.flatMap((node) => {
      const match = node.key?.match(/^(LOCK|SECRET|BRANCH|OPEN|UNSAID|NEVER)_([A-Za-z][\w.-]*)$/);
      if (!match) {
        diagnostic(
          context,
          node.range,
          "invalid-canon-declaration",
          `Cannot interpret canon declaration '${node.key ?? node.value}'.`,
          "Use 'LOCK fact_id: statement' or another explicit canon class.",
        );
        return [];
      }
      const id = match[2];
      const classification = ({
        LOCK: "locked",
        SECRET: "secret",
        BRANCH: "branch",
        OPEN: "open",
        UNSAID: "unsaid",
        NEVER: "never",
      } as Record<string, CanonClass>)[match[1]];
      const statement = node.value || node.children.find((child) => child.kind !== "property")?.value || "";
      if (!statement) {
        diagnostic(context, node.range, "missing-canon-statement", `Canon ${id} has no statement.`, "Add its statement after the colon or on an indented line.");
      }
      context.canonIds.add(id);
      context.canonStatements.set(id, [statement]);
      addSourceMap(sourceMap, id, "canon", node.range);
      return [{
        id,
        classification,
        statement,
        audiences: parseAudiences(propertyValue(node.children, "audiences"), node.range, context),
        modelDirective: propertyValue(node.children, "model_directive") || undefined,
      }];
    });
  });

  const characters = declarations
    .filter((item) => item.kind === "CAST")
    .map((declaration) => {
      const id = declaration.header.split(/\s+/)[0];
      context.characterIds.add(id);
      addSourceMap(sourceMap, id, "character", declaration.range);
      return {
        id,
        name: propertyValue(declaration.children, "name") || id.replace(/_/g, " "),
        role: propertyValue(declaration.children, "role") || undefined,
      };
    });

  const artifacts = declarations
    .filter((item) => item.kind === "ARTIFACT")
    .map((declaration) => {
      const id = declaration.header.split(/\s+/)[0];
      const kind = propertyValue(declaration.children, "kind");
      const validKinds = ["document", "image", "diagram", "map"];
      if (!validKinds.includes(kind ?? "")) {
        diagnostic(
          context,
          declaration.range,
          "invalid-artifact-kind",
          `Artifact ${id} has unsupported kind ${kind || "(missing)"}.`,
          `Use one of: ${validKinds.join(", ")}.`,
        );
      }
      const presentation = propertyValue(declaration.children, "presentation") || "inspect";
      if (!["inline", "inspect"].includes(presentation)) {
        diagnostic(
          context,
          declaration.range,
          "invalid-artifact-presentation",
          `Artifact ${id} has unsupported presentation ${presentation}.`,
          "Use inline for a rare story-critical interruption or inspect for an evidence drawer.",
        );
      }
      const altText = requireValue(declaration, "alt", context);
      const textNode = findProperty(declaration.children, "text");
      const textFallback = textNode
        ? textNode.value
          ? [textNode.value]
          : bodyValues(textNode)
        : [];
      if (textFallback.length === 0) {
        diagnostic(
          context,
          declaration.range,
          "missing-artifact-text-fallback",
          `Artifact ${id} has no textual fallback.`,
          "Add a text block that communicates the clue when the visual cannot be loaded or perceived.",
        );
      }
      const assetKey = propertyValue(declaration.children, "asset");
      const mimeType = propertyValue(declaration.children, "mime");
      if (kind !== "document" && (!assetKey || !mimeType)) {
        diagnostic(
          context,
          declaration.range,
          "missing-visual-asset",
          `Visual artifact ${id} requires asset and mime properties.`,
          "Provide a stable semantic asset key and an approved image MIME type.",
        );
      }
      const validMimes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
      if (mimeType && !validMimes.includes(mimeType)) {
        diagnostic(
          context,
          declaration.range,
          "invalid-artifact-mime",
          `Artifact ${id} uses unsupported MIME type ${mimeType}.`,
          `Use one of: ${validMimes.join(", ")}.`,
        );
      }
      context.artifactIds.add(id);
      context.artifactStatements.set(id, [
        propertyValue(declaration.children, "title") ?? "",
        propertyValue(declaration.children, "summary") ?? "",
        altText,
        ...textFallback,
      ]);
      addSourceMap(sourceMap, id, "artifact", declaration.range);
      return {
        id,
        kind: kind as "document" | "image" | "diagram" | "map",
        title: requireValue(declaration, "title", context),
        summary: requireValue(declaration, "summary", context),
        caption: propertyValue(declaration.children, "caption") || undefined,
        altText,
        textFallback,
        presentation: presentation as "inline" | "inspect",
        audiences: parseAudiences(
          propertyValue(declaration.children, "audiences"),
          declaration.range,
          context,
        ),
        clueId: propertyValue(declaration.children, "clue") || undefined,
        asset: assetKey && mimeType
          ? {
              key: assetKey,
              mimeType: mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml",
            }
          : undefined,
      };
    });

  const stateDeclarations = declarations.filter((item) => item.kind === "STATE");
  if (stateDeclarations.length !== 1) {
    const range = worldDeclarations[0]?.range ?? declarations[0]!.range;
    diagnostic(context, range, "state-declaration-count", `Expected exactly one STATE declaration; found ${stateDeclarations.length}.`, "Add one STATE declaration and remove duplicates.");
  }
  if (stateDeclarations[0]) {
    addSourceMap(sourceMap, "initial", "state", stateDeclarations[0].range);
    parseState(stateDeclarations[0], context);
    validateInitialFrame(context, stateDeclarations[0].range);
  }

  const intents = declarations
    .filter((item) => item.kind === "INTENT")
    .map((declaration) => {
      const id = declaration.header.split(/\s+/)[0];
      addSourceMap(sourceMap, id, "intent", declaration.range);
      return compileIntent(declaration, context);
    });
  const rules = declarations
    .filter((item) => item.kind === "RULE")
    .map((declaration) => {
      const id = declaration.header.split(/\s+/)[0];
      addSourceMap(sourceMap, id, "rule", declaration.range);
      return compileRule(declaration, context);
    });

  const intentIds = new Set(intents.map((intent) => intent.id));
  const spans = spanDeclarations.map((declaration) => compileSpan(declaration, context, intentIds));
  for (const span of spans) {
    for (const intentId of span.availableIntentIds) {
      const intent = intents.find((candidate) => candidate.id === intentId);
      if (intent?.availableInFrames && !intent.availableInFrames.includes(span.spanId)) {
        const source = sourceMap[`span:${span.spanId}`];
        if (source) {
          diagnostic(
            context,
            source.range,
            "span-intent-frame-mismatch",
            `Span ${span.spanId} offers intent ${intentId}, but that intent is not available in the span.`,
            `Add ${span.spanId} to the intent's frames list or remove it from the span offer list.`,
          );
        }
      }
    }
  }
  const threads = declarations
    .filter((item) => item.kind === "THREAD")
    .map((declaration) => {
      const id = declaration.header.split(/\s+/)[0];
      addSourceMap(sourceMap, id, "thread", declaration.range);
      return compileThread(declaration, context);
    });
  const choices = declarations
    .filter((item) => item.kind === "CHOICE")
    .map((declaration) => {
      const id = declaration.header.split(/\s+/)[0];
      addSourceMap(sourceMap, id, "choice", declaration.range);
      return compileChoice(declaration, context, intentIds);
    });
  const tests = declarations
    .filter((item) => item.kind === "TEST")
    .map((declaration) => {
      const id = declaration.header.split(/\s+/)[0];
      addSourceMap(sourceMap, id, "test", declaration.range);
      return compileAuthoredTest(declaration, context, intentIds);
    });

  for (const test of tests) {
    for (const assertion of test.assertions) {
      if ((assertion.kind === "hidden-canon" || assertion.kind === "revealed-canon") && !context.canonIds.has(assertion.canonId)) {
        const source = sourceMap[`test:${test.id}`];
        if (source) diagnostic(context, source.range, "unknown-test-canon", `Test ${test.id} references unknown canon ${assertion.canonId}.`, "Declare or correct the canon ID.");
      }
      if ((assertion.kind === "hidden-artifact" || assertion.kind === "revealed-artifact") && !context.artifactIds.has(assertion.artifactId)) {
        const source = sourceMap[`test:${test.id}`];
        if (source) diagnostic(context, source.range, "unknown-test-artifact", `Test ${test.id} references unknown artifact ${assertion.artifactId}.`, "Declare or correct the artifact ID.");
      }
      if (assertion.kind === "frame" && !context.frameIds.has(assertion.frameId)) {
        const source = sourceMap[`test:${test.id}`];
        if (source) diagnostic(context, source.range, "unknown-test-frame", `Test ${test.id} references unknown frame ${assertion.frameId}.`, "Declare or correct the frame ID.");
      }
    }
  }

  validateStoryGraph({ context, frames, spans, intents, rules, sourceMap });

  const worldDeclaration = worldDeclarations[0];
  if (!worldDeclaration || context.diagnostics.some((item) => item.severity === "error")) {
    return { ok: false, document: parsed.document, diagnostics: context.diagnostics };
  }
  const header = worldDeclaration.header.match(/^([A-Za-z][\w.-]*)\s+v?([0-9]+\.[0-9]+\.[0-9]+)$/);
  if (!header) {
    diagnostic(
      context,
      worldDeclaration.range,
      "invalid-world-header",
      `WORLD header '${worldDeclaration.header}' is invalid.`,
      "Use 'WORLD semantic.id v1.0.0'.",
    );
    return { ok: false, document: parsed.document, diagnostics: context.diagnostics };
  }
  const title = requireValue(worldDeclaration, "title", context);
  const owner = requireValue(worldDeclaration, "owner", context);
  const engineVersion = requireValue(worldDeclaration, "engine", context);
  const rights = requireValue(worldDeclaration, "rights", context);
  const validRights = ["original", "public-domain", "licensed", "user-supplied-private"];
  if (!validRights.includes(rights)) {
    diagnostic(context, worldDeclaration.range, "invalid-rights", `Unknown rights classification ${rights}.`, `Use one of: ${validRights.join(", ")}.`);
  }
  addSourceMap(sourceMap, header[1], "world", worldDeclaration.range);

  if (context.diagnostics.some((item) => item.severity === "error")) {
    return { ok: false, document: parsed.document, diagnostics: context.diagnostics };
  }
  const world: WorldPack = {
    manifest: {
      id: header[1],
      version: header[2],
      title,
      engineVersion,
      rights: {
        classification: rights as WorldPack["manifest"]["rights"]["classification"],
        owner,
      },
    },
    initialState: context.state,
    canon,
    characters,
    frames,
    artifacts,
    intents,
    rules,
    spans,
    threads,
    choices,
    tests,
    sourceMap,
  };
  return { ok: true, world, document: parsed.document, diagnostics: context.diagnostics };
}

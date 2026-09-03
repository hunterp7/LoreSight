import type { SourceRange } from "@storyframe/world-schema";
import type {
  BodyNode,
  BodyNodeKind,
  CompilerDiagnostic,
  DeclarationKind,
  DeclarationNode,
  ParseResult,
} from "./ast.js";
import { lexStoryframe } from "./lexer.js";

const DECLARATIONS = new Set<DeclarationKind>([
  "WORLD",
  "CANON",
  "CAST",
  "ARTIFACT",
  "STATE",
  "FRAME",
  "SPAN",
  "THREAD",
  "INTENT",
  "CHOICE",
  "RULE",
  "ENDING",
  "TEST",
]);

function mergeRange(start: SourceRange, end: SourceRange): SourceRange {
  return { sourceId: start.sourceId, start: start.start, end: end.end };
}

function bodyNode(text: string, range: SourceRange): BodyNode {
  if (text.startsWith("- ")) {
    return { kind: "list-item", value: text.slice(2).trim(), children: [], range };
  }
  const property = text.match(/^([A-Za-z_][A-Za-z0-9_ ]*):(?:\s*(.*))?$/);
  if (property) {
    return {
      kind: "property",
      key: property[1].trim().replace(/\s+/g, "_"),
      value: property[2] ?? "",
      children: [],
      range,
    };
  }
  return { kind: "instruction", value: text, children: [], range };
}

function updateNodeRange(node: BodyNode): SourceRange {
  for (const child of node.children) updateNodeRange(child);
  if (node.children.length > 0) {
    node.range = mergeRange(node.range, node.children.at(-1)!.range);
  }
  return node.range;
}

export function parseStoryframe(source: string, sourceId = "storyframe://memory"): ParseResult {
  const lexed = lexStoryframe(source, sourceId);
  const diagnostics: CompilerDiagnostic[] = [...lexed.diagnostics];
  const declarations: DeclarationNode[] = [];
  const comments = lexed.tokens
    .filter((token) => token.kind === "comment")
    .map((token) => ({ text: token.text.slice(1).trim(), range: token.range }));
  let current: DeclarationNode | undefined;
  const stack: Array<{ indent: number; node: BodyNode }> = [];

  for (const token of lexed.tokens.filter((candidate) => candidate.kind === "content")) {
    if (token.indent === 0) {
      const match = token.text.match(/^([A-Z]+)(?:\s+(.*))?$/);
      const keyword = match?.[1] as DeclarationKind | undefined;
      if (!keyword || !DECLARATIONS.has(keyword)) {
        diagnostics.push({
          severity: "error",
          code: "unknown-declaration",
          message: `Unknown top-level declaration: ${token.text}.`,
          guidance: "Begin the line with a supported declaration such as WORLD, STATE, FRAME, INTENT, or RULE.",
          range: token.range,
        });
        current = undefined;
        stack.length = 0;
        continue;
      }
      current = {
        kind: keyword,
        header: match?.[2]?.trim() ?? "",
        children: [],
        range: token.range,
      };
      declarations.push(current);
      stack.length = 0;
      continue;
    }

    if (!current) {
      diagnostics.push({
        severity: "error",
        code: "orphan-body-line",
        message: "Indented content has no top-level declaration.",
        guidance: "Add a WORLD, STATE, FRAME, INTENT, or other declaration before this line.",
        range: token.range,
      });
      continue;
    }

    const node = bodyNode(token.text, token.range);
    while (stack.length > 0 && stack.at(-1)!.indent >= token.indent) stack.pop();
    if (stack.length === 0) current.children.push(node);
    else stack.at(-1)!.node.children.push(node);
    stack.push({ indent: token.indent, node });
  }

  for (const declaration of declarations) {
    for (const child of declaration.children) updateNodeRange(child);
    if (declaration.children.length > 0) {
      declaration.range = mergeRange(declaration.range, declaration.children.at(-1)!.range);
    }
  }

  return {
    document: { sourceId, declarations, comments },
    diagnostics,
  };
}

export function findProperty(nodes: BodyNode[], key: string): BodyNode | undefined {
  return nodes.find((node) => node.kind === "property" && node.key === key);
}

export function propertyValue(nodes: BodyNode[], key: string): string | undefined {
  return findProperty(nodes, key)?.value;
}

export function bodyValues(node: BodyNode | undefined): string[] {
  if (!node) return [];
  return node.children.map((child) => child.value);
}

import type { SourcePosition, SourceRange } from "@storyframe/world-schema";
import type { CompilerDiagnostic, LineToken } from "./ast.js";

export interface LexResult {
  tokens: LineToken[];
  diagnostics: CompilerDiagnostic[];
}

function position(line: number, column: number, offset: number): SourcePosition {
  return { line, column, offset };
}

function range(
  sourceId: string,
  line: number,
  startColumn: number,
  startOffset: number,
  endColumn: number,
  endOffset: number,
): SourceRange {
  return {
    sourceId,
    start: position(line, startColumn, startOffset),
    end: position(line, endColumn, endOffset),
  };
}

export function lexStoryframe(source: string, sourceId = "storyframe://memory"): LexResult {
  const tokens: LineToken[] = [];
  const diagnostics: CompilerDiagnostic[] = [];
  const lines = source.split(/\r?\n/);
  let offset = 0;
  let previousContentIndent = 0;

  lines.forEach((raw, index) => {
    const line = index + 1;
    const newlineWidth = source[offset + raw.length] === "\r" ? 2 : 1;
    if (!raw.trim()) {
      offset += raw.length + (index < lines.length - 1 ? newlineWidth : 0);
      return;
    }

    const leading = raw.match(/^[ \t]*/)?.[0] ?? "";
    const tokenRange = range(
      sourceId,
      line,
      leading.length + 1,
      offset + leading.length,
      raw.length + 1,
      offset + raw.length,
    );
    if (leading.includes("\t")) {
      diagnostics.push({
        severity: "error",
        code: "tabs-not-allowed",
        message: "Storyframe indentation cannot contain tabs.",
        guidance: "Replace each indentation tab with two spaces.",
        range: tokenRange,
      });
    }

    const spaces = leading.replace(/\t/g, "  ").length;
    if (spaces % 2 !== 0) {
      diagnostics.push({
        severity: "error",
        code: "invalid-indentation-width",
        message: `Line ${line} uses ${spaces} indentation spaces.`,
        guidance: "Indent each nesting level with exactly two spaces.",
        range: tokenRange,
      });
    }
    const indent = Math.floor(spaces / 2);
    const text = raw.slice(leading.length).trimEnd();
    const kind = text.startsWith("#") ? "comment" : "content";
    if (kind === "content" && indent > previousContentIndent + 1) {
      diagnostics.push({
        severity: "error",
        code: "indentation-jump",
        message: `Line ${line} jumps from indentation level ${previousContentIndent} to ${indent}.`,
        guidance: "Add the missing parent line or reduce this line's indentation.",
        range: tokenRange,
      });
    }
    if (kind === "content") previousContentIndent = indent;
    tokens.push({ kind, indent, text, raw, range: tokenRange });
    offset += raw.length + (index < lines.length - 1 ? newlineWidth : 0);
  });

  return { tokens, diagnostics };
}

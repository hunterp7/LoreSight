import type { SourceRange, WorldPack } from "@storyframe/world-schema";

export type DeclarationKind =
  | "WORLD"
  | "CANON"
  | "CAST"
  | "ARTIFACT"
  | "STATE"
  | "FRAME"
  | "SPAN"
  | "THREAD"
  | "INTENT"
  | "CHOICE"
  | "RULE"
  | "ENDING"
  | "TEST";

export interface LineToken {
  kind: "content" | "comment";
  indent: number;
  text: string;
  raw: string;
  range: SourceRange;
}

export interface CommentNode {
  text: string;
  range: SourceRange;
}

export type BodyNodeKind = "property" | "list-item" | "instruction";

export interface BodyNode {
  kind: BodyNodeKind;
  key?: string;
  value: string;
  children: BodyNode[];
  range: SourceRange;
}

export interface DeclarationNode {
  kind: DeclarationKind;
  header: string;
  children: BodyNode[];
  range: SourceRange;
}

export interface StoryframeDocument {
  sourceId: string;
  declarations: DeclarationNode[];
  comments: CommentNode[];
}

export type DiagnosticSeverity = "error" | "warning";

export interface CompilerDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  guidance: string;
  range: SourceRange;
}

export interface ParseResult {
  document: StoryframeDocument;
  diagnostics: CompilerDiagnostic[];
}

export type CompileResult =
  | {
      ok: true;
      world: WorldPack;
      document: StoryframeDocument;
      diagnostics: CompilerDiagnostic[];
    }
  | {
      ok: false;
      document: StoryframeDocument;
      diagnostics: CompilerDiagnostic[];
    };

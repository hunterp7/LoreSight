/**
 * Runtime seam for browser interactive-fiction interpreters.
 *
 * The player owns transcript presentation and keyboard behavior; adapters own
 * VM construction and Glk/event plumbing. This lets us evaluate emglken /
 * Parchment without coupling the CRT UI to a second rendering system.
 */
export type InterpreterAdapterId = "ifvms" | "emglken";

export type InterpreterCapabilities = {
  zCode: boolean;
  glulx: boolean;
  saveRestore: boolean;
  audio: boolean;
};

export type InterpreterSession = {
  vm: any;
  bridge: any;
};

export interface InterpreterAdapter {
  readonly id: InterpreterAdapterId;
  readonly capabilities: InterpreterCapabilities;
  create(onChange: () => void): Promise<InterpreterSession>;
}


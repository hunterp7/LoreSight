declare module "*.css";
declare module "*.txt?raw" {
  const source: string;
  export default source;
}
declare module "@openai/apps-sdk-ui/css";
declare module "*.svg" {
  const source: string;
  export default source;
}
declare module "*.png" {
  const source: string;
  export default source;
}
declare module "*.mp3" {
  const source: string;
  export default source;
}
declare module "*.wav" {
  const source: string;
  export default source;
}
declare module "*.z3" {
  const source: string;
  export default source;
}
declare module "*.z5" {
  const source: string;
  export default source;
}
declare module "*.z8" {
  const source: string;
  export default source;
}
declare module "*.zblorb" {
  const source: string;
  export default source;
}
declare module "*.blorb" {
  const source: string;
  export default source;
}
declare module "*.blb" {
  const source: string;
  export default source;
}

interface Window {
  openai?: {
    displayMode?: "inline" | "fullscreen";
    /** Host appearance signal; the CRT phosphor theme remains app-controlled. */
    theme?: "light" | "dark";
    /** Available fullscreen height reported by ChatGPT, in CSS pixels. */
    maxHeight?: number;
    /** Insets reserved by ChatGPT's system chrome and composer, in CSS pixels. */
    safeArea?: { top?: number; right?: number; bottom?: number; left?: number };
    view?: string;
    widgetState?: import("./types").WidgetState;
    setWidgetState?: (state: import("./types").WidgetState) => void;
    requestDisplayMode?: (args: { mode: "inline" | "fullscreen" }) => Promise<unknown>;
    notifyIntrinsicHeight?: () => void;
    callTool?: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
    sendFollowUpMessage?: (args: { prompt: string; scrollToBottom?: boolean }) => Promise<unknown>;
  };
}

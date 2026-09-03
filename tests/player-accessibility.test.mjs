import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const playerSource = await readFile(new URL("../web/src/main.tsx", import.meta.url), "utf8");
const classicIfSource = await readFile(new URL("../web/src/classic-if.tsx", import.meta.url), "utf8");
const playerShellSource = await readFile(new URL("../web/src/player-shell.tsx", import.meta.url), "utf8");
const actionsSource = await readFile(new URL("../web/src/app-actions.ts", import.meta.url), "utf8");
const audioSource = await readFile(new URL("../web/src/audio.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../web/src/styles.css", import.meta.url), "utf8");
const diagnosticsSource = await readFile(new URL("../web/src/diagnostics.ts", import.meta.url), "utf8");
const feedbackSource = await readFile(new URL("../server/src/feedback.ts", import.meta.url), "utf8");

test("inline player exposes the focused Bubble Menu actions", () => {
  assert.match(playerSource, /<BubbleMenu/);
  assert.match(playerSource, /label: "Library"/);
  assert.match(playerSource, /label: "Load"/);
  assert.doesNotMatch(playerSource, /className="native-action-bar"/);
  assert.match(playerSource, /libraryOpen/);
  assert.match(playerSource, /beginCreateStoryIntake/);
});

test("inline actions prefer MCP Apps tools/call and retain preview fallback", () => {
  assert.match(actionsSource, /callServerTool\(\{ name: toolName, arguments: \{\} \}\)/);
  assert.match(actionsSource, /window\.openai\.callTool/);
  assert.match(actionsSource, /storyframe:open-library/);
  assert.match(actionsSource, /storyframe:load-file/);
  assert.match(actionsSource, /open_story_library/);
  assert.match(actionsSource, /load_story_file/);
});

test("create intake uses the portable ui/message bridge with a ChatGPT fallback", () => {
  assert.match(actionsSource, /app\.sendMessage\(\{ role: "user"/);
  assert.match(actionsSource, /window\.openai\?\.sendFollowUpMessage/);
  assert.match(actionsSource, /Ask one question at a time/);
  assert.match(actionsSource, /storyframe:open-create/);
  assert.match(actionsSource, /beginRemixStoryIntake/);
  assert.match(classicIfSource, /startGeneratedPreview/);
  assert.match(classicIfSource, /generationNotice \|\| "Start story"/);
  assert.match(classicIfSource, /LORESIGHT \/ IMAGINED STORY/);
  assert.doesNotMatch(classicIfSource, /Generation request ready for the LoreSight host/);
});

test("remix catalog source requires and sends a concrete story selection", () => {
  assert.match(classicIfSource, /remixCatalogStoryId/);
  assert.match(classicIfSource, /aria-label="Story to remix"/);
  assert.match(classicIfSource, /playSelectedRemixSource/);
  assert.match(classicIfSource, /"Play original"/);
  assert.match(classicIfSource, />Create remix</);
  assert.match(classicIfSource, /event\.key === "Enter"/);
  assert.match(classicIfSource, /storyId: catalogStory\?\.id/);
  assert.match(classicIfSource, /sourceUrl: catalogStory\?\.sourceUrl/);
  assert.match(playerSource, /loresight:remix-story/);
});

test("player interaction surfaces remain accessible and page navigation is consistent", () => {
  assert.match(playerSource, /aria-label="Story terminal"/);
  assert.match(playerSource, /aria-busy=\{false\}/);
  assert.match(playerSource, /onLibraryOpenChange=\{setLibraryOpen\}/);
  assert.match(styles, /\.crt-settings-page, \.crt-library-page, \.crt-controls-page/);
  assert.match(styles, /\.crt-settings-sliders label > input/);
  assert.match(classicIfSource, /ariaLabel="Menu"/);
  assert.match(playerShellSource, /PhysicalNavigationButtons/);
  assert.match(playerShellSource, /storyframe:open-library/);
  assert.match(playerShellSource, /storyframe:open-settings/);
  assert.match(playerShellSource, /bezel-physical-button/);
  assert.match(playerShellSource, /predictiveActions/);
  assert.match(playerShellSource, /storyframe:predictive-action/);
  assert.match(playerShellSource, /mixkit-classic-click-1117\.wav/);
  assert.match(playerSource, /setSettingsOpen\(false\)/);
  assert.match(classicIfSource, /function openLibraryPage\(\)/);
  assert.match(classicIfSource, /function openControlsPage\(\)/);
  assert.match(classicIfSource, /function openRemixPage\(\)/);
  assert.match(classicIfSource, /\[\s*\["ENTER", "submit the current command"\]/);
  assert.match(styles, /\.loresight-bubble-menu-host \.loresight-bubble-menu \{ pointer-events: auto; \}/);
  assert.match(styles, /\.loresight-bubble-menu \.toggle-bubble:hover/);
  assert.match(styles, /\.crt-top-actions \.bubble-menu-items \{ position: fixed;/);
  assert.match(classicIfSource, /derivePredictiveActions/);
  assert.match(classicIfSource, /ascii-art-logo/);
  assert.match(classicIfSource, /snapshot\.storyName !== "No story loaded"/);
  assert.match(classicIfSource, /storyframe:predictive-action/);
  assert.match(classicIfSource, /unique\.length >= 5/);
  assert.match(classicIfSource, /snapshot\.request\.kind === "line" \? \[command\]/);
  assert.doesNotMatch(classicIfSource, /snapshot\.request\.kind === "line" \? \[`> \$\{command\}`\]/);
  assert.doesNotMatch(styles, /has-predictive-actions/);
});

test("story library keeps a compact single-column presentation", () => {
  assert.match(classicIfSource, /<h1 className="story-library-heading">Story library<\/h1>/);
  assert.doesNotMatch(classicIfSource, /playable entries/);
  assert.doesNotMatch(classicIfSource, /Choose a story to fetch/);
  assert.match(styles, /\.story-library-list \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
});

test("theme defaults remain remote-controlled while explicit player saves persist", () => {
  assert.match(playerSource, /fetch\("\/api\/theme-profiles"/);
  assert.match(playerSource, /savedUserThemeEffectsKey = "storyframe\.userThemeEffects\.v1"/);
  assert.match(playerSource, /navigator\.storage\?\.persist/);
  assert.match(classicIfSource, /Save appearance/);
  assert.match(classicIfSource, /saveActiveTheme/);
});

test("audio controls have programmatic names and the UI preserves focus and reduced-motion affordances", () => {
  assert.match(audioSource, /aria-controls="story-audio-panel"/);
  assert.match(audioSource, /aria-label="Background audio track"/);
  assert.match(audioSource, /aria-label="Story audio volume"/);
  assert.match(audioSource, /aria-live="polite"/);
  assert.match(styles, /button:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("feedback is explicit, privacy-bounded, and portable across local and MCP Apps hosts", () => {
  assert.match(classicIfSource, />Send feedback</);
  assert.match(classicIfSource, /Attach \{diagnosticEntryCount\(\)\} safe diagnostic entries/);
  assert.match(classicIfSource, /Never includes story text, commands, form content, passwords, tokens, or URL query data/);
  assert.match(playerSource, /callServerTool\(\{ name: "submit_feedback"/);
  assert.match(playerSource, /fetch\("\/api\/feedback"/);
  assert.match(diagnosticsSource, /MAX_ENTRIES = 80/);
  assert.match(diagnosticsSource, /window\.addEventListener\("unhandledrejection"/);
  assert.match(diagnosticsSource, /\["warn", "error"\]/);
  assert.doesNotMatch(diagnosticsSource, /localStorage/);
  assert.match(feedbackSource, /MAX_BODY_BYTES = 96_000/);
  assert.match(feedbackSource, /entry\.count >= 5/);
  assert.match(feedbackSource, /Bearer \[redacted\]/);
  assert.match(feedbackSource, /\.storyframe-data\/feedback\.jsonl/);
});

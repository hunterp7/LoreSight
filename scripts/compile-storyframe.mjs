import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileStoryframe } from "@storyframe/storyframe";
import { exploreStoryBranches, runAuthoredWorldTests } from "@storyframe/story-debugger";

const args = process.argv.slice(2);
const json = args.includes("--json");
const file = args.find((arg) => !arg.startsWith("--"));

if (!file) {
  console.error("Usage: npm run storyframe:compile -- <world.storyframe> [--json]");
  process.exitCode = 1;
} else {
  const sourceId = resolve(file);
  const source = await readFile(sourceId, "utf8");
  const result = compileStoryframe(source, sourceId);
  if (!result.ok) {
    for (const item of result.diagnostics) {
      const { line, column } = item.range.start;
      console.error(`${item.range.sourceId}:${line}:${column} ${item.severity.toUpperCase()} ${item.code}`);
      console.error(`  ${item.message}`);
      console.error(`  Repair: ${item.guidance}`);
    }
    process.exitCode = 1;
  } else if (json) {
    console.log(JSON.stringify(result.world, null, 2));
  } else {
    const authored = runAuthoredWorldTests(result.world);
    const coverage = exploreStoryBranches(result.world, { maxDepth: 16, maxStates: 2_000, seed: 42 });
    const spanCount = result.world.spans?.length ?? 0;
    console.log(`Compiled ${result.world.manifest.id} v${result.world.manifest.version}`);
    console.log(`  ${result.world.frames?.length ?? 0} frames/endings`);
    console.log(`  ${spanCount} elastic span declaration${spanCount === 1 ? "" : "s"}`);
    console.log(`  ${result.world.intents.length} intents`);
    console.log(`  ${result.world.rules?.length ?? 0} reactive rules`);
    console.log(`  ${result.world.canon.length} canon facts`);
    console.log(`  ${authored.passed} authored tests passed, ${authored.failed} failed`);
    console.log(`  coverage: ${coverage.coverage.frames}% frames, ${coverage.coverage.intents}% intents, ${coverage.coverage.rules}% rules`);
    console.log(`  ${coverage.deadEnds.length} active dead ends; search ${coverage.complete ? "complete" : "truncated"}`);
    console.log(`  ${Object.keys(result.world.sourceMap ?? {}).length} source-map entries`);
  }
}

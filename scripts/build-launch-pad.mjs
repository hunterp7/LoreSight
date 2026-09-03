import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outDir = resolve("launch/dist");
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: ["launch/src/main.tsx"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "launch/dist/app.js",
  loader: { ".css": "css" },
  minify: true,
  sourcemap: false,
});

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>LoreSight Launch Pad — Practice</title>
    <link rel="stylesheet" href="/launch-pad/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="/launch-pad/app.js" defer></script>
  </body>
</html>`;

await writeFile(resolve(outDir, "index.html"), html, "utf8");

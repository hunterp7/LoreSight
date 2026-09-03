import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outDir = resolve("admin/dist");
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: ["admin/src/main.tsx"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "admin/dist/app.js",
  loader: { ".css": "css" },
  minify: true,
  sourcemap: false,
});

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LoreSight Operations</title>
    <link rel="stylesheet" href="/admin/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="/admin/app.js" defer></script>
  </body>
</html>`;

await writeFile(resolve(outDir, "index.html"), html, "utf8");

import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outDir = resolve("web/dist");
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: ["web/src/main.tsx"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "web/dist/widget.js",
  loader: { ".css": "css", ".svg": "dataurl", ".png": "dataurl", ".mp3": "dataurl", ".wav": "dataurl", ".z3": "dataurl", ".z5": "dataurl", ".z8": "dataurl", ".zblorb": "dataurl", ".blorb": "dataurl", ".blb": "dataurl" },
  minify: true,
  sourcemap: false,
});

const [javascript, css] = await Promise.all([
  readFile("web/dist/widget.js", "utf8"),
  readFile("web/dist/widget.css", "utf8"),
]);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LoreSight — Interactive Fiction</title>
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${javascript}</script>
  </body>
</html>`;

await writeFile(resolve(outDir, "loresight-widget.html"), html, "utf8");

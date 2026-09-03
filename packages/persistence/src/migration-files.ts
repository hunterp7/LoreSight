import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import type { StoryframeMigration } from "./migrations.js";

/** Loads only canonical NNNN_lower_snake_case.sql files from one directory. */
export async function loadStoryframeMigrations(directory: string): Promise<StoryframeMigration[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && /^\d{4}_[a-z0-9_]+\.sql$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(filenames.map(async (filename) => ({
    id: basename(filename, ".sql"),
    sql: await readFile(join(directory, filename), "utf8"),
  })));
}

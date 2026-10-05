// The C-16 shape of live data (plan 03.2-02): what the database holds after scripts/import-catalog.mjs, written back
// as fixtures, so a build or a read from fixtures can be compared with a build or a read from the database.
//
//   - sample blocked dates are not imported (the stay rows arrive with is_sample false and sample_fields [])
//   - min_nights is not imported: the database default is 1 (STAY-06), the fixtures hold null
//
// Nothing else changes: no other file, no other field, and the key order of every row is kept (the build serialises rows
// into client props, so key order reaches the HTML bytes).
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FIXTURES = resolve(import.meta.dirname, "..", "..", "lib", "data", "fixtures");

/** The rows of one fixture file as the live database returns them. Other files come back unchanged. */
export function liveShaped(name, rows) {
  if (name !== "stays") return rows;
  return rows.map((row) => ({
    ...row,
    is_sample: false,
    sample_fields: [],
    min_nights: 1,
    blocked_dates: [],
  }));
}

/** Copies every fixture file of lib/data/fixtures to `dir` (created), stays.json in its live shape. Returns `dir`. */
export function writeLiveShapedFixtures(dir) {
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(FIXTURES)) {
    if (!file.endsWith(".json")) continue;
    const name = file.replace(/\.json$/, "");
    if (name === "stays") {
      const rows = JSON.parse(readFileSync(join(FIXTURES, file), "utf8"));
      writeFileSync(join(dir, file), `${JSON.stringify(liveShaped(name, rows), null, 2)}\n`);
    } else {
      copyFileSync(join(FIXTURES, file), join(dir, file));
    }
  }
  return dir;
}

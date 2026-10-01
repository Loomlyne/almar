// Compares tests/screens/before with tests/screens/after (or any two directories)
// with Playwright's bundled image comparator. No dependency added.
//   node scripts/screens-diff.mjs                      print ratios, write tests/screens/INDEX.md
//   node scripts/screens-diff.mjs --no-index A B       print ratios for directories A and B only
import { createRequire } from "node:module";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { getComparator } = require("playwright-core/lib/coreBundle").utils;
const compare = getComparator("image/png");

const args = process.argv.slice(2);
const writeIndex = !args.includes("--no-index");
const rest = args.filter((a) => !a.startsWith("--"));
const beforeDir = rest[0] ?? "tests/screens/before";
const afterDir = rest[1] ?? "tests/screens/after";

/** Pixel ratio of differing pixels: 0 when identical, 1 when the sizes differ. */
export function diffRatio(before, after) {
  const result = compare(after, before, { maxDiffPixelRatio: 0, threshold: 0.2 });
  if (result == null) return 0;
  const m = /ratio ([0-9.]+)/.exec(result.errorMessage ?? "");
  return m ? Number(m[1]) : 1;
}

const names = readdirSync(beforeDir).filter((n) => n.endsWith(".png")).sort();
const rows = names.map((name) => {
  const stem = name.replace(/\.png$/, "");
  const [route, locale, width] = [stem.replace(/-(en|ar)-\d+$/, ""), /-(en|ar)-/.exec(stem)[1], /-(\d+)$/.exec(stem)[1]];
  const ratio = diffRatio(readFileSync(join(beforeDir, name)), readFileSync(join(afterDir, name)));
  return { name, route, locale, width, ratio };
});

for (const r of rows) console.log(`${r.name}\t${r.ratio.toFixed(4)}`);

if (writeIndex) {
  const lines = [
    "# Screens: before and after (plan 03.1-27)",
    "",
    "Before: `tests/screens/before/` (pre-conversion baseline, never regenerated).",
    "After: `tests/screens/after/` (`SCREENS_MODE=after npx playwright test tests/screens-before-after.spec.ts --workers=1`).",
    "Diff ratio: share of pixels that differ (0 = identical, 1 = different size or fully different). Produced by `node scripts/screens-diff.mjs`.",
    "",
    "| Route | Locale | Width | Before | After | Diff ratio |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.route} | ${r.locale} | ${r.width} | tests/screens/before/${r.name} | tests/screens/after/${r.name} | ${r.ratio.toFixed(4)} |`,
    ),
    "",
    "## Intended differences for owner UAT",
    "",
    "- Primary buttons and headings are teal (was the old blue-teal); gold is lines only.",
    "- Link hover shows a 1px gold underline.",
    "- Corners are square everywhere (radius 0).",
    "- The /account language select is a working control (was broken).",
    "- Nav: stacked charcoal logo from brand/, currency and language selects, no monogram.",
    "- Type scale 12, 14, 16, 20, 32, 48, 64; phone sizes are smaller for hero, display, heading.",
    "",
  ];
  writeFileSync("tests/screens/INDEX.md", lines.join("\n"));
}

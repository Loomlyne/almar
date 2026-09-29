import test from "node:test";
import assert from "node:assert/strict";
import { HOME_COPY } from "../lib/copy/home.ts";
import { GUEST_COPY } from "../lib/copy/guest.ts";
import { DASHBOARD_COPY } from "../lib/copy/dashboard.ts";
import { FRAMER_SOURCE_COPY } from "../lib/copy/framer-source.ts";

// Plan 10 adds { file: "lib/copy/journey.ts", table: JOURNEY_COPY } here.
const AREAS = [
  { file: "lib/copy/home.ts", table: HOME_COPY },
  { file: "lib/copy/guest.ts", table: GUEST_COPY },
  { file: "lib/copy/dashboard.ts", table: DASHBOARD_COPY },
  { file: "lib/copy/framer-source.ts", table: FRAMER_SOURCE_COPY },
];

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Compare `en` node to `other` node; push problems as strings naming the path. */
function walk(en, other, path, problems) {
  if (Array.isArray(en)) {
    if (!Array.isArray(other)) return problems.push(`${path}: expected array`);
    if (en.length !== other.length) problems.push(`${path}: length ${other.length}, en has ${en.length}`);
    en.forEach((item, i) => walk(item, other[i], `${path}[${i}]`, problems));
  } else if (isObj(en)) {
    if (!isObj(other)) return problems.push(`${path}: expected object`);
    for (const key of Object.keys(en)) {
      if (!(key in other)) problems.push(`${path}.${key}: missing`);
      else walk(en[key], other[key], `${path}.${key}`, problems);
    }
  } else if (typeof en === "string") {
    if (typeof other !== "string") problems.push(`${path}: expected string`);
    else if (other.trim() === "") problems.push(`${path}: empty string`);
  }
}

for (const { file, table } of AREAS) {
  for (const locale of ["ar", "es"]) {
    test(`${file}: every en key exists in ${locale} with a non-empty value`, () => {
      assert.ok(table.en && table[locale], `${file}: locale table missing`);
      const problems = [];
      walk(table.en, table[locale], `${file} [${locale}]`, problems);
      assert.deepEqual(problems, []);
    });
  }
}

test("walk reports the path of a missing ar key", () => {
  const problems = [];
  walk({ a: { b: "x" } }, { a: {} }, "sample [ar]", problems);
  assert.deepEqual(problems, ["sample [ar].a.b: missing"]);
});

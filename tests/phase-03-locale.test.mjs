import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { FRAMER_SOURCE_COPY } from "../lib/copy/framer-source.ts";

const LOCKED = {
  Destinations: { ar: "الوجهات", es: "Destinos" },
  Search: { ar: "بحث", es: "Buscar" },
  Close: { ar: "إغلاق", es: "Cerrar" },
};

test("the home string table has en, ar, and es for Destinations, Search, and Close", () => {
  for (const key of Object.keys(LOCKED)) {
    assert.equal(FRAMER_SOURCE_COPY.en[key], key);
    assert.equal(FRAMER_SOURCE_COPY.ar[key], LOCKED[key].ar);
    assert.equal(FRAMER_SOURCE_COPY.es[key], LOCKED[key].es);
  }
});

test("the copy module does not contain next-intl", () => {
  const source = readFileSync("lib/copy/framer-source.ts", "utf8");
  assert.equal(source.includes("next-intl"), false);
});

// 3.3 plan 04 (design 7.12): the Framer home is gone, so the old "read only GET handler" test goes with it.
// The two FRAMER_SOURCE_COPY tests above stay as they were.
test("app/route.ts is gone and no home file imports copy/framer-source", () => {
  assert.equal(existsSync("app/route.ts"), false);
  const files = ["app/page.tsx", "app/ar/page.tsx", "app/es/page.tsx", "components/pages/home-page.tsx"];
  for (const dir of ["components/pages/home"]) {
    for (const name of readdirSync(dir)) files.push(`${dir}/${name}`);
  }
  for (const file of files) {
    assert.equal(readFileSync(file, "utf8").includes("copy/framer-source"), false, file);
  }
});

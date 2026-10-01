import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("app/route.ts is read only and still exports a GET handler", () => {
  const source = readFileSync("app/route.ts", "utf8");
  assert.match(source, /export function GET\s*\(/);
  assert.equal(source.includes("copy/framer-source"), false);
});

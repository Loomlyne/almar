import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { assembleOut } from "../scripts/assemble-cloudflare.mjs";

const STAY = "private-stays/getsemani-colonial-house";

function fixture(files) {
  const base = mkdtempSync(join(tmpdir(), "almar-assemble-"));
  const put = (rel, text = rel) => {
    const full = join(base, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  };
  for (const f of files) put(`app/${f}`, `source:${f}`);
  put("static/css/x.css", "body{}");
  put("public/assets/x.webp", "webp");
  put("_headers", "/*\n  X-Test: 1\n");
  const paths = {
    appDir: join(base, "app"),
    staticDir: join(base, "static"),
    outDir: join(base, "out"),
    publicDir: join(base, "public"),
    headersFile: join(base, "_headers"),
  };
  return { base, paths, out: (rel) => join(paths.outDir, rel) };
}

const FRAMER = ["index.body", "about.body", "private-stays.body", `${STAY}.body`];
const NOT_PUBLIC = ["account.html", "dashboard/home.html", "login.html", "booking/trip.html", "_not-found.html"];
const LOCALISED = [
  "ar.html",
  "es.html",
  "ar/private-stays.html",
  "es/private-stays.html",
  `ar/${STAY}.html`,
  `es/${STAY}.html`,
];

test("fixture A: locale homes, public .html, framer bodies, static, three 404s; dashboard stays out", () => {
  const f = fixture([...FRAMER, ...NOT_PUBLIC, ...LOCALISED]);
  const report = assembleOut(f.paths);

  assert.equal(readFileSync(f.out("ar/index.html"), "utf8"), "source:ar.html");
  assert.equal(readFileSync(f.out("es/index.html"), "utf8"), "source:es.html");
  assert.equal(existsSync(f.out("ar.html")), false);
  assert.equal(existsSync(f.out("es.html")), false);
  assert.equal(readFileSync(f.out("ar/private-stays.html"), "utf8"), "source:ar/private-stays.html");
  assert.equal(readFileSync(f.out(`es/${STAY}.html`), "utf8"), `source:es/${STAY}.html`);

  for (const gone of ["account.html", "dashboard", "login.html", "booking", "_not-found.html"]) {
    assert.equal(existsSync(f.out(gone)), false, `out/${gone} must not exist`);
  }
  for (const kept of ["index.html", "about.html", "private-stays.html", `${STAY}.html`]) {
    assert.ok(existsSync(f.out(kept)), `out/${kept}`);
  }

  const en = readFileSync(f.out("404.html"), "utf8");
  const ar = readFileSync(f.out("ar/404.html"), "utf8");
  const es = readFileSync(f.out("es/404.html"), "utf8");
  assert.ok(en.includes('<html lang="en" dir="ltr">') && en.includes('<a href="/">'));
  assert.ok(ar.includes('<html lang="ar" dir="rtl">') && ar.includes('<a href="/ar/">'));
  assert.ok(es.includes('<html lang="es" dir="ltr">') && es.includes('<a href="/es/">'));

  assert.equal(readFileSync(f.out("_next/static/css/x.css"), "utf8"), "body{}");
  assert.ok(existsSync(f.out("assets/x.webp")));
  assert.ok(existsSync(f.out("_headers")));

  assert.equal(report.framer.length, 4);
  assert.deepEqual(report.react.en, []);
  assert.equal(report.react.ar.length, 3);
  assert.equal(report.react.es.length, 3);
  assert.deepEqual(report.notFound, ["404.html", "ar/404.html", "es/404.html"]);
  assert.equal(report.total, 4 + 6 + 3);
});

test("fixture B: no locale home built, so the AR and ES 404 home links are /", () => {
  const f = fixture(FRAMER);
  const report = assembleOut(f.paths);
  assert.ok(readFileSync(f.out("ar/404.html"), "utf8").includes('<a href="/">'));
  assert.ok(readFileSync(f.out("es/404.html"), "utf8").includes('<a href="/">'));
  assert.equal(existsSync(f.out("_next")), false, "no React document, so no /_next/static is copied");
  assert.equal(report.framer.length, 4);
  assert.deepEqual(report.react, { en: [], ar: [], es: [] });
  assert.deepEqual(report.notFound.length, 3);
});

test("fixture C: two sources for one destination throws", () => {
  const f = fixture(["index.body", "index.html", "about.body"]);
  assert.throws(() => assembleOut(f.paths), /two sources/);
});

test("fixture D: an AR page with no ES twin throws", () => {
  const f = fixture([...FRAMER, "ar/private-stays.html"]);
  assert.throws(() => assembleOut(f.paths), /ar pages without an es twin/);
});

test("fixture E: an AR and ES page with no English page throws", () => {
  const f = fixture(["index.body", "about.body", "ar/private-stays.html", "es/private-stays.html"]);
  assert.throws(() => assembleOut(f.paths), /no English page/);
});

test("React documents with no .next/static throw", () => {
  const f = fixture([...FRAMER, "ar.html", "es.html"]);
  f.paths.staticDir = join(f.base, "missing-static");
  assert.throws(() => assembleOut(f.paths), /unstyled/);
});

test("a missing English home throws", () => {
  const f = fixture(["about.body"]);
  assert.throws(() => assembleOut(f.paths), /assemble incomplete/);
});

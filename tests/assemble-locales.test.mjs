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

// Job 21: every page is prefixed, English too (app/en/…); English pages that have an ar/es twin are React documents.
const FRAMER = ["en/about.body", "en/contact.body", "en/blog.body", "en/destinations.body"];
const NOT_PUBLIC = [
  "account.html",
  "dashboard/home.html",
  "login.html",
  "en/login.html",
  "en/account.html",
  "ar/bookings.html",
  // Plan 04-03: booking/trip is a public page now (PUBLIC_PAGES); another page under /booking still never ships.
  "booking/other.html",
  "_not-found.html",
];
const LOCALISED = [
  "en.html",
  "en/private-stays.html",
  `en/${STAY}.html`,
  "ar.html",
  "es.html",
  "ar/private-stays.html",
  "es/private-stays.html",
  `ar/${STAY}.html`,
  `es/${STAY}.html`,
  "en/booking/trip.html",
  "ar/booking/trip.html",
  "es/booking/trip.html",
];

test("fixture A: three locale homes, public .html, framer bodies, static, three 404s; dashboard stays out", () => {
  const f = fixture([...FRAMER, ...NOT_PUBLIC, ...LOCALISED]);
  const report = assembleOut(f.paths);

  assert.equal(readFileSync(f.out("en/index.html"), "utf8"), "source:en.html");
  assert.equal(readFileSync(f.out("ar/index.html"), "utf8"), "source:ar.html");
  assert.equal(readFileSync(f.out("es/index.html"), "utf8"), "source:es.html");
  assert.equal(existsSync(f.out("index.html")), false, `"/" is the Worker's language redirect, never a static page`);
  assert.equal(existsSync(f.out("en.html")), false);
  assert.equal(existsSync(f.out("ar.html")), false);
  assert.equal(existsSync(f.out("es.html")), false);
  assert.equal(readFileSync(f.out("ar/private-stays.html"), "utf8"), "source:ar/private-stays.html");
  assert.equal(readFileSync(f.out(`es/${STAY}.html`), "utf8"), `source:es/${STAY}.html`);

  for (const gone of ["account.html", "dashboard", "login.html", "en/login.html", "en/account.html", "ar/bookings.html", "booking/other.html", "_not-found.html"]) {
    assert.equal(existsSync(f.out(gone)), false, `out/${gone} must not exist`);
  }
  for (const kept of ["en/index.html", "en/about.html", "en/private-stays.html", `en/${STAY}.html`, "en/booking/trip.html", "ar/booking/trip.html", "es/booking/trip.html"]) {
    assert.ok(existsSync(f.out(kept)), `out/${kept}`);
  }

  const en = readFileSync(f.out("404.html"), "utf8");
  const ar = readFileSync(f.out("ar/404.html"), "utf8");
  const es = readFileSync(f.out("es/404.html"), "utf8");
  assert.ok(en.includes('<html lang="en" dir="ltr">') && en.includes('<a href="/en/">'));
  assert.ok(ar.includes('<html lang="ar" dir="rtl">') && ar.includes('<a href="/ar/">'));
  assert.ok(es.includes('<html lang="es" dir="ltr">') && es.includes('<a href="/es/">'));

  assert.equal(readFileSync(f.out("_next/static/css/x.css"), "utf8"), "body{}");
  assert.ok(existsSync(f.out("assets/x.webp")));
  assert.ok(existsSync(f.out("_headers")));

  assert.equal(report.framer.length, 4);
  assert.equal(readFileSync(f.out("ar/booking/trip.html"), "utf8"), "source:ar/booking/trip.html");

  assert.equal(report.react.en.length, 4);
  assert.equal(report.react.ar.length, 4);
  assert.equal(report.react.es.length, 4);
  assert.deepEqual(report.notFound, ["404.html", "ar/404.html", "es/404.html"]);
  assert.equal(report.total, 4 + 12 + 3);
});

test("fixture B: the ops target (pages: false) ships no page, so every 404 home link is /", () => {
  const f = fixture(FRAMER);
  const report = assembleOut({ ...f.paths, pages: false });
  for (const dest of ["404.html", "ar/404.html", "es/404.html"]) {
    assert.ok(readFileSync(f.out(dest), "utf8").includes('<a href="/">'), dest);
  }
  assert.equal(existsSync(f.out("en/about.html")), false, "no page ships on the ops target");
  assert.equal(report.framer.length, 0);
  assert.deepEqual(report.react, { en: [], ar: [], es: [] });
  assert.deepEqual(report.notFound.length, 3);
});

test("fixture C: two sources for one destination throws", () => {
  const f = fixture(["en.body", "en.html", "en/about.body"]);
  assert.throws(() => assembleOut(f.paths), /two sources/);
});

test("fixture D: an AR page with no ES twin throws", () => {
  const f = fixture([...FRAMER, "ar/private-stays.html"]);
  assert.throws(() => assembleOut(f.paths), /ar pages without an es twin/);
});

test("fixture E: an AR and ES page with no English page throws", () => {
  // Job 21: the en/ar twin check fires before the older "no English page" check, which a page set that passes it can no longer reach.
  const f = fixture(["en.body", "en/about.body", "ar/private-stays.html", "es/private-stays.html"]);
  assert.throws(() => assembleOut(f.paths), /ar pages without an en twin/);
});

test("React documents with no .next/static throw", () => {
  const f = fixture([...FRAMER, "en.html", "ar.html", "es.html"]);
  f.paths.staticDir = join(f.base, "missing-static");
  assert.throws(() => assembleOut(f.paths), /unstyled/);
});

test("a missing English home throws", () => {
  const f = fixture(["en/about.body"]);
  assert.throws(() => assembleOut(f.paths), /assemble incomplete/);
});

test("an unprefixed page throws: every page lives under /en, /ar or /es (job 21)", () => {
  for (const file of ["index.body", "about.body", "private-stays.html", "booking/trip.html"]) {
    const f = fixture([...FRAMER, file]);
    assert.throws(() => assembleOut(f.paths), /would ship unprefixed/, file);
  }
});

test("an English react page with no ar/es twin throws (job 21)", () => {
  const f = fixture([...FRAMER, "en.html", "en/private-stays.html", "ar.html", "es.html"]);
  assert.throws(() => assembleOut(f.paths), /en pages without an ar twin: \/en\/private-stays/);
});

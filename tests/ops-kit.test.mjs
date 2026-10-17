// Phase 3.2 plan 11: the dashboard editor kit (components/ops). The pure checks, the copy, the client over the contract
// envelope, the source guards and the markup of the controls. No server, no port: the browser behaviour of the same kit
// is tests/ops-kit.spec.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";
import { loadRenderer } from "./helpers/render-component.mjs";

const KIT = "components/ops";
const CONTRACT = ".planning/phases/03.2-real-catalog-and-team-inserted/03.2-API-CONTRACT.md";
const LOCALES = ["en", "ar", "es"];

const kitFiles = () => readdirSync(KIT).filter((name) => /\.(?:ts|tsx)$/.test(name)).sort();
const read = (name) => readFileSync(join(KIT, name), "utf8");

// ---- publish-check (contract 5.9) -----------------------------------------------------------------------------------

const { missingForPublish } = await loadTs(`${KIT}/publish-check.ts`);

const text = (record) => ({ ...record });
const allThree = (record) => ({ en: text(record), ar: text(record), es: text(record) });

test("destination: an empty Arabic record, a blank Spanish name and no photo are three gaps", () => {
  assert.deepEqual(
    missingForPublish("destination", {
      translations: { en: { name: "X" }, ar: null, es: { name: "" } },
      media_id: null,
    }),
    [
      { locale: "ar", field: "name" },
      { locale: "es", field: "name" },
      { locale: null, field: "hero_media_id" },
    ],
  );
});

test("a complete destination has nothing missing", () => {
  assert.deepEqual(missingForPublish("destination", { translations: allThree({ name: "X" }), media_id: "m1" }), []);
});

test("a name of spaces counts as empty (trimmed length above 0 is present)", () => {
  assert.deepEqual(
    missingForPublish("destination", {
      translations: { en: { name: "X" }, ar: { name: "   " }, es: { name: "X" } },
      media_id: "m1",
    }),
    [{ locale: "ar", field: "name" }],
  );
});

test("a text field filled in English must be filled in Arabic and Spanish too", () => {
  const gaps = missingForPublish("destination", {
    translations: {
      en: { name: "X", short_line: "Y", region: "", summary: "Z" },
      ar: { name: "X", short_line: "Y", region: "", summary: "" },
      es: { name: "X", short_line: "", region: "R", summary: "Z" },
    },
    media_id: "m1",
  });
  // `region` is empty in English, so the other languages may be empty or not.
  assert.deepEqual(gaps, [
    { locale: "ar", field: "summary" },
    { locale: "es", field: "short_line" },
  ]);
});

test("stay: the destination must be published, and an array follows English by length with no empty item", () => {
  const stay = (destination_published, ar, es) =>
    missingForPublish("stay", {
      translations: {
        en: { title: "T", amenities: ["a", "b"] },
        ar: { title: "T", amenities: ar },
        es: { title: "T", amenities: es },
      },
      media_id: "m1",
      destination_published,
    });
  assert.deepEqual(stay(true, ["a", "b"], ["a", "b"]), []);
  assert.deepEqual(stay(false, ["a", "b"], ["a", "b"]), [{ locale: null, field: "destination_published" }]);
  assert.deepEqual(stay(undefined, ["a", "b"], ["a", "b"]), [{ locale: null, field: "destination_published" }]);
  assert.deepEqual(stay(true, ["a"], ["a", " "]), [
    { locale: "ar", field: "amenities" },
    { locale: "es", field: "amenities" },
  ]);
});

test("stay: no hero is a gap named hero_media_id", () => {
  const gaps = missingForPublish("stay", {
    translations: allThree({ title: "T" }),
    media_id: null,
    destination_published: true,
  });
  assert.deepEqual(gaps, [{ locale: null, field: "hero_media_id" }]);
});

test("catalog_item: at least one destination, a name in all three languages and an image", () => {
  const item = (destination_ids) =>
    missingForPublish("catalog_item", { translations: allThree({ name: "N" }), media_id: "m1", destination_ids });
  assert.deepEqual(item(["d1"]), []);
  assert.equal(item([]).some((gap) => gap.locale === null && gap.field === "destination_ids"), true);
  assert.equal(item(undefined).some((gap) => gap.locale === null && gap.field === "destination_ids"), true);
  assert.deepEqual(
    missingForPublish("catalog_item", { translations: allThree({ name: "N" }), media_id: null, destination_ids: ["d1"] }),
    [{ locale: null, field: "media_id" }],
  );
});

test("journey_tier requires name and price_label in all three languages, and media_id", () => {
  assert.deepEqual(missingForPublish("journey_tier", { translations: {}, media_id: null }), [
    { locale: "en", field: "name" },
    { locale: "en", field: "price_label" },
    { locale: "ar", field: "name" },
    { locale: "ar", field: "price_label" },
    { locale: "es", field: "name" },
    { locale: "es", field: "price_label" },
    { locale: null, field: "media_id" },
  ]);
});

test("team_member requires a name in all three languages only: no photo rule", () => {
  assert.deepEqual(missingForPublish("team_member", { translations: {}, media_id: null }), [
    { locale: "en", field: "name" },
    { locale: "ar", field: "name" },
    { locale: "es", field: "name" },
  ]);
  assert.deepEqual(missingForPublish("team_member", { translations: allThree({ name: "N" }), media_id: null }), []);
});

// ---- copy and error text --------------------------------------------------------------------------------------------

const copyModule = await loadTs("lib/copy/ops-kit.ts");
const { OPS_KIT_COPY, KIT_ERROR_CODES, fillCopy } = copyModule;
const { errorText, missingLine, missingFromError } = await loadTs(`${KIT}/error-text.ts`);

/** `path -> string` for every leaf of the copy object. */
function leaves(value, prefix = "", out = new Map()) {
  if (typeof value === "string") out.set(prefix, value);
  else for (const [key, next] of Object.entries(value)) leaves(next, prefix ? `${prefix}.${key}` : key, out);
  return out;
}

test("OPS_KIT_COPY has the same keys in en, ar and es, none empty, with the same {tokens}", () => {
  const maps = Object.fromEntries(LOCALES.map((locale) => [locale, leaves(OPS_KIT_COPY[locale])]));
  const keys = [...maps.en.keys()].sort();
  assert.ok(keys.length > 80, "the copy is not empty");
  for (const locale of LOCALES) {
    assert.deepEqual([...maps[locale].keys()].sort(), keys, `${locale} keys`);
    for (const [key, value] of maps[locale]) {
      assert.equal(typeof value, "string", `${locale}.${key}`);
      assert.ok(value.trim().length > 0, `${locale}.${key} is empty`);
    }
  }
  const tokens = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of keys) {
    for (const locale of ["ar", "es"]) {
      assert.deepEqual(tokens(maps[locale].get(key)), tokens(maps.en.get(key)), `${locale}.${key} tokens`);
    }
  }
});

test("the Spanish copy speaks usted (owner, 2026-10-14: all dashboard copy), never tú", () => {
  const informal = /\b(?:tú|tu|te|deja|elige|revisa|inténtalo|intentalo|inicia|abre|cierra|actualiza|quítalo|publica|arrastra|selecciona|escribe|elimina|guarda|pulsa|haz|vuelve)\b/i;
  for (const [key, value] of leaves(OPS_KIT_COPY.es)) assert.equal(informal.test(value), false, `es.${key}: "${value}" is informal`);
  const es = OPS_KIT_COPY.es;
  assert.equal(es.unpublishFirst, "Primero deje de publicarlo");
  assert.equal(es.dragHandle, "Arrastre para reordenar");
  assert.equal(es.invalidField, "Revise {field} e inténtelo de nuevo.");
  assert.equal(es.errors.not_owner, "Esta sesión no es la del propietario. Inicie sesión de nuevo.");
  assert.equal(es.errors.network, "Sin conexión. Revise su conexión a internet e inténtelo de nuevo.");
  assert.equal(es.datePickLast, "Elija el último día. Elija el mismo día otra vez para un solo día.");
  assert.equal(es.datePickAfter, "Elija un día a partir del {date}.");
  const header = readFileSync("lib/copy/ops-kit.ts", "utf8");
  assert.match(header, /formal "usted"/, "the file header says usted");
  assert.equal(header.includes('informal "tú"'), false);
});

test("the editor lines 03.2-06 drafted (its `panel` group) are taken verbatim in en, ar and es", () => {
  assert.equal(OPS_KIT_COPY.en.editor.translationsUpdated, "Arabic and Spanish updated");
  assert.equal(OPS_KIT_COPY.en.editor.editTranslations, "Edit translations");
  assert.equal(OPS_KIT_COPY.ar.editor.editTranslations, "تعديل الترجمات");
  assert.equal(OPS_KIT_COPY.es.editor.translationsUpdated, "Árabe y español actualizados");
  assert.equal(
    OPS_KIT_COPY.en.editor.translationFailed,
    "The Arabic and Spanish translation did not finish, so Publish is waiting. Save again to try once more, or open Edit translations and type them yourself.",
  );
  assert.deepEqual(OPS_KIT_COPY.en.editor.sections, { text: "Text", price: "Price", photo: "Photo", settings: "Settings", connections: "Connections" });
  // No language tabs, Draft notes or "I checked" box any more (owner, 2026-10-14).
  for (const gone of ["languageTabs", "sections", "draftNote", "checkedTranslation", "missing"]) assert.equal(gone in OPS_KIT_COPY.en, false, gone);
  // The limit line keeps the reset time of the translate route; no price, no rate.
  for (const locale of LOCALES) assert.match(OPS_KIT_COPY[locale].editor.translationLimit, /04:00/);
});

test("fillCopy fills named tokens and leaves an unknown one as written", () => {
  assert.equal(fillCopy("{n} selected", { n: 3 }), "3 selected");
  assert.equal(fillCopy("{a} {b}", { a: "x" }), "x {b}");
});

/** The codes of contract 1.1, read from its table so the test follows the contract. */
function contractCodes() {
  const doc = readFileSync(CONTRACT, "utf8");
  const section = doc.slice(doc.indexOf("### 1.1 Response envelope"), doc.indexOf("### 1.2 Shared value shapes"));
  const codes = [];
  for (const line of section.split("\n")) {
    if (!/^\|\s*\d{3}/.test(line)) continue;
    codes.push(...[...(line.split("|")[2] ?? "").matchAll(/`([a-z_]+)`/g)].map((m) => m[1]));
  }
  return codes;
}

test("errorText says every contract 1.1 code in a sentence of its own, in en, ar and es", () => {
  const codes = contractCodes();
  assert.ok(codes.length >= 15, `read ${codes.length} codes from the contract`);
  for (const code of [...codes, "network"]) {
    assert.ok(KIT_ERROR_CODES.includes(code), `${code} is in the kit's code list`);
    for (const locale of LOCALES) {
      const copy = OPS_KIT_COPY[locale];
      const sentence = errorText(copy, { code, field: null, locale: null, detail: null });
      assert.ok(sentence.trim().length > 0, `${locale} ${code}`);
      if (code !== "unavailable") assert.notEqual(sentence, copy.errors.unavailable, `${locale} ${code} has its own sentence`);
    }
  }
});

test("errorText: an unknown code says the unavailable sentence", () => {
  for (const locale of LOCALES) {
    const copy = OPS_KIT_COPY[locale];
    assert.equal(errorText(copy, { code: "teapot", field: null, locale: null, detail: null }), copy.errors.unavailable);
  }
});

test("errorText: the sentences of the contract's own examples", () => {
  const copy = OPS_KIT_COPY.en;
  assert.equal(
    errorText(copy, { code: "slug_taken", field: "slug", locale: null, detail: null }),
    "Another item already uses this web address.",
  );
  assert.equal(
    errorText(copy, { code: "rate_overlap", field: null, locale: null, detail: { conflict_id: "x" } }),
    "Another range of the same length already covers these nights.",
  );
});

test("errorText never prints `detail` (T-3.2-11-03); `invalid` names its field in words", () => {
  const copy = OPS_KIT_COPY.en;
  const secret = "SECRET-DETAIL-123";
  for (const code of KIT_ERROR_CODES) {
    assert.equal(errorText(copy, { code, field: null, locale: null, detail: { secret } }).includes(secret), false, code);
  }
  assert.equal(
    errorText(copy, { code: "invalid", field: "translations.ar.title", locale: "ar", detail: null }),
    "Check title and try again.",
  );
  assert.equal(
    errorText(copy, { code: "invalid", field: "range.first_night", locale: null, detail: null }, (field) => (field === "first_night" ? "First night" : undefined)),
    "Check First night and try again.",
  );
});

test("missingLine reads a gap in words, in each language", () => {
  const gap = { locale: "ar", field: "title" };
  assert.equal(missingLine(OPS_KIT_COPY.en, gap), "Arabic title");
  assert.equal(missingLine(OPS_KIT_COPY.es, gap), "Título en árabe");
  assert.equal(missingLine(OPS_KIT_COPY.ar, gap), "العنوان (العربية)");
  assert.equal(missingLine(OPS_KIT_COPY.en, { locale: null, field: "hero_media_id" }), "A photo");
  assert.equal(missingLine(OPS_KIT_COPY.en, { locale: null, field: "destination_ids" }), "One destination");
  assert.equal(missingLine(OPS_KIT_COPY.en, { locale: null, field: "destination_published" }), "The destination is published");
});

test("a server 409 publish_incomplete reads back as the same MissingItem list", () => {
  const error = {
    code: "publish_incomplete",
    field: null,
    locale: null,
    detail: { missing: [{ locale: "ar", field: "title" }, { locale: null, field: "hero_media_id" }, { locale: "xx", field: "name" }, { field: "" }, 7] },
  };
  assert.deepEqual(missingFromError(error), [
    { locale: "ar", field: "title" },
    { locale: null, field: "hero_media_id" },
    { locale: null, field: "name" },
  ]);
  assert.deepEqual(missingFromError({ ...error, detail: null }), []);
  assert.equal(missingFromError({ ...error, code: "slug_taken" }), null);
  assert.equal(missingFromError(null), null);
});

// ---- ops-client (contract 1.1 envelope) -----------------------------------------------------------------------------

const { opsFetch, opsSend, opsPut } = await loadTs(`${KIT}/ops-client.ts`);

const realFetch = globalThis.fetch;
const reply = (status, body, raw) =>
  new Response(raw ?? JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Installs a fake window and fetch; `answer` gives the Response (or throws). */
function browser(answer) {
  const seen = { calls: [], assigned: [], events: [] };
  globalThis.window = {
    location: { assign: (url) => seen.assigned.push(url) },
    dispatchEvent: (event) => {
      seen.events.push(event);
      return true;
    },
  };
  globalThis.fetch = async (url, init) => {
    seen.calls.push({ url, init });
    return answer();
  };
  return seen;
}
const done = () => {
  delete globalThis.window;
  globalThis.fetch = realFetch;
};
const NETWORK = { ok: false, status: 0, error: { code: "network", field: null, locale: null, detail: null } };

test("opsFetch: GET with the query (undefined dropped), same-origin cookie, no-store, no token", async (t) => {
  t.after(done);
  const seen = browser(() => reply(200, { ok: true, items: [{ id: "a" }] }));
  const result = await opsFetch("/api/ops/catalog", { kind: "service", id: undefined, q: "a b" });
  assert.deepEqual(result, { ok: true, items: [{ id: "a" }] });
  const [{ url, init }] = seen.calls;
  assert.equal(url, "/api/ops/catalog?kind=service&q=a+b");
  assert.equal(init.method ?? "GET", "GET");
  assert.equal(init.credentials, "same-origin");
  assert.equal(init.cache, "no-store");
  assert.equal(init.headers["content-type"], "application/json");
  assert.equal(init.body, undefined);
  assert.equal(Object.keys(init.headers).some((name) => name.toLowerCase() === "authorization"), false);
  await opsFetch("/api/ops/stays");
  assert.equal(seen.calls[1].url, "/api/ops/stays");
});

test("opsSend: POST of a JSON body, same-origin, no-store", async (t) => {
  t.after(done);
  const seen = browser(() => reply(200, { ok: true, id: "x", affects_site: false }));
  const result = await opsSend("/api/ops/destinations", { action: "delete", id: "x" });
  assert.deepEqual(result, { ok: true, id: "x", affects_site: false });
  const [{ url, init }] = seen.calls;
  assert.equal(url, "/api/ops/destinations");
  assert.equal(init.method, "POST");
  assert.equal(init.body, JSON.stringify({ action: "delete", id: "x" }));
  assert.equal(init.credentials, "same-origin");
  assert.equal(init.cache, "no-store");
  assert.equal(init.headers["content-type"], "application/json");
  assert.equal(Object.keys(init.headers).some((name) => name.toLowerCase() === "authorization"), false);
});

test("an error envelope comes back with its HTTP status and the contract's fields", async (t) => {
  t.after(done);
  const body = { ok: false, error: { code: "rate_overlap", field: null, locale: null, detail: { conflict_id: "c1" } } };
  browser(() => reply(409, body));
  assert.deepEqual(await opsSend("/api/ops/stay-rates", { action: "save_range" }), { ok: false, status: 409, error: body.error });
  browser(() => reply(400, { ok: false, error: { code: "invalid", field: "translations.ar.title", locale: "ar" } }));
  assert.deepEqual(await opsSend("/api/ops/stays", {}), {
    ok: false,
    status: 400,
    error: { code: "invalid", field: "translations.ar.title", locale: "ar", detail: null },
  });
});

test("a success body that carries `site` raises almar:site with it; an error body does not", async (t) => {
  t.after(done);
  const site = { state: "updating", requested_seq: 2, live_seq: 1, requested_at: null, built_at: null, last_hook_at: null, last_hook_result: null };
  const seen = browser(() => reply(200, { ok: true, id: "x", affects_site: true, site }));
  await opsSend("/api/ops/publish", {});
  assert.equal(seen.events.length, 1);
  assert.equal(seen.events[0].type, "almar:site");
  assert.deepEqual(seen.events[0].detail, site);
  const quiet = browser(() => reply(200, { ok: true, id: "x", affects_site: false }));
  await opsSend("/api/ops/publish", {});
  assert.equal(quiet.events.length, 0);
  const failed = browser(() => reply(409, { ok: false, site, error: { code: "published", field: null, locale: null, detail: null } }));
  await opsSend("/api/ops/destinations", {});
  assert.equal(failed.events.length, 0);
});

test("403 not_owner sends the browser to /sign-in and still resolves; another 403 does not", async (t) => {
  t.after(done);
  const denied = { ok: false, error: { code: "not_owner", field: null, locale: null, detail: null } };
  for (const call of [
    () => opsFetch("/api/ops/stays"),
    () => opsSend("/api/ops/stays", {}),
    () => opsPut("/api/ops/media", new Uint8Array([1]).buffer, { "content-type": "image/webp" }),
  ]) {
    const seen = browser(() => reply(403, denied));
    const result = await call();
    assert.deepEqual(result, { ok: false, status: 403, error: denied.error });
    assert.deepEqual(seen.assigned, ["/sign-in"]);
  }
  const other = browser(() => reply(403, { ok: false, error: { code: "wrong_origin", field: null, locale: null, detail: null } }));
  assert.equal((await opsSend("/api/ops/stays", {})).ok, false);
  assert.deepEqual(other.assigned, []);
});

test("a network failure is { ok: false, status: 0, code: network } for all three calls, never a rejection", async (t) => {
  t.after(done);
  browser(() => {
    throw new TypeError("fetch failed");
  });
  assert.deepEqual(await opsFetch("/api/ops/stays"), NETWORK);
  assert.deepEqual(await opsSend("/api/ops/stays", {}), NETWORK);
  assert.deepEqual(await opsPut("/api/ops/media", new Blob(["x"]), {}), NETWORK);
});

test("a reply that is not the envelope is `unavailable` with the HTTP status", async (t) => {
  t.after(done);
  const unavailable = (status) => ({ ok: false, status, error: { code: "unavailable", field: null, locale: null, detail: null } });
  browser(() => reply(502, null, "<html>Bad gateway</html>"));
  assert.deepEqual(await opsSend("/api/ops/stays", {}), unavailable(502));
  browser(() => reply(200, null, '"just a string"'));
  assert.deepEqual(await opsFetch("/api/ops/stays"), unavailable(200));
  browser(() => reply(500, { ok: false }));
  assert.deepEqual(await opsFetch("/api/ops/stays"), unavailable(500));
  browser(() => reply(200, [1, 2]));
  assert.deepEqual(await opsFetch("/api/ops/stays"), unavailable(200));
});

test("opsSend does not throw on a body that cannot be turned into JSON", async (t) => {
  t.after(done);
  const seen = browser(() => reply(200, { ok: true }));
  const loop = {};
  loop.self = loop;
  const result = await opsSend("/api/ops/stays", loop);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid");
  assert.equal(seen.calls.length, 0, "nothing was sent");
});

test("opsPut: the body unchanged, exactly the caller's headers, PUT, same-origin, no-store", async (t) => {
  t.after(done);
  const seen = browser(() => reply(200, { ok: true, id: "m", key: "uploads/x.webp", url: "https://example.test/x", created: true }));
  const body = new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });
  const headers = { "Content-Type": "image/webp", "x-almar-sha256": "a".repeat(64), "x-almar-width": "1600", "x-almar-height": "900", "x-almar-alt-en": "A%20view" };
  const result = await opsPut("/api/ops/media", body, headers);
  assert.equal(result.ok, true);
  const [{ url, init }] = seen.calls;
  assert.equal(url, "/api/ops/media");
  assert.equal(init.method, "PUT");
  assert.equal(init.body, body, "the same object, not re-encoded");
  assert.deepEqual({ ...init.headers }, headers, "exactly the caller's headers");
  assert.equal(init.credentials, "same-origin");
  assert.equal(init.cache, "no-store");
  const buffer = new Uint8Array([9]).buffer;
  await opsPut("/api/ops/media", buffer, { "content-type": "image/png" });
  assert.equal(seen.calls[1].init.body, buffer);
  assert.deepEqual({ ...seen.calls[1].init.headers }, { "content-type": "image/png" }, "no JSON content type is added");
});

test("a GET reply that carries `site` (the site-status read) raises no almar:site event (03.2-05 review)", async (t) => {
  t.after(done);
  const site = { state: "updating", requested_seq: 2, live_seq: 1, requested_at: null, built_at: null, last_hook_at: null, last_hook_result: null };
  const seen = browser(() => reply(200, { ok: true, site }));
  const res = await opsFetch("/api/ops/site-status");
  assert.equal(res.ok, true);
  assert.equal(seen.events.length, 0);
});

test("opsPut's site event: a success body with `site` reaches almar:site like opsSend", async (t) => {
  t.after(done);
  const seen = browser(() => reply(200, { ok: true, id: "m", site: { state: "up_to_date" } }));
  await opsPut("/api/ops/media", new Blob(["x"]), {});
  assert.equal(seen.events.length, 1);
  assert.equal(seen.events[0].type, "almar:site");
});

test("ops-client holds no token: the session cookie travels on its own", () => {
  const source = read("ops-client.ts");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.equal(/authorization|localStorage|sessionStorage|document\.cookie|process\.env/i.test(code), false);
  assert.match(source, /credentials:\s*"same-origin"/);
  assert.match(source, /cache:\s*"no-store"/);
});

// ---- source guards over components/ops ------------------------------------------------------------------------------

test("the kit has files and every one is read", () => {
  assert.ok(kitFiles().length >= 13, `components/ops has ${kitFiles().length} files`);
});

test("no file under components/ops except ops-client.ts calls fetch( (nor XMLHttpRequest, nor a beacon)", () => {
  for (const name of kitFiles()) {
    const source = read(name);
    const hasFetch = /\bfetch\s*\(/.test(source) || /XMLHttpRequest|sendBeacon/.test(source);
    assert.equal(hasFetch, name === "ops-client.ts", `${name}: network calls belong in ops-client.ts only`);
  }
});

test("a kit file that is a component or a hook starts with \"use client\"; pure .ts files import no React", () => {
  for (const name of kitFiles()) {
    const source = read(name);
    const firstStatement = source.replace(/^(?:\s*\/\/[^\n]*\n|\s*\/\*[\s\S]*?\*\/)*\s*/, "");
    const isClient = /^["']use client["']/.test(firstStatement);
    const importsReactAtRuntime = /^import\s+(?!type\b)[^;]*from\s+["'](?:react|react-dom|radix-ui|next\/[^"']+)["']/m.test(source);
    if (name.endsWith(".tsx") || importsReactAtRuntime) assert.equal(isClient, true, `${name} must start with "use client"`);
    else assert.equal(isClient, false, `${name} is a pure module and must not say "use client"`);
  }
});

test("no kit file imports the server side: supabase, lib/ops, auth, next/headers, server-only, process.env", () => {
  for (const name of kitFiles()) {
    const source = read(name);
    assert.equal(/lib\/supabase|lib\/ops\/|lib\/auth\/|next\/headers|server-only|process\.env/.test(source), false, name);
  }
});

test("the kit draws no hex colour, no physical side utility and no radio control", () => {
  for (const name of kitFiles()) {
    const source = read(name);
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(source), false, `${name}: hex`);
    assert.equal(/(?:^|[\s"'`])(?:-?(?:ml|mr|pl|pr)-|left-|right-|text-left\b|text-right\b|rounded-(?:sm|md|lg|xl|full))/.test(source), false, `${name}: physical utility or rounded corner`);
    assert.equal(/type=["']radio["']|role=["']radio/.test(source), false, `${name}: radio`);
  }
});

// ---- the exports every wave-4 plan codes against --------------------------------------------------------------------

test("the kit exports the names of the plan's interface block", () => {
  const functions = {
    "ops-client.ts": ["opsFetch", "opsSend", "opsPut"],
    "use-dashboard-locale.ts": ["useDashboardLocale"],
    "publish-check.ts": ["missingForPublish"],
    "error-text.ts": ["errorText"],
    "edit-page.tsx": ["EditPage"],
    "publish-bar.tsx": ["PublishBar"],
    "auto-translate.ts": ["planTranslation", "applyReplies", "requestTranslations", "pendingFields", "sendable", "emptiedLive", "blankLive"],
    "list-table.tsx": ["ListTable"],
    "connect-picker.tsx": ["ConnectPicker"],
    "status-chip.tsx": ["StatusChip"],
    "date-range-field.tsx": ["DateRangeField"],
  };
  for (const [file, names] of Object.entries(functions)) {
    for (const name of names) assert.match(read(file), new RegExp(`export (?:async )?function ${name}\\b`), `${file} exports ${name}`);
  }
  const types = {
    "ops-client.ts": ["OpsResponse", "OpsError"],
    "publish-check.ts": ["PublishEntity", "MissingItem"],
    "list-table.tsx": ["Column"],
    "edit-page.tsx": ["EditSection", "TranslatableField", "SavePayload", "SaveIntent"],
    "api-types.ts": ["Locale3", "TranslationState", "TextStatus", "MediaRef", "Translations", "OpsError", "PublishResult", "SiteStatus"],
  };
  for (const [file, names] of Object.entries(types)) {
    for (const name of names) assert.match(read(file), new RegExp(`export type (?:\\{[^}]*\\b${name}\\b[^}]*\\}|${name}\\b)`), `${file} exports type ${name}`);
  }
  assert.match(read("ops-client.ts"), /export type \{ OpsError \}|export type OpsError/, "ops-client re-exports OpsError");
});

test("api-types.ts is types only: no runtime statement, no import", () => {
  const source = read("api-types.ts").replace(/\/\/[^\n]*/g, "");
  assert.equal(/^\s*import\b/m.test(source), false);
  assert.equal(/^\s*export\s+(?:const|let|var|function|class|enum|default)\b/m.test(source), false);
});

// ---- api-types.ts follows the contract, field for field -------------------------------------------------------------

/** The text between the braces that open at `from` and the matching close. */
function braceBody(source, from) {
  let depth = 0;
  for (let at = from; at < source.length; at += 1) {
    if (source[at] === "{") depth += 1;
    else if (source[at] === "}" && --depth === 0) return source.slice(from + 1, at);
  }
  throw new Error("unbalanced braces");
}

/** Replaces every inner `{ ... }` with N, innermost first, so only the top level is left. */
function flatten(body) {
  let previous;
  let current = body;
  do {
    previous = current;
    current = current.replace(/\{[^{}]*\}/g, "N");
  } while (current !== previous);
  return current;
}

/** Field names of `Name = { ... }` in the contract: comma separated, a name then an optional `: type`. */
function contractFields(name) {
  const doc = readFileSync(CONTRACT, "utf8");
  const start = doc.indexOf(`${name} = {`);
  assert.ok(start >= 0, `${name} is defined in the contract`);
  const body = flatten(braceBody(doc, doc.indexOf("{", start)).replace(/\/\*[\s\S]*?\*\//g, ""));
  return body.split(",").map((part) => /^\s*(\w+)/.exec(part)?.[1]).filter(Boolean);
}

/** Field names of `export type Name = { ... }` in api-types.ts. */
function typeFields(name) {
  const source = read("api-types.ts");
  const start = source.indexOf(`export type ${name} = {`);
  assert.ok(start >= 0, `api-types.ts defines ${name}`);
  const body = flatten(braceBody(source, source.indexOf("{", start)).replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""));
  return body.split(";").map((part) => /^\s*(\w+)\??\s*:/.exec(part)?.[1]).filter(Boolean);
}

test("every summary and detail shape of contract 5.1 to 5.9 and 6 is in api-types.ts, field for field", () => {
  for (const name of [
    "DestinationSummary",
    "DestinationDetail",
    "StaySummary",
    "StayDetail",
    "StayText",
    "CatalogSummary",
    "CatalogDetail",
    "TeamSummary",
    "TeamDetail",
    "JourneySummary",
    "JourneyDetail",
    "SiteStatus",
  ]) {
    assert.deepEqual(typeFields(name), contractFields(name), name);
  }
  // Shapes the contract gives as a reply, not as a named type: transcribed from 5.3, 5.4, 5.5 and 1.2.
  assert.deepEqual(typeFields("RateRange"), ["id", "first_night", "last_night", "nights", "nightly_rate_aed"]);
  assert.deepEqual(typeFields("RatesView"), ["stay_id", "base_nightly_rate_aed", "ranges", "nights"]);
  assert.deepEqual(typeFields("Block"), ["id", "scope", "destination_id", "stay_id", "starts_on", "ends_on", "reason", "created_at"]);
  assert.deepEqual(typeFields("StayAccess"), ["address", "wifi_name", "wifi_password", "door_code", "notes", "updated_at"]);
  assert.deepEqual(typeFields("MediaRef"), ["id", "key", "url", "width", "height", "alt_en"]);
  assert.deepEqual(typeFields("OpsError"), ["code", "field", "locale", "detail"]);
  assert.deepEqual(typeFields("PublishResult"), ["id", "is_published", "affects_site", "warnings"]);
});

// ---- markup of the controls (server render: English, no browser) ----------------------------------------------------

/** The opening tag of the first button whose label is `label`. */
function buttonTag(html, label) {
  const found = new RegExp(`<button\\b([^>]*)>${label}</button>`).exec(html);
  assert.ok(found, `a button labelled "${label}"`);
  return found[1];
}
const isDisabled = (tag) => /\sdisabled=""/.test(tag);

const bar = await loadRenderer(`${KIT}/publish-bar.tsx`, "PublishBar");
const barProps = {
  isNew: false,
  isPublished: false,
  dirty: true,
  busy: false,
  missing: [],
  warnings: [],
  error: null,
  onSave() {},
  onPublish() {},
  onUnpublish() {},
};

test("PublishBar, new and incomplete: Save and a disabled Publish, with the missing lines under Publish needs:", () => {
  const html = bar({
    ...barProps,
    isNew: true,
    missing: [{ locale: "ar", field: "name" }, { locale: "es", field: "name" }, { locale: null, field: "hero_media_id" }],
  });
  assert.equal(isDisabled(buttonTag(html, "Save")), false);
  assert.equal(isDisabled(buttonTag(html, "Publish")), true);
  assert.match(html, /Publish needs:/);
  assert.equal((html.match(/<li>/g) ?? []).length, 3);
  assert.match(html, /<li>Arabic name<\/li><li>Spanish name<\/li><li>A photo<\/li>/);
  assert.equal(html.includes("Save and update site"), false);
  assert.equal(html.includes("Unpublish"), false);
  assert.equal(html.includes(">Delete<"), false, "Delete is the editor page's link, not a bar button");
});

test("PublishBar, complete and unpublished: Publish is live and nothing is listed", () => {
  const html = bar(barProps);
  assert.equal(isDisabled(buttonTag(html, "Publish")), false);
  assert.equal(html.includes("Publish needs:"), false);
});

test("PublishBar, published: Save and update site and Unpublish; a warning in words", () => {
  const html = bar({ ...barProps, isPublished: true, warnings: ["no_base_rate", "no_price"] });
  assert.equal(isDisabled(buttonTag(html, "Save and update site")), false);
  assert.equal(isDisabled(buttonTag(html, "Unpublish")), false);
  assert.match(html, /Published without a nightly rate: guests cannot book it yet\./);
  assert.match(html, /Published without a price: it is not offered as an add-on\./);
  assert.equal(/>Publish</.test(html), false, "no Publish on a published item");
  assert.equal(/>Save</.test(html), false, "Save is Save and update site");
});

test("PublishBar: Save is outlined and Publish is the teal one; no Unpublish without onUnpublish; no Publish without onPublish", () => {
  const html = bar(barProps);
  assert.match(buttonTag(html, "Save"), /border-teal[^"]*bg-transparent|bg-transparent[^"]*border-teal/);
  assert.match(buttonTag(html, "Publish"), /bg-teal/);
  assert.match(buttonTag(html, "Publish"), /text-ivory/);
  assert.equal(/bg-gold/.test(html), false, "gold is never a fill");
  const live = bar({ ...barProps, isPublished: true, onUnpublish: undefined });
  assert.equal(live.includes("Unpublish"), false);
  const plain = bar({ ...barProps, onPublish: undefined });
  assert.equal(/>Publish</.test(plain), false);
  assert.match(buttonTag(plain, "Save"), /bg-teal/, "Save is the one teal button");
});

test("PublishBar: Save waits for a change, except on a new item or with a translation to try again", () => {
  assert.equal(isDisabled(buttonTag(bar({ ...barProps, dirty: false }), "Save")), true);
  assert.equal(isDisabled(buttonTag(bar({ ...barProps, dirty: false, savePending: true }), "Save")), false);
  assert.equal(isDisabled(buttonTag(bar({ ...barProps, dirty: false, isNew: true }), "Save")), false);
});

test("PublishBar: a translation that did not finish holds Publish and names its alert", () => {
  const html = bar({ ...barProps, translationAlertId: "t-alert" });
  const tag = buttonTag(html, "Publish");
  assert.equal(isDisabled(tag), true);
  assert.match(tag, /aria-describedby="t-alert"/);
});

test("PublishBar parts: actions draw only buttons, notes draw only the lists and alerts", () => {
  const props = { ...barProps, missing: [{ locale: "ar", field: "name" }], idBase: "k" };
  const actions = bar({ ...props, part: "actions" });
  const notes = bar({ ...props, part: "notes" });
  assert.match(actions, /<button/);
  assert.equal(actions.includes("Publish needs:"), false);
  assert.match(notes, /id="k-gaps"/);
  assert.equal(notes.includes("<button"), false);
  assert.match(buttonTag(actions, "Publish"), /aria-describedby="k-gaps"/, "the button in one part names the list in the other");
});

test("PublishBar: when a save is needed and the screen holds Save, Publish waits too; nothing is added to Publish needs:", () => {
  for (const state of [{ isNew: true }, { dirty: true }, { dirty: false, savePending: true }]) {
    const html = bar({ ...barProps, ...state, saveBlocked: true });
    assert.equal(isDisabled(buttonTag(html, "Save")), true, JSON.stringify(state));
    assert.equal(isDisabled(buttonTag(html, "Publish")), true, JSON.stringify(state));
    assert.equal(html.includes("Publish needs:"), false, JSON.stringify(state));
  }
  // Nothing to save: Publish publishes what is stored, as before.
  assert.equal(isDisabled(buttonTag(bar({ ...barProps, dirty: false, saveBlocked: true }), "Publish")), false);
  // Save not held: Publish as before.
  assert.equal(isDisabled(buttonTag(bar({ ...barProps, isNew: true, saveBlocked: false }), "Publish")), false);
  // Published and clean: Save and update site waits for a change, Unpublish stays live, as before.
  const live = bar({ ...barProps, isPublished: true, dirty: false, saveBlocked: true });
  assert.equal(isDisabled(buttonTag(live, "Unpublish")), false);
  assert.equal(isDisabled(buttonTag(live, "Save and update site")), true);
});

test("PublishBar, busy: every button is disabled", () => {
  const html = bar({ ...barProps, busy: true });
  for (const label of ["Publish"]) assert.equal(isDisabled(buttonTag(html, label)), true, label);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-busy="true"/, "Save shows it is working");
});

test("PublishBar: a 409 publish_incomplete shows the server's list in the same words and blocks Publish", () => {
  const html = bar({
    ...barProps,
    error: { code: "publish_incomplete", field: null, locale: null, detail: { missing: [{ locale: "ar", field: "title" }, { locale: null, field: "hero_media_id" }] } },
  });
  assert.match(html, /Publish needs:/);
  assert.match(html, /<li>Arabic title<\/li><li>A photo<\/li>/);
  assert.equal(isDisabled(buttonTag(html, "Publish")), true);
  assert.equal(html.includes('role="alert"'), false, "the list is the message");
});

test("PublishBar: any other error is one fixed sentence in an alert", () => {
  const html = bar({ ...barProps, error: { code: "slug_taken", field: "slug", locale: null, detail: { secret: "hidden" } } });
  assert.match(html, /role="alert"[^>]*>Another item already uses this web address\.</);
  assert.equal(html.includes("hidden"), false);
});

test("PublishBar: a 409 publish_incomplete with no usable list still says the publish_incomplete sentence", () => {
  for (const detail of [null, undefined, {}, { missing: [] }, { missing: "x" }]) {
    const html = bar({ ...barProps, error: { code: "publish_incomplete", field: null, locale: null, detail } });
    assert.match(html, /role="alert"[^>]*>This item cannot be published yet: required items are missing\.</, JSON.stringify(detail));
    assert.equal(html.includes("Publish needs:"), false);
    assert.equal(isDisabled(buttonTag(html, "Publish")), true, "the server refused: Publish waits for an edit");
  }
  // With a list the list is the message: no second sentence.
  const listed = bar({ ...barProps, error: { code: "publish_incomplete", field: null, locale: null, detail: { missing: [{ locale: "ar", field: "title" }] } } });
  assert.equal(listed.includes("role=\"alert\""), false);
});

/** The id an element names in aria-describedby, and the markup of the element with that id. */
function describedBy(html, tag) {
  const id = /aria-describedby="([^"]+)"/.exec(tag)?.[1];
  assert.ok(id, "aria-describedby is set");
  const target = new RegExp(`<(\\w+)[^>]*\\sid="${id.replace(/[:]/g, "\\:")}"[^>]*>([\\s\\S]*?)</\\1>`).exec(html);
  assert.ok(target, `an element has id ${id}`);
  return target[2];
}

test("PublishBar: a disabled Publish names the reason it is disabled (aria-describedby)", () => {
  const withGaps = bar({
    ...barProps,
    missing: [{ locale: "ar", field: "name" }, { locale: null, field: "hero_media_id" }],
  });
  const reason = describedBy(withGaps, buttonTag(withGaps, "Publish"));
  assert.match(reason, /Publish needs:/);
  assert.match(reason, /<li>Arabic name<\/li><li>A photo<\/li>/);

  // The server's list is the reason after a 409.
  const fromServer = bar({
    ...barProps,
    error: { code: "publish_incomplete", field: null, locale: null, detail: { missing: [{ locale: "es", field: "title" }] } },
  });
  assert.match(describedBy(fromServer, buttonTag(fromServer, "Publish")), /<li>Spanish title<\/li>/);

  // No list from the server: the sentence is the reason.
  const sentence = bar({ ...barProps, error: { code: "publish_incomplete", field: null, locale: null, detail: {} } });
  assert.match(describedBy(sentence, buttonTag(sentence, "Publish")), /This item cannot be published yet/);

  // An enabled Publish has nothing to explain.
  assert.equal(/aria-describedby/.test(buttonTag(bar(barProps), "Publish")), false);
});

const table = await loadRenderer(`${KIT}/list-table.tsx`, "ListTable");
const rows = [
  { id: "a", name: "[Name 1]", note: "[Note 1]" },
  { id: "b", name: "[Name 2]", note: "[Note 2]" },
  { id: "c", name: "[Name 3]", note: "[Note 3]" },
];
const columns = [
  { key: "name", label: "Name", phone: "title", render: (row) => row.name },
  { key: "note", label: "Note", phone: "meta", render: (row) => row.note },
  { key: "wide", label: "Wide only", phone: "hidden", render: (row) => `wide-${row.id}` },
];

test("ListTable: a captioned table and a list of cards; hidden columns stay out of the cards", () => {
  const html = table({ caption: "Destinations", columns, rows, onOpen() {}, empty: null });
  const tableHtml = /<table[\s\S]*<\/table>/.exec(html)?.[0] ?? "";
  const cardsHtml = /<ul[\s\S]*<\/ul>/.exec(html)?.[0] ?? "";
  assert.match(tableHtml, /<caption class="sr-only">Destinations<\/caption>/);
  assert.equal((tableHtml.match(/<th\b/g) ?? []).length, 3);
  assert.equal(tableHtml.includes("wide-a"), true);
  assert.equal(cardsHtml.includes("wide-a"), false);
  assert.equal((cardsHtml.match(/<li\b/g) ?? []).length, 3);
  assert.match(cardsHtml, /\[Name 1\]/);
  assert.match(cardsHtml, /\[Note 1\]/);
  assert.match(cardsHtml, /aria-label="Destinations"/);
});

test("ListTable with reorder: Move up and Move down on every row, the ends disabled, a drag handle at md and up", () => {
  const html = table({ caption: "Destinations", columns, rows, onOpen() {}, empty: null, reorder: { onMove() {}, onDropOrder() {} } });
  const cardsHtml = /<ul[\s\S]*<\/ul>/.exec(html)?.[0] ?? "";
  const tableHtml = /<table[\s\S]*<\/table>/.exec(html)?.[0] ?? "";
  assert.equal((cardsHtml.match(/Move up/g) ?? []).length, 3);
  assert.equal((cardsHtml.match(/Move down/g) ?? []).length, 3);
  assert.equal((tableHtml.match(/aria-label="Move up"/g) ?? []).length, 3);
  assert.equal((tableHtml.match(/data-testid="drag-handle"/g) ?? []).length, 3);
  assert.equal((cardsHtml.match(/data-testid="drag-handle"/g) ?? []).length, 0, "no drag on a phone");
  const disabled = (cardsHtml.match(/<button[^>]*disabled=""/g) ?? []).length;
  assert.equal(disabled, 2, "the first Move up and the last Move down");
  assert.equal(html.includes("draggable"), true);
});

test("ListTable without reorder draws no reorder control; with no rows it draws `empty` and no table", () => {
  const plain = table({ caption: "Destinations", columns, rows, onOpen() {}, empty: null });
  assert.equal(/Move up|draggable/.test(plain), false);
  const none = table({ caption: "Destinations", columns, rows: [], onOpen() {}, empty: "NOTHING-HERE" });
  assert.equal(none, "NOTHING-HERE");
});

const picker = await loadRenderer(`${KIT}/connect-picker.tsx`, "ConnectPicker");
const options = ["s1", "s2", "s3", "s4"].map((id, at) => ({ id, label: `[Stay ${at + 1}]`, meta: "[Destination]" }));

test("ConnectPicker: the connected list in its own order with Remove; only the rest can be ticked", () => {
  const html = picker({
    title: "Stays",
    searchLabel: "Search stays",
    options,
    connected: ["s3", "s1"],
    onChange() {},
    groups: [{ label: "From the destination", ids: ["s4"] }],
  });
  const connected = /Connected<\/h4>[\s\S]*?<\/ul>/.exec(html)?.[0] ?? "";
  assert.ok(connected.indexOf("[Stay 3]") > 0 && connected.indexOf("[Stay 3]") < connected.indexOf("[Stay 1]"), "kept order");
  assert.equal((connected.match(/aria-label="Remove \[Stay \d\]"/g) ?? []).length, 2);
  const pickList = /<ul class="m-0 flex max-h-96[\s\S]*?<\/ul>/.exec(html)?.[0] ?? "";
  assert.equal((pickList.match(/type="checkbox"/g) ?? []).length, 2, "s2 and s4 are not connected yet");
  assert.equal(pickList.includes("[Stay 1]"), false);
  assert.match(html, /0 selected/);
  assert.equal(isDisabled(buttonTag(html, "Connect selected")), true, "nothing ticked");
  assert.match(html, /From the destination/);
});

test("ConnectPicker with nothing connected says so; with every option connected it says No results", () => {
  const empty = picker({ title: "Stays", searchLabel: "Search stays", options, connected: [], onChange() {} });
  assert.match(empty, /Nothing connected yet\./);
  const all = picker({ title: "Stays", searchLabel: "Search stays", options, connected: ["s1", "s2", "s3", "s4"], onChange() {} });
  assert.match(all, /No results/);
});

test("StatusChip says Published or Draft in the language it is given", async () => {
  const chip = await loadRenderer(`${KIT}/status-chip.tsx`, "StatusChip");
  assert.match(chip({ published: true, locale: "en" }), />Published</);
  assert.match(chip({ published: false, locale: "en" }), />Draft</);
  assert.match(chip({ published: true, locale: "ar" }), />منشور</);
  assert.match(chip({ published: false, locale: "es" }), />Borrador</);
});

// ---- automatic translation (kit panel B, owner 2026-10-14) ------------------------------------------------------------

const auto = await loadTs(`${KIT}/auto-translate.ts`);
const none = new Set();
const both = (ar, es = ar) => ({ ar, es });

test("plan: a changed English field is sent to both targets; an unchanged one with translations is not", () => {
  const plan = auto.planTranslation(
    { name: "Casa Azul", summary: "Old summary" },
    { name: "Casa Roja", summary: "Old summary" },
    both({ name: "قديم", summary: "ملخص" }, { name: "Vieja", summary: "Resumen" }),
    none,
  );
  assert.deepEqual(plan.send, { ar: { name: "Casa Azul" }, es: { name: "Casa Azul" } });
  assert.deepEqual(plan.clear, { ar: [], es: [] });
  assert.equal(auto.plansAnything(plan), true);
});

test("plan: an empty translation is filled even when the English did not change (new item, earlier failure)", () => {
  const plan = auto.planTranslation({ alt: "Pool at dusk" }, { alt: "Pool at dusk" }, both({ alt: null }, { alt: "Piscina" }), none);
  assert.deepEqual(plan.send, { ar: { alt: "Pool at dusk" }, es: {} });
  const pending = auto.pendingFields(plan);
  assert.equal(pending.ar.has("alt"), true);
  assert.equal(pending.es.has("alt"), false);
});

test("plan: a translation Maria typed herself is left alone; an English emptied empties its translations", () => {
  const touched = new Set([auto.touchKey("ar", "name")]);
  const plan = auto.planTranslation({ name: "New", note: "" }, { name: "Old", note: "Was" }, both({ name: "يدوي", note: "كان" }, { name: "Viejo", note: "Era" }), touched);
  assert.deepEqual(plan.send, { ar: {}, es: { name: "New" } });
  assert.deepEqual(plan.clear, { ar: ["note"], es: ["note"] });
});

test("live: a published translation typed empty, or emptied with its English, is named; a blank the AI fills is not", () => {
  const live = { ar: ["name", "note"], es: ["name"] };
  // Arabic name typed empty by hand (touched: the AI is not asked); Spanish name blank but the AI fills it.
  const touched = new Set([auto.touchKey("ar", "name")]);
  const translations = both({ name: "", note: "كان" }, { name: "" });
  const plan = auto.planTranslation({ name: "Same", note: "" }, { name: "Same", note: "Was" }, translations, touched);
  assert.deepEqual(auto.emptiedLive(live, translations, plan), [
    { locale: "ar", field: "name" },
    { locale: "ar", field: "note" },
  ]);
  assert.deepEqual(auto.blankLive(live, translations), [
    { locale: "ar", field: "name" },
    { locale: "es", field: "name" },
  ]);
  assert.deepEqual(auto.emptiedLive({}, translations, plan), []);
});

test("plan: nothing changed and every translation present asks nothing", () => {
  const plan = auto.planTranslation({ alt: "A" }, { alt: "A" }, both({ alt: "ب" }, { alt: "B" }), none);
  assert.equal(auto.plansAnything(plan), false);
});

test("plan: a list is sent only whole (every item has text), like the route", () => {
  assert.equal(auto.sendable(["a", "b"]), true);
  assert.equal(auto.sendable(["a", " "]), false);
  assert.equal(auto.sendable([]), false);
  assert.equal(auto.sendable("  "), false);
  const plan = auto.planTranslation({ amenities: ["Pool", ""] }, { amenities: [] }, both({ amenities: null }), none);
  assert.deepEqual(plan.send, { ar: {}, es: {} });
});

const okReply = (target, fields, left) => ({ ok: true, target, fields, ...(left ? { left } : {}) });
const errReply = (status, code) => ({ ok: false, status, error: { code, field: null, locale: null, detail: null } });

test("apply: both answers fill their fields and the save is complete", () => {
  const plan = auto.planTranslation({ alt: "Pool" }, { alt: "" }, both({ alt: null }), none);
  const out = auto.applyReplies(plan, both({ alt: null }), { ar: okReply("ar", { alt: "مسبح" }), es: okReply("es", { alt: "Piscina" }) });
  assert.deepEqual(out.translations, { ar: { alt: "مسبح" }, es: { alt: "Piscina" } });
  assert.equal(out.complete, true);
  assert.equal(out.asked, true);
  assert.equal(out.reason, null);
});

test("apply: a failed target empties the fields it was asked for (old text of old English never stays)", () => {
  const plan = auto.planTranslation({ alt: "New" }, { alt: "Old" }, both({ alt: "قديم" }, { alt: "Viejo" }), none);
  const out = auto.applyReplies(plan, both({ alt: "قديم" }, { alt: "Viejo" }), { ar: okReply("ar", { alt: "جديد" }), es: errReply(502, "translate_failed") });
  assert.deepEqual(out.translations, { ar: { alt: "جديد" }, es: { alt: null } });
  assert.equal(out.complete, false);
  assert.equal(out.reason, "failed");
});

test("apply: the reason is the daily limit before busy before failed; a field left by the AI is a failure", () => {
  const plan = auto.planTranslation({ a: "x", b: "y" }, {}, both({}), none);
  const limit = auto.applyReplies(plan, both({}), { ar: errReply(503, "translate_busy"), es: errReply(429, "translate_limit") });
  assert.equal(limit.reason, "limit");
  const busy = auto.applyReplies(plan, both({}), { ar: errReply(503, "translate_busy"), es: okReply("es", { a: "x2", b: "y2" }) });
  assert.equal(busy.reason, "busy");
  const left = auto.applyReplies(plan, both({}), { ar: okReply("ar", { a: "س" }, ["b"]), es: okReply("es", { a: "x2", b: "y2" }) });
  assert.deepEqual(left.translations.ar, { a: "س", b: null });
  assert.equal(left.complete, false);
  assert.equal(left.reason, "failed");
  const lost = auto.applyReplies(plan, both({}), { ar: null, es: okReply("es", { a: "x2", b: "y2" }) });
  assert.equal(lost.reason, "failed", "a request that threw or timed out");
});

test("request: one POST per target that has fields, through send, with the 45 s timeout; a throw is a null answer", async () => {
  const calls = [];
  const send = async (path, body, options) => {
    calls.push({ path, body, options });
    if (body.target === "es") throw new Error("boom");
    return okReply("ar", { alt: "مسبح" });
  };
  const plan = auto.planTranslation({ alt: "Pool" }, { alt: "Pool" }, both({ alt: null }, { alt: null }), none);
  const replies = await auto.requestTranslations(plan, send);
  assert.deepEqual(calls.map((c) => [c.path, c.body.target, c.options.timeoutMs]), [
    ["/api/ops/translate", "ar", 45_000],
    ["/api/ops/translate", "es", 45_000],
  ]);
  assert.deepEqual(calls[0].body.fields, { alt: "Pool" });
  assert.equal(replies.ar.ok, true);
  assert.equal(replies.es, null);
  const onlyAr = auto.planTranslation({ alt: "Pool" }, { alt: "Pool" }, both({ alt: null }, { alt: "Piscina" }), none);
  calls.length = 0;
  await auto.requestTranslations(onlyAr, send);
  assert.deepEqual(calls.map((c) => c.body.target), ["ar"]);
});

test("auto-translate.ts sends only through the given send (ops-client in the page): no fetch, no React", () => {
  const source = read("auto-translate.ts");
  assert.equal(/\bfetch\s*\(|from ["']react["']/.test(source), false);
  assert.match(read("edit-page.tsx"), /send = opsSend/);
});

// ---- the editor page (server render: English, no browser) ----------------------------------------------------------

const page = await loadRenderer(`${KIT}/edit-page.tsx`, "EditPage");
const pageProps = {
  openKey: "r1",
  list: "LIST-MARKER",
  backLabel: "Destinations",
  onClose() {},
  title: "[Name]",
  isPublished: false,
  dirty: false,
  missing: [],
  error: null,
  english: { name: "[Name]" },
  savedEnglish: { name: "[Name]" },
  translations: { ar: { name: "[AR]" }, es: { name: "[ES]" } },
  translationFields: [{ name: "name", label: "Name" }],
  onTranslationChange() {},
  onSave: async () => true,
  onPublish() {},
  onDelete() {},
  sections: [
    { key: "text", title: "Text", translatable: true, content: "TEXT-BODY" },
    { key: "settings", title: "Settings", column: "side", content: "SIDE-BODY" },
  ],
};

test("EditPage open: the list stays in the page, hidden; a back link, the title, the status, Save and Publish", () => {
  const html = page(pageProps);
  assert.match(html, /<div hidden="">LIST-MARKER<\/div>/);
  assert.match(html, /<button type="button"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Destinations<\/button>/);
  assert.match(html, /<h1[^>]*tabindex="-1"[^>]*>\[Name\]<\/h1>/);
  assert.match(html, />Draft</);
  assert.match(html, />Save</);
  assert.match(html, />Publish</);
  assert.equal(/role="tablist"|role="tab"/.test(html), false, "no tabs");
});

test("EditPage: cards in two columns from lg (main spans two of three), the side card after the main one, one column below", () => {
  const html = page(pageProps);
  assert.match(html, /<fieldset class="m-0 grid min-w-0 items-start gap-6 border-0 p-0 lg:grid-cols-3">/);
  assert.match(html, /lg:col-span-2/);
  assert.ok(html.indexOf("TEXT-BODY") < html.indexOf("SIDE-BODY"));
  const single = page({ ...pageProps, sections: [pageProps.sections[0]] });
  assert.equal(single.includes("lg:grid-cols-3"), false);
});

test("EditPage: the English card says Write in English and carries the Edit translations link, closed", () => {
  const html = page(pageProps);
  assert.match(html, /Write in English\. Arabic and Spanish are added when you save\./);
  assert.match(html, /aria-expanded="false"[^>]*>[\s\S]*?Edit translations<\/button>/);
  assert.equal(html.includes("[AR]"), false, "the boxes open only on the link");
});

test("EditPage: Delete is a link-style button after the side cards; off on a published item with Unpublish first", () => {
  const html = page(pageProps);
  assert.match(html, /text-error underline[^"]*"[^>]*>Delete<\/button>|>Delete<\/button>/);
  assert.ok(html.indexOf("SIDE-BODY") < html.indexOf(">Delete<"));
  const live = page({ ...pageProps, isPublished: true });
  assert.match(live, /<button type="button" disabled=""[^>]*>Delete<\/button>/);
  assert.match(live, />Unpublish first</);
  assert.match(live, />Save and update site</);
  assert.equal(page({ ...pageProps, isNew: true }).includes(">Delete<"), false, "a new item has nothing to delete");
});

test("EditPage: an Arabic or Spanish gap the next Save fills does not hold Publish; any other gap does", () => {
  const pendingAr = page({ ...pageProps, translations: { ar: { name: null }, es: { name: "[ES]" } }, missing: [{ locale: "ar", field: "name" }] });
  assert.equal(pendingAr.includes("Publish needs:"), false);
  assert.equal(isDisabled(buttonTag(pendingAr, "Publish")), false);
  assert.equal(isDisabled(buttonTag(pendingAr, "Save")), false, "Save has a translation to fetch");
  const photo = page({ ...pageProps, missing: [{ locale: null, field: "hero_media_id" }] });
  assert.match(photo, /Publish needs:/);
  assert.equal(isDisabled(buttonTag(photo, "Publish")), true);
});

test("EditPage: a new or edited item whose Save the screen holds (canSave false) has Publish off, and publish() refuses", () => {
  for (const state of [{ isNew: true }, { dirty: true }]) {
    const held = page({ ...pageProps, ...state, canSave: false });
    assert.equal(isDisabled(buttonTag(held, "Save")), true, JSON.stringify(state));
    assert.equal(isDisabled(buttonTag(held, "Publish")), true, JSON.stringify(state));
    assert.equal(held.includes("Publish needs:"), false, JSON.stringify(state));
    assert.equal(isDisabled(buttonTag(page({ ...pageProps, ...state }), "Publish")), false, `${JSON.stringify(state)} with canSave`);
  }
  // Clean and complete: Publish publishes what is stored, as before.
  assert.equal(isDisabled(buttonTag(page({ ...pageProps, canSave: false }), "Publish")), false);
  // A Publish click that would save first returns before the save when the screen holds Save.
  const source = read("edit-page.tsx");
  const publishFn = /async function publish\(\) \{[\s\S]*?\n  \}\n/.exec(source)?.[0] ?? "";
  assert.match(publishFn, /if \(isNew \|\| dirty \|\| savePending\) \{\s*(?:\/\/[^\n]*\s*)*if \(!canSave\) return;\s*await save\("publish"\);/);
});

test("EditPage closed: only the list", () => {
  const html = page({ ...pageProps, openKey: null });
  assert.match(html, /^<div>LIST-MARKER<\/div>/);
  assert.equal(html.includes("<h1"), false);
});

test("apply: a translation longer than the field's maxLength is not kept (the server would refuse the save)", () => {
  const plan = auto.planTranslation({ alt: "Pool" }, { alt: "" }, both({ alt: null }), none);
  const long = "x".repeat(301);
  const out = auto.applyReplies(plan, both({ alt: null }), { ar: okReply("ar", { alt: "مسبح" }), es: okReply("es", { alt: long }) }, { alt: 300 });
  assert.deepEqual(out.translations, { ar: { alt: "مسبح" }, es: { alt: null } });
  assert.equal(out.complete, false);
  assert.equal(out.reason, "failed");
  const fine = auto.applyReplies(plan, both({ alt: null }), { ar: okReply("ar", { alt: "مسبح" }), es: okReply("es", { alt: "x".repeat(300) }) }, { alt: 300 });
  assert.equal(fine.complete, true);
});

test("EditPage: every field rests in a disabled fieldset while a Save runs; canSave false holds Save", () => {
  assert.match(read("edit-page.tsx"), /<fieldset disabled=\{working\}/);
  const blocked = page({ ...pageProps, dirty: true, canSave: false });
  assert.equal(isDisabled(buttonTag(blocked, "Save")), true);
  assert.equal(isDisabled(buttonTag(page({ ...pageProps, dirty: true }), "Save")), false);
});

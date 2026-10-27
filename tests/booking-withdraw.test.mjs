// Plan 04-05 Tasks 5 and 6, the non-visual parts: the withdraw client (app/bookings/trip/booking-withdraw.ts), the
// booking page's metadata (app/bookings/trip/booking-page-meta.ts) and the /bookings/trip path rules. The plan puts
// these cases in tests/booking-page.test.mjs; they live here so the model cases another session writes there never
// collide with them. No network: postWithdraw runs on a fake fetch.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";
import { PUBLIC_PAGES } from "../lib/locale-path.ts";

const { WITHDRAW_PATH, withdrawAnswer, postWithdraw } = await loadTs("app/bookings/trip/booking-withdraw.ts");
const { bookingPageMetadata, BOOKING_PAGE_PATH } = await loadTs("app/bookings/trip/booking-page-meta.ts");
const { isHeldPath } = await loadTs("lib/server-routes.ts");

const REF = "ALMAR-TEST22";
const TOKEN = "fake.token-value";

/** Comment lines and trailing comments dropped, as the plan's `nc` does. */
function nc(path) {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .map((line) => line.replace(/\s\/\/.*$/, ""))
    .join("\n");
}

// ================================================================ withdrawAnswer (pure)

test("withdrawAnswer: 200 ok cancelled is done, first time or not (a retry after a lost answer is done too)", () => {
  assert.deepEqual(withdrawAnswer(200, { ok: true, ref: REF, status: "cancelled", firstTime: true }), { kind: "done" });
  assert.deepEqual(withdrawAnswer(200, { ok: true, ref: REF, status: "cancelled", firstTime: false }), { kind: "done" });
});

test("withdrawAnswer: a 200 whose body is not ok cancelled, or unreadable, is failed", () => {
  for (const body of [null, undefined, "ok", 42, {}, { ok: false }, { ok: true }, { ok: true, status: "expired" }, { ok: "true", status: "cancelled" }]) {
    assert.deepEqual(withdrawAnswer(200, body), { kind: "failed" }, JSON.stringify(body));
  }
});

test("withdrawAnswer: 409 part_paid is refused part_paid; any other 409 is refused not_withdrawable", () => {
  assert.deepEqual(withdrawAnswer(409, { ok: false, reason: "part_paid" }), { kind: "refused", reason: "part_paid" });
  assert.deepEqual(withdrawAnswer(409, { ok: false, reason: "not_withdrawable" }), { kind: "refused", reason: "not_withdrawable" });
  for (const body of [{ ok: false }, { ok: false, reason: "other" }, null, "x", { reason: "PART_PAID" }]) {
    assert.deepEqual(withdrawAnswer(409, body), { kind: "refused", reason: "not_withdrawable" }, JSON.stringify(body));
  }
});

test("withdrawAnswer: 404 is gone; every other status is failed", () => {
  assert.deepEqual(withdrawAnswer(404, { ok: false }), { kind: "gone" });
  assert.deepEqual(withdrawAnswer(404, null), { kind: "gone" });
  for (const status of [0, 201, 204, 301, 400, 401, 403, 413, 429, 500, 502, 503, NaN, undefined]) {
    assert.deepEqual(withdrawAnswer(status, { ok: true, status: "cancelled" }), { kind: "failed" }, String(status));
  }
});

// ================================================================ postWithdraw (fake fetch)

function fakeFetch(answer) {
  const calls = [];
  const fetchImpl = async (input, init) => {
    calls.push({ input, init });
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { calls, fetchImpl };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("postWithdraw: one same-origin JSON POST to /api/booking/withdraw, no-store, body exactly { ref, t }", async () => {
  assert.equal(WITHDRAW_PATH, "/api/booking/withdraw");
  const { calls, fetchImpl } = fakeFetch(jsonResponse(200, { ok: true, ref: REF, status: "cancelled", firstTime: true }));
  assert.deepEqual(await postWithdraw({ ref: REF, t: TOKEN }, fetchImpl), { kind: "done" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "/api/booking/withdraw");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, { "content-type": "application/json" });
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.deepEqual(JSON.parse(calls[0].init.body), { ref: REF, t: TOKEN });
  assert.deepEqual(Object.keys(JSON.parse(calls[0].init.body)), ["ref", "t"]);
});

test("postWithdraw: without t (or with an empty one) the body is exactly { ref }", async () => {
  for (const request of [{ ref: REF }, { ref: REF, t: undefined }, { ref: REF, t: "" }]) {
    const { calls, fetchImpl } = fakeFetch(jsonResponse(404, { ok: false }));
    assert.deepEqual(await postWithdraw(request, fetchImpl), { kind: "gone" });
    assert.equal(calls[0].init.body, JSON.stringify({ ref: REF }));
  }
});

test("postWithdraw: the answers map through withdrawAnswer", async () => {
  const cases = [
    [jsonResponse(409, { ok: false, reason: "part_paid" }), { kind: "refused", reason: "part_paid" }],
    [jsonResponse(409, { ok: false, reason: "not_withdrawable" }), { kind: "refused", reason: "not_withdrawable" }],
    [jsonResponse(404, { ok: false }), { kind: "gone" }],
    [jsonResponse(503, { ok: false }), { kind: "failed" }],
    [jsonResponse(403, { ok: false }), { kind: "failed" }],
    [jsonResponse(200, { ok: false }), { kind: "failed" }],
  ];
  for (const [response, expected] of cases) {
    assert.deepEqual(await postWithdraw({ ref: REF, t: TOKEN }, fakeFetch(response).fetchImpl), expected);
  }
});

test("postWithdraw: a rejected fetch, a non-JSON answer or an odd response resolve failed and never throw", async () => {
  assert.deepEqual(await postWithdraw({ ref: REF, t: TOKEN }, fakeFetch(new TypeError("Failed to fetch")).fetchImpl), { kind: "failed" });
  assert.deepEqual(await postWithdraw({ ref: REF, t: TOKEN }, fakeFetch(new Response("<html>oops</html>", { status: 200 })).fetchImpl), { kind: "failed" });
  assert.deepEqual(await postWithdraw({ ref: REF, t: TOKEN }, fakeFetch(new Response("", { status: 502 })).fetchImpl), { kind: "failed" });
  assert.deepEqual(await postWithdraw({ ref: REF, t: TOKEN }, fakeFetch({}).fetchImpl), { kind: "failed" });
  assert.deepEqual(await postWithdraw({ ref: REF, t: TOKEN }, fakeFetch(null).fetchImpl), { kind: "failed" });
  // A 404 with an unreadable body is still gone (the status decides).
  assert.deepEqual(await postWithdraw({ ref: REF, t: TOKEN }, fakeFetch(new Response("x", { status: 404 })).fetchImpl), { kind: "gone" });
});

test("postWithdraw: nothing is logged", async () => {
  const names = ["log", "info", "warn", "error", "debug"];
  const saved = names.map((n) => console[n]);
  const calls = [];
  for (const n of names) console[n] = (...args) => calls.push(n);
  try {
    await postWithdraw({ ref: REF, t: TOKEN }, fakeFetch(new TypeError("x")).fetchImpl);
    await postWithdraw({ ref: REF, t: TOKEN }, fakeFetch(new Response("x", { status: 500 })).fetchImpl);
  } finally {
    names.forEach((n, i) => (console[n] = saved[i]));
  }
  assert.deepEqual(calls, []);
});

// ================================================================ source rules

test("booking-withdraw.ts: the withdraw path once, no storage, cookie or console; it imports 04-08's types only", () => {
  const source = nc("app/bookings/trip/booking-withdraw.ts");
  assert.equal((source.match(/"\/api\/booking\/withdraw"/g) ?? []).length, 1);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|console\./);
  const imports = [...source.matchAll(/^import .*$/gm)].map((m) => m[0]);
  assert.deepEqual(imports, ['import type { WithdrawReason, WithdrawRequest } from "../../../lib/booking/types";']);
  assert.doesNotMatch(source, /request-client/, "never 04-06's lib/booking/request-client.ts");
});

test("app/bookings/trip: every /api/ string literal is /api/booking/view or /api/booking/withdraw; fetch( only in the screen and the withdraw client", () => {
  const dir = "app/bookings/trip";
  for (const name of readdirSync(dir)) {
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const source = nc(join(dir, name));
    for (const m of source.matchAll(/["'`](\/api\/[^"'`]*)["'`]/g)) {
      assert.ok(["/api/booking/view", "/api/booking/withdraw"].includes(m[1]), `${name}: ${m[1]}`);
    }
    if (/\bfetch\(/.test(source)) {
      assert.ok(["booking-trip-screen.tsx", "booking-withdraw.ts"].includes(name), `${name} calls fetch`);
    }
  }
});

test("app/bookings/trip: no card-provider words, no card form, no `re_` or `eyJ` (PAY-07, F-09)", () => {
  const dir = "app/bookings/trip";
  // The provider's name is built from parts so this file never spells it (Phase 4 has no card provider).
  const provider = new RegExp(["str", "ipe"].join("") + "|checkout\\.session|card number|cardNumber", "i");
  for (const name of readdirSync(dir)) {
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const source = readFileSync(join(dir, name), "utf8");
    assert.doesNotMatch(source, provider, name);
    assert.doesNotMatch(source, /re_|eyJ/, name);
  }
});

// ================================================================ booking-page-meta.ts (Task 5)

test("bookingPageMetadata: noindex nofollow, referrer same-origin, self canonical and four alternates with no query", () => {
  const o = "https://almarprivatejourney.com";
  assert.equal(BOOKING_PAGE_PATH, "/bookings/trip");
  for (const locale of ["en", "ar", "es"]) {
    const meta = bookingPageMetadata(locale);
    assert.deepEqual(meta.robots, { index: false, follow: false }, locale);
    assert.equal(meta.referrer, "same-origin", locale);
    assert.equal(meta.alternates.canonical, `${o}/${locale}/bookings/trip`, locale);
    assert.deepEqual(meta.alternates.languages, {
      en: `${o}/en/bookings/trip`,
      ar: `${o}/ar/bookings/trip`,
      es: `${o}/es/bookings/trip`,
      "x-default": `${o}/en/bookings/trip`,
    });
    assert.doesNotMatch(JSON.stringify(meta), /\?|t=|ref=/, "no query, never the token");
  }
});

test("booking-page-meta.ts: source rules (same-origin, index false, localeAlternates; no-referrer only in comments; no use client)", () => {
  const source = nc("app/bookings/trip/booking-page-meta.ts");
  assert.equal((source.match(/referrer: "same-origin"/g) ?? []).length, 1);
  assert.match(source, /index: false/);
  assert.match(source, /localeAlternates\(/);
  assert.doesNotMatch(source, /no-referrer/);
  assert.doesNotMatch(readFileSync("app/bookings/trip/booking-page-meta.ts", "utf8"), /^"use client"/m);
});

test("booking page files, when present: force-static, their own bookingPageMetadata locale, no no-referrer outside comments", () => {
  const pages = { en: "app/en/bookings/trip/page.tsx", ar: "app/ar/bookings/trip/page.tsx", es: "app/es/bookings/trip/page.tsx" };
  const present = Object.values(pages).filter((f) => existsSync(f));
  assert.ok(present.length === 0 || present.length === 3, `the three locales land together: ${present.join(", ")}`);
  for (const [locale, file] of Object.entries(pages)) {
    if (!existsSync(file)) continue;
    const source = nc(file);
    assert.match(source, /force-static/, file);
    assert.equal((source.match(new RegExp(`bookingPageMetadata\\("${locale}"\\)`, "g")) ?? []).length, 1, file);
    assert.doesNotMatch(source, /no-referrer/, file);
  }
});

// ================================================================ the /bookings/trip path (Task 5)

test("/bookings/trip is in PUBLIC_PAGES right after /booking/trip", () => {
  const pages = [...PUBLIC_PAGES];
  assert.ok(pages.includes("/bookings/trip"));
  assert.equal(pages.indexOf("/bookings/trip"), pages.indexOf("/booking/trip") + 1);
});

test("/bookings/trip is not held; no run_worker_first entry of either Worker matches it in any locale", () => {
  const paths = ["/bookings/trip", "/en/bookings/trip", "/ar/bookings/trip", "/es/bookings/trip"];
  for (const p of paths) assert.equal(isHeldPath(p), false, p);
  for (const file of ["wrangler.toml", "wrangler.preview.toml"]) {
    const line = readFileSync(file, "utf8").match(/^run_worker_first\s*=\s*(\[.*\])\s*$/m);
    assert.ok(line, `${file}: run_worker_first`);
    const entries = JSON.parse(line[1]);
    for (const p of paths) {
      for (const entry of entries) {
        const matches = entry.endsWith("/*") ? p === entry.slice(0, -2) || p.startsWith(entry.slice(0, -1)) : p === entry;
        assert.equal(matches, false, `${file}: ${entry} matches ${p}`);
      }
    }
  }
});

test("the sitemap never lists /bookings/trip (scripts/crawl-files.mjs NOT_PUBLIC has bookings)", () => {
  const source = readFileSync("scripts/crawl-files.mjs", "utf8");
  const set = source.match(/const NOT_PUBLIC = new Set\((\[[^\]]*\])\)/);
  assert.ok(set, "NOT_PUBLIC found");
  assert.ok(JSON.parse(set[1]).includes("bookings"));
});

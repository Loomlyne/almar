// Plan 03.2-05 Task 3: the site status line. The markup is rendered the way `next build` prerenders it (EN, AR, ES,
// every state); the behaviour (when it reads, Try again, focus, unmount) is driven through site-status-model.ts with a
// fake clock and fake replies. The real component in the real shell is in tests/ops-site-status.spec.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadRenderer } from "./helpers/render-component.mjs";
import { loadTs } from "./helpers/load-ts.mjs";

const render = await loadRenderer("components/ops/site-status-line.tsx", "SiteStatusLine");
const { OPS_SITE_STATUS_COPY } = await loadTs("lib/copy/ops-site-status.ts");
const model = await loadTs("components/ops/site-status-model.ts");
const { createSiteStatusController, lineView, POLL_MS } = model;

// 10:05Z = 14:05 in Dubai, 10:02Z = 14:02; failed by hook at 10:30Z = 14:30.
const SITES = {
  up_to_date: { state: "up_to_date", requested_seq: 5, live_seq: 5, requested_at: "2026-10-13T10:02:00.000Z", built_at: "2026-10-13T10:05:00.000Z", last_hook_at: "2026-10-13T10:02:00.000Z", last_hook_result: "ok" },
  updating: { state: "updating", requested_seq: 6, live_seq: 5, requested_at: "2026-10-13T10:02:00.000Z", built_at: "2026-10-13T09:00:00.000Z", last_hook_at: "2026-10-13T10:02:00.000Z", last_hook_result: "ok" },
  failed: { state: "failed", requested_seq: 6, live_seq: 5, requested_at: "2026-10-13T10:29:00.000Z", built_at: null, last_hook_at: "2026-10-13T10:30:00.000Z", last_hook_result: "error:503" },
};

const text = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

for (const locale of ["en", "ar", "es"]) {
  const copy = OPS_SITE_STATUS_COPY[locale];

  test(`${locale}: up to date reads "${copy.upToDate} · 14:05", a check mark, no Try again`, () => {
    const html = render({ copy, initial: SITES.up_to_date });
    assert.equal(text(html), `${copy.upToDate}·14:05`);
    assert.equal(html.includes(copy.tryAgain), false);
    assert.match(html, /role="status"/);
    assert.match(html, /data-site-state="up_to_date"/);
  });

  test(`${locale}: updating reads "${copy.updatingSince} 14:02", no Try again`, () => {
    const html = render({ copy, initial: SITES.updating });
    assert.equal(text(html), `${copy.updatingSince} 14:02`);
    assert.equal(html.includes(copy.tryAgain), false);
  });

  test(`${locale}: failed reads "${copy.failed} · 14:30 · ${copy.tryAgain}" with a real button`, () => {
    const html = render({ copy, initial: SITES.failed });
    assert.equal(text(html), `${copy.failed}·14:30·${copy.tryAgain}`);
    assert.match(html, /<button type="button"[^>]*>[^<]*<\/button>/);
    assert.match(html, new RegExp(`>${copy.tryAgain}</button>`));
  });

  test(`${locale}: before the first read nothing is shown (no guessed state)`, () => {
    const html = render({ copy });
    assert.match(html, /class="[^"]*\bhidden\b/);
    assert.equal(text(html), "");
  });
}

test("AR: no dir of its own (the document's rtl is inherited); only the time is ltr", () => {
  const html = render({ copy: OPS_SITE_STATUS_COPY.ar, initial: SITES.failed });
  assert.equal(/dir="rtl"/.test(html), false);
  for (const m of html.matchAll(/dir="([a-z]+)"/g)) assert.equal(m[1], "ltr");
  assert.match(html, /<time[^>]*dateTime="2026-10-13T10:30:00.000Z"|<time[^>]*datetime="2026-10-13T10:30:00.000Z"/i);
});

test("the signed wording, word for word", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(OPS_SITE_STATUS_COPY).map(([l, c]) => [l, [c.upToDate, c.updatingSince, c.failed, c.tryAgain, c.unavailable, c.publishedSaveHint]])),
    {
      en: ["Up to date", "Updating since", "Update failed", "Try again", "Status unavailable", "Saving updates the public site in a few minutes"],
      ar: ["الموقع محدَّث", "جارٍ التحديث منذ", "تعذّر التحديث", "حاول مرة أخرى", "الحالة غير متاحة", "الحفظ يحدّث الموقع العام خلال دقائق قليلة"],
      es: ["Sitio al día", "Actualizando desde las", "Falló la actualización", "Intentar de nuevo", "Estado no disponible", "Al guardar, el sitio público se actualiza en unos minutos"],
    },
  );
});

test("lineView: unavailable is muted with no time and no Try again; updating with no time says 'Updating'", () => {
  const copy = OPS_SITE_STATUS_COPY.en;
  assert.deepEqual(lineView({ kind: "unavailable" }, copy), { tone: "muted", text: "Status unavailable", time: null, at: null, showTryAgain: false });
  assert.equal(lineView({ kind: "loading" }, copy), null);
  assert.equal(lineView({ kind: "site", site: { ...SITES.updating, requested_at: null } }, copy).text, "Updating");
});

// ---- behaviour, through the model ---------------------------------------------------------------------------------

function harness({ load, retry, initial } = {}) {
  const timers = new Map();
  let nextId = 1;
  const seen = [];
  const calls = { load: 0, retry: 0 };
  const queue = { load: [], retry: [] };
  const ctl = createSiteStatusController({
    load: async () => {
      calls.load += 1;
      return (load ?? (() => ({ ok: true, site: SITES.up_to_date })))(calls.load);
    },
    retry: async () => {
      calls.retry += 1;
      return (retry ?? (() => ({ ok: true, site: SITES.updating })))(calls.retry);
    },
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    onChange: (state, busy) => seen.push({ state, busy }),
    initial,
  });
  const tick = async () => {
    const pending = [...timers.entries()];
    timers.clear();
    for (const [, t] of pending) t.fn();
    await new Promise((r) => setImmediate(r));
  };
  const flush = () => new Promise((r) => setImmediate(r));
  return { ctl, timers, seen, calls, tick, flush, queue, last: () => seen.at(-1) };
}

test("reads once on start; up to date schedules no poll", async () => {
  const h = harness();
  h.ctl.start();
  await h.flush();
  assert.equal(h.calls.load, 1);
  assert.equal(h.last().state.site.state, "up_to_date");
  assert.equal(h.timers.size, 0);
});

test("updating polls every 15 s until it is up to date, then stops", async () => {
  const replies = [SITES.updating, SITES.updating, SITES.up_to_date];
  const h = harness({ load: (n) => ({ ok: true, site: replies[n - 1] }) });
  h.ctl.start();
  await h.flush();
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].ms, POLL_MS);
  assert.equal(POLL_MS, 15_000);
  await h.tick();
  assert.equal(h.calls.load, 2);
  assert.equal(h.timers.size, 1);
  await h.tick();
  assert.equal(h.calls.load, 3);
  assert.equal(h.last().state.site.state, "up_to_date");
  assert.equal(h.timers.size, 0, "no poll once up to date");
});

test("failed does not poll; a failed read shows unavailable, never a guess", async () => {
  const h = harness({ load: () => ({ ok: true, site: SITES.failed }) });
  h.ctl.start();
  await h.flush();
  assert.equal(h.timers.size, 0);
  const u = harness({ load: () => ({ ok: false, status: 503, error: { code: "unavailable" } }) });
  u.ctl.start();
  await u.flush();
  assert.deepEqual(u.last().state, { kind: "unavailable" });
  const odd = harness({ load: () => ({ ok: true, site: { state: "maybe" } }) });
  odd.ctl.start();
  await odd.flush();
  assert.deepEqual(odd.last().state, { kind: "unavailable" });
});

test("window focus reads once more", async () => {
  const h = harness();
  h.ctl.start();
  await h.flush();
  h.ctl.focus();
  await h.flush();
  assert.equal(h.calls.load, 2);
});

test("Try again: POSTs once, busy while it runs (a second click is ignored), then shows the returned state", async () => {
  let release;
  const h = harness({ load: () => ({ ok: true, site: SITES.failed }), retry: () => new Promise((r) => (release = () => r({ ok: true, site: SITES.updating }))) });
  h.ctl.start();
  await h.flush();
  const first = h.ctl.tryAgain();
  assert.equal(h.last().busy, true);
  void h.ctl.tryAgain();
  assert.equal(h.calls.retry, 1, "disabled while the request runs");
  release();
  await first;
  assert.equal(h.last().busy, false);
  assert.equal(h.last().state.site.state, "updating");
  assert.equal(h.timers.size, 1, "polling starts again");
});

test("a write reply's site (almar:site) is shown at once; junk is ignored", async () => {
  const h = harness();
  h.ctl.start();
  await h.flush();
  h.ctl.receive(SITES.updating);
  assert.equal(h.last().state.site.state, "updating");
  const count = h.seen.length;
  h.ctl.receive({ nope: true });
  assert.equal(h.seen.length, count);
});

test("a slow read never overwrites a newer answer", async () => {
  let releaseLoad;
  const h = harness({ load: () => new Promise((r) => (releaseLoad = () => r({ ok: true, site: SITES.up_to_date }))) });
  h.ctl.start();
  h.ctl.receive(SITES.updating);
  releaseLoad();
  await h.flush();
  assert.equal(h.last().state.site.state, "updating");
});

test("stop (unmount): no timer left, and a reply that lands later changes nothing", async () => {
  let releaseLoad;
  const h = harness({ load: () => new Promise((r) => (releaseLoad = () => r({ ok: true, site: SITES.updating }))) });
  h.ctl.start();
  h.ctl.stop();
  releaseLoad();
  await h.flush();
  assert.equal(h.timers.size, 0);
  assert.equal(h.seen.some((s) => s.state.kind === "site"), false);
  h.ctl.focus();
  await h.ctl.tryAgain();
  assert.equal(h.calls.load, 1);
  assert.equal(h.calls.retry, 0);
});

test("source: the line reads and posts only through ops-client, has role=status, is mounted only for mode ops", () => {
  const line = readFileSync("components/ops/site-status-line.tsx", "utf8");
  assert.equal(/\bfetch\(/.test(line), false);
  assert.match(line, /opsFetch<\{ site: SiteStatus \}>\("\/api\/ops\/site-status"\)/);
  assert.match(line, /opsSend<\{ site: SiteStatus \}>\("\/api\/ops\/site-update", \{\}\)/);
  assert.match(line, /role="status"/);
  assert.equal(/#[0-9a-f]{3,8}\b/i.test(line), false, "no hex: token colours only");
  const shell = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  assert.match(shell, /\{mode === "ops" \? <SiteStatusLine copy=\{OPS_SITE_STATUS_COPY\[locale\]\} \/> : null\}/);
});

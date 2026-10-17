// The pure side of Content -> Team and Catalog -> Packages (plan 03.2-08): the link and email rules, the form from the
// server's detail, how the site reads the price line, and what the kit editor is told is live. Task 2 adds the payloads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const team = await loadTs("app/dashboard/(ops)/content/team/team-forms.ts");
const journeys = await loadTs("app/dashboard/(ops)/catalog/packages/journey-forms.ts");
const { OPS_TEAM_COPY } = await loadTs("lib/copy/ops-team.ts");
const server = await loadTs("lib/ops/validate.ts");

const row = (url, label = "Instagram") => ({ key: `k-${url}-${label}`, label, url });

test("validateLinks: https addresses on the four platforms pass; empty rows are dropped, the rest trimmed", () => {
  const out = team.validateLinks([row(" https://www.instagram.com/a "), row(""), row("https://www.linkedin.com/in/b", "LinkedIn")]);
  assert.equal(out.ok, true);
  assert.deepEqual(out.links, [
    { label: "Instagram", url: "https://www.instagram.com/a" },
    { label: "LinkedIn", url: "https://www.linkedin.com/in/b" },
  ]);
});

test("validateLinks: http, javascript and a bare word are refused by row", () => {
  for (const url of ["http://www.instagram.com/a", "javascript:alert(1)", "instagram", "https://nodot"]) {
    const bad = row(url);
    const out = team.validateLinks([bad]);
    assert.equal(out.ok, false, url);
    assert.equal(out.problems[bad.key], "https", url);
  }
});

test("validateLinks: an address over 300 characters and a platform outside the list are refused", () => {
  const long = row(`https://www.instagram.com/${"a".repeat(300)}`);
  assert.equal(team.validateLinks([long]).problems[long.key], "too_long");
  const other = row("https://www.tiktok.com/@a", "TikTok");
  assert.equal(team.validateLinks([other]).problems[other.key], "label");
});

test("validateLinks: a ninth link is refused", () => {
  const nine = Array.from({ length: 9 }, (_, n) => row(`https://www.instagram.com/${n}`));
  const out = team.validateLinks(nine);
  assert.equal(out.tooMany, true);
  assert.equal(out.ok, false);
  assert.equal(team.validateLinks(nine.slice(0, 8)).ok, true);
});

test("emailOk: empty is fine; an address must have one @ and a dot in the domain", () => {
  assert.equal(team.emailOk(""), true);
  assert.equal(team.emailOk("name@example.com"), true);
  for (const bad of ["name", "name@", "name@example", "a b@example.com"]) assert.equal(team.emailOk(bad), false, bad);
});

test("slugProblem: a member that is not published needs a typed address; nothing is made up from the name", () => {
  assert.equal(team.slugProblem({ slug: "", published: false }), "needed");
  assert.equal(team.slugProblem({ slug: "   ", published: false }), "needed");
  assert.equal(team.slugProblem(team.emptyTeamForm()), "needed");
  assert.equal(team.emptyTeamForm().slug, "");
  assert.equal(team.slugFrom, undefined);
});

test("slugProblem: the same pattern rule as the server, accepted and refused alike", () => {
  const good = ["a", "maria", "first-last", "team-2", " padded-address ", "a".repeat(80)];
  const bad = ["First-Last", "first_last", "first--last", "-first", "last-", "café", "[web-address]", "a b", "a".repeat(81)];
  for (const value of good) {
    assert.equal(team.slugProblem({ slug: value, published: false }), null, value);
    assert.equal(server.slug(value), value.trim(), value);
  }
  for (const value of bad) {
    assert.equal(team.slugProblem({ slug: value, published: false }), "pattern", value);
    assert.throws(() => server.slug(value), value);
  }
});

test("the address locks once published: not checked, not sent; before that Save sends what is typed", () => {
  assert.equal(team.slugProblem({ slug: "Not-Valid", published: true }), null);
  assert.deepEqual(team.slugToSend({ slug: "web-address", published: true }), {});
  assert.deepEqual(team.slugToSend({ slug: " web-address ", published: false }), { slug: "web-address" });
});

test("the member editor draws a published address as text and a draft one as a field with the hint", () => {
  const source = readFileSync(new URL("../app/dashboard/(ops)/content/team/team-screen.tsx", import.meta.url), "utf8");
  assert.match(source, /form\.published \? \(\s*<LockedAddress label=\{copy\.fieldSlug\} value=\{form\.slug\} note=\{copy\.slugLocked\} \/>/);
  assert.match(source, /hint=\{copy\.slugHint\}/);
  assert.match(source, /canSave=\{form \? form\.text\.en\.name\.trim\(\) !== "" && slugIssue === null/);
});

test("teamForm: the detail becomes a form; a missing language is blank and draft; an unknown label reads as Instagram", () => {
  const form = team.teamForm({
    id: "t1",
    slug: "a",
    photo_media_id: null,
    photo: null,
    email: null,
    links: [{ label: "Other", url: "https://x.example/a" }],
    is_published: false,
    position: 1,
    translations: { en: { name: "[Name]", role: null, bio: null, status: "published" }, ar: null, es: null },
    translation_state: { en: "published", ar: "missing", es: "missing" },
    updated_at: "2026-10-15T00:00:00Z",
  });
  assert.equal(form.email, "");
  assert.equal(form.links[0].label, "Instagram");
  assert.deepEqual(form.text.en, { name: "[Name]", role: "", bio: "" });
  assert.deepEqual(form.text.ar, { name: "", role: "", bio: "" });
  assert.deepEqual(form.status, { en: "published", ar: "draft", es: "draft" });
});

test("liveTeamFields: only a published member, in published languages, in fields with text", () => {
  const saved = { en: { name: "A", role: "B", bio: "" }, ar: { name: "أ", role: "", bio: "" }, es: { name: "A", role: "B", bio: "C" } };
  assert.deepEqual(team.liveTeamFields(false, { en: "published", ar: "published", es: "published" }, saved), {});
  assert.deepEqual(team.liveTeamFields(true, { en: "published", ar: "published", es: "draft" }, saved), { ar: ["name"] });
});

test("priceReading: repeats the server's reading; never computes; the unreadable line when both are null", () => {
  const copy = OPS_TEAM_COPY.en.journeys;
  assert.equal(journeys.priceReading({ amount: "4900.00", currency: "USD" }, null, copy), "How the site reads it: from USD 4,900");
  assert.equal(
    journeys.priceReading(null, { low: "12000.00", high: "15500.50", currency: "AED", open_ended: false }, copy),
    "How the site reads it: AED 12,000 to 15,500.50",
  );
  assert.equal(journeys.priceReading(null, { low: "8000", high: null, currency: "AED", open_ended: true }, copy), "How the site reads it: from AED 8,000");
  assert.equal(journeys.priceReading(null, null, copy), copy.readingNone);
  assert.equal(journeys.priceReading({ amount: "[AMOUNT]", currency: "USD" }, null, copy), "How the site reads it: from USD [AMOUNT]");
});

test("journeyForm: keeps is_featured and the server's price reading; a missing language is blank", () => {
  const form = journeys.journeyForm({
    id: "j1",
    slug: "a",
    is_featured: true,
    media_id: null,
    image: null,
    price_from: null,
    price_estimate: null,
    is_published: true,
    position: 1,
    translations: {
      en: { name: "[Name]", price_label: "[Price line]", tagline: null, duration_label: null, ideal_for_label: null, ideal_for: null, body: null, status: "published" },
      ar: null,
      es: null,
    },
    translation_state: { en: "published", ar: "missing", es: "missing" },
    updated_at: "2026-10-15T00:00:00Z",
  });
  assert.equal(form.is_featured, true);
  assert.equal(form.text.en.price_label, "[Price line]");
  assert.equal(form.text.en.tagline, "");
  assert.equal(form.text.es.name, "");
});

test("OPS_TEAM_COPY: the same keys in en, ar and es, none empty; dashboard Spanish is usted", () => {
  const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  const get = (o, path) => path.split(".").reduce((a, k) => a[k], o);
  const ref = keys(OPS_TEAM_COPY.en);
  for (const l of ["ar", "es"]) assert.deepEqual(keys(OPS_TEAM_COPY[l]), ref, l);
  for (const l of ["en", "ar", "es"]) for (const k of ref) assert.ok(String(get(OPS_TEAM_COPY[l], k)).trim().length > 0, `${l}.${k}`);
  assert.match(OPS_TEAM_COPY.es.team.orderNote, /^Arrastre /);
  // The web address reads as on stays, worded for a member; the need line is the stays line.
  assert.equal(OPS_TEAM_COPY.en.team.slugHint, "Lowercase letters, numbers and dashes. It cannot change once the member is published.");
  assert.equal(OPS_TEAM_COPY.en.team.problemSlugNeeded, "Enter a web address.");
  assert.match(OPS_TEAM_COPY.es.team.problemSlugNeeded, /^Indique /);
});

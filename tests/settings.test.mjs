// Plan 02-06: Settings contrast gate, the settings screen's bans, and the maintenance page's locked content.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const c = await loadTs("lib/settings/contrast.ts");

const SHIPPED = { teal: "#1f3b40", charcoal: "#262626", gold: "#d4ba8a", ivory: "#fffaf0", white: "#ffffff" };

/** Source without comments, so a ban is not tripped (or dodged) by a comment. */
function code(path) {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

test("contrast ratio matches the 02-UI-SPEC measured pairs", () => {
  const near = (fg, bg, want) => assert.ok(Math.abs(c.contrastRatio(fg, bg) - want) < 0.01, `${fg} on ${bg}`);
  near("#1f3b40", "#fffaf0", 11.48);
  near("#1f3b40", "#ffffff", 11.95);
  near("#262626", "#fffaf0", 14.55);
  near("#1f3b40", "#d4ba8a", 6.37);
  near("#8f2d2d", "#fffaf0", 7.82);
  near("#63615f", "#fffaf0", 5.93);
  near("#d4ba8a", "#fffaf0", 1.8);
  assert.equal(c.contrastRatio("#ffffff", "#ffffff"), 1);
  assert.equal(c.contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(c.contrastRatio("#fffaf0", "#1f3b40"), c.contrastRatio("#1f3b40", "#fffaf0"));
});

test("a pair below its threshold fails, at or above passes", () => {
  assert.equal(c.pairPasses(c.contrastRatio("#ffffff", "#ffffff"), "text"), false);
  assert.equal(c.pairPasses(4.49, "text"), false);
  assert.equal(c.pairPasses(4.5, "text"), true);
  assert.equal(c.pairPasses(2.99, "large"), false);
  assert.equal(c.pairPasses(3, "large"), true);
});

test("hex input is #rrggbb only, never repaired", () => {
  assert.equal(c.parseHex("#1F3B40"), "#1f3b40");
  for (const bad of ["1f3b40", "#fff", "#1f3b4", "#1f3b40 ", "rgb(0,0,0)", "", null, 7]) assert.equal(c.parseHex(bad), null);
});

test("the shipped brand colours pass every required pair; gold is in none", () => {
  assert.deepEqual(c.failingColors(SHIPPED), []);
  assert.ok(c.REQUIRED_PAIRS.every((pair) => pair.fg !== "gold" && pair.bg !== "gold"));
  assert.deepEqual(c.failingColors({ ...SHIPPED, gold: "#fffaf0" }), []);
});

test("a failing pair blocks save and is charged to the colour she changed", () => {
  // White on white: Teal set to white fails on White and Ivory; only Teal is marked.
  assert.deepEqual(c.failingColors({ ...SHIPPED, teal: "#ffffff" }, new Set(["teal"])), ["teal"]);
  assert.deepEqual(c.failingColors({ ...SHIPPED, teal: "#9fb8bb" }, new Set(["teal"])), ["teal"]);
  assert.deepEqual(c.failingColors({ ...SHIPPED, ivory: "#262626" }, new Set(["ivory"])), ["ivory"]);
  // Nothing marked changed: both brand colours of the failing pair are listed.
  assert.deepEqual(c.failingColors({ ...SHIPPED, charcoal: "#fffaf0" }), ["charcoal", "ivory", "white"]);
});

const SETTINGS = "app/dashboard/(ops)/settings/settings-screen.tsx";
const MAINTENANCE = "lib/maintenance-document.ts";

test("settings screen: maintenance checkbox, no radius control, no rate input, no admin client", () => {
  const src = code(SETTINGS);
  assert.match(src, /Maintenance is on|maintenanceOn/);
  assert.doesNotMatch(src, /radius/i);
  assert.doesNotMatch(src, /name=["'{][^"'}]*rate/i);
  assert.doesNotMatch(src, /createSupabaseAdmin|SUPABASE_SERVICE_ROLE_KEY|lib\/supabase\/clients/);
});

test("maintenance page: the locked line, real phone and email links, no WhatsApp and no dashboard", () => {
  assert.ok(existsSync(MAINTENANCE), MAINTENANCE);
  const src = code(MAINTENANCE);
  assert.ok(src.includes("ALMAR Private Journey is closed for a short time.") || /maintenanceLine|closedLine/.test(src));
  assert.match(src, /tel:\+971563883302/);
  assert.match(src, /mailto:inquiries@almarprivatejourney\.com/);
  assert.doesNotMatch(src, /wa\.me|whatsapp/i);
  assert.doesNotMatch(src, /dashboard/i);
});

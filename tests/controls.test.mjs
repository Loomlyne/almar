import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Source-level checks for D-13 (button), D-14 (link), D-17 (ToggleCard, no radios).

const read = (f) => readFileSync(f, "utf8");
const FOUR = ["button", "link", "chip", "toggle-card"].map((n) => `components/ui/${n}.tsx`);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(name)) acc.push(p);
  }
  return acc;
}

test("button: teal primary, ivory label, hover and press steps, cva sizes (D-13)", () => {
  const s = read("components/ui/button.tsx");
  for (const c of ["bg-teal", "text-ivory", "hover:bg-teal-hover", "active:bg-teal-press"]) {
    assert.ok(s.includes(c), `button.tsx missing ${c}`);
  }
  // Gold is a line only: the outline and ivory variants may draw it as a border, never as a fill or as text.
  assert.doesNotMatch(s, /(?:bg|text)-gold/);
  for (const c of ["h-control px-6", "h-action px-8", "h-bar w-search", "h-bar-docked w-40"]) {
    assert.ok(s.includes(c), `button.tsx missing size ${c}`);
  }
  for (const c of ["disabled:bg-ivory", "disabled:border-line", "disabled:text-muted"]) {
    assert.ok(s.includes(c), `disabled look ${c}`);
  }
  assert.match(s, /from "class-variance-authority"/);
  assert.match(s, /from "\.\.\/\.\.\/lib\/cn"/);
});

test("link: the five signed kinds, no line under text, nothing turns gold (pictures/no-underlines)", () => {
  const s = read("components/ui/link.tsx");
  assert.doesNotMatch(s, /[\s":]underline\b|decoration-(?!clone)/);
  assert.doesNotMatch(s, /(?:bg|text)-gold/);
  // Kind 1: a tile on hover; ivory focus on the teal footer; the current page is bold with no line.
  assert.ok(s.includes("hover:bg-ivory/14") && s.includes("focus-visible:outline-ivory"));
  assert.match(s, /LINK_CURRENT = "font-bold"/);
  // Kind 3: the row never wraps; the arrow never shrinks and mirrors in RTL.
  assert.match(s, /LINK_ALONE =\s*"group\/link inline-flex[^"]*hover:bg-teal-tint/);
  assert.ok(s.includes("shrink-0 rtl:-scale-x-100"));
  assert.ok(s.includes("ltr:motion-safe:group-hover/link:translate-x-1") && s.includes("rtl:motion-safe:group-hover/link:-translate-x-1"));
  // Kind 4: bold teal on an always-on tint block that keeps its shape on each wrapped line; no arrow.
  assert.match(s, /LINK_IN_SENTENCE =\s*"[^"]*bg-teal-tint[^"]*font-bold[^"]*box-decoration-clone[^"]*hover:bg-teal hover:text-ivory/);
  // Kind 5: Remove is red with its x.
  assert.match(s, /LINK_BUTTON_DANGER =\s*"[^"]*text-error[^"]*hover:bg-error\/10/);
  assert.match(s, /export function RemoveMark/);
});

test("toggle-card: pressed buttons in a labelled group with an alert line (D-17)", () => {
  const s = read("components/ui/toggle-card.tsx");
  assert.match(s, /export function ToggleCard\b/);
  assert.match(s, /export function ToggleCardGroup\b/);
  assert.match(s, /type="button"/);
  assert.match(s, /aria-pressed/);
  assert.match(s, /role="group"/);
  assert.match(s, /aria-labelledby/);
  assert.match(s, /role="alert"/);
  assert.match(s, /aria-describedby/);
  assert.ok(s.includes("shadow-selected"));
  assert.ok(s.includes("border-teal"));
});

test("chip: pressed state, 40px with 44px hit area, teal when on (D-47)", () => {
  const s = read("components/ui/chip.tsx");
  assert.match(s, /aria-pressed/);
  assert.ok(s.includes("h-chip"));
  assert.ok(s.includes("after:-inset-y-0.5"));
  assert.ok(s.includes("bg-teal border-teal text-ivory"));
});

test("no radio input anywhere under app or components (D-17)", () => {
  const hits = [...walk("app"), ...walk("components")].filter((f) => /type=["']radio["']|type:\s*["']radio["']/.test(read(f)));
  assert.deepEqual(hits, []);
});

test("the four control files have no arbitrary values or rounded utilities", () => {
  for (const f of FOUR) {
    const s = read(f);
    assert.doesNotMatch(s, /\bbg-\[/, `${f} has bg-[`);
    assert.doesNotMatch(s, /\brounded-(?!none)/, `${f} has rounded-*`);
  }
});

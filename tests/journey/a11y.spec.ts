import { test, expect, type Page } from "@playwright/test";
import { RENDERS_NOTHING, VIEWPORTS, scenesOf, settle } from "./matrix";

// DSGN-05: icon-only controls have an accessible name, icons are inline SVG in currentColor,
// the focus ring is a 2px teal outline offset 2px, and Tab order follows visual order.
// Successor of the removed tests/design-a11y.spec.ts, run over every scene in English.

const english = scenesOf(["en"]);

const TEAL = "rgb(31, 59, 64)";

const SCOPE = "#harness-root, [role=dialog], [data-radix-popper-content-wrapper]";
const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

async function open(page: Page, url: string, viewport: keyof typeof VIEWPORTS) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(url);
  await settle(page);
}

for (const s of english) {
  if (RENDERS_NOTHING.has(`${s.component}/${s.state}`)) continue;

  test(`names and icons ${s.component} / ${s.state} / ${VIEWPORTS[s.viewport].width}`, async ({ page }) => {
    await open(page, s.url, s.viewport);
    const report = await page.evaluate(
      ({ scope }) => {
        const roots = Array.from(document.querySelectorAll(scope));
        const inScope = (sel: string) => roots.flatMap((r) => Array.from(r.querySelectorAll(sel)));
        const hidden = (el: Element) => !!el.closest("[aria-hidden=true]");
        const textOf = (el: Element) => {
          let out = "";
          const walk = (n: Node) => {
            if (n.nodeType === 3) out += n.textContent;
            else if (n.nodeType === 1) {
              const e = n as Element;
              if (e.getAttribute("aria-hidden") === "true") return;
              if (getComputedStyle(e).display === "none") return;
              e.childNodes.forEach(walk);
            }
          };
          walk(el);
          return out.trim();
        };
        const labelled = (el: Element) => {
          const label = el.getAttribute("aria-label")?.trim();
          if (label) return true;
          const by = el.getAttribute("aria-labelledby");
          if (by && by.split(/\s+/).some((id) => (document.getElementById(id)?.textContent ?? "").trim())) return true;
          return false;
        };
        const named = (el: Element) => labelled(el) || textOf(el) !== "" || !!el.querySelector("svg title, img[alt]:not([alt=''])");

        const unnamed: string[] = [];
        for (const el of inScope("button, a, [role=button]")) {
          if (hidden(el)) continue;
          if (!named(el)) unnamed.push(el.outerHTML.slice(0, 120));
        }
        const badSvg: string[] = [];
        const notCurrent: string[] = [];
        for (const svg of inScope("svg")) {
          const control = svg.closest("button, a, [role=button], [role=img]");
          const ok = svg.getAttribute("aria-hidden") === "true" || hidden(svg) || (control && named(control));
          if (!ok) badSvg.push(svg.outerHTML.slice(0, 120));
          if (!svg.outerHTML.includes("currentColor")) notCurrent.push(svg.outerHTML.slice(0, 120));
        }
        return { unnamed, badSvg, notCurrent };
      },
      { scope: SCOPE },
    );
    expect(report.unnamed, "controls without an accessible name").toEqual([]);
    expect(report.badSvg, "svgs neither aria-hidden nor inside a named control").toEqual([]);
    expect(report.notCurrent, "svgs not drawn in currentColor").toEqual([]);
  });
}

type Focus = { tag: string; text: string; x: number; y: number; w: number; h: number; ring: string; inside: boolean };

/** Press Tab up to `max` times and describe each focused element that lives in the scene. */
async function tabThrough(page: Page, max: number): Promise<Focus[]> {
  const seen: Focus[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(
      async ({ scope }) => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        // The ring colour transitions in (transition-colors); read it at rest, not mid-fade.
        await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
        const inside = Array.from(document.querySelectorAll(scope)).some((r) => r.contains(el));
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[${el.getAttribute("role")}]` : ""}`,
          text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30),
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          inside,
          ring: [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.outlineOffset, cs.boxShadow === "none" ? "no-shadow" : "shadow"].join("|"),
        };
      },
      { scope: SCOPE },
    );
    if (!f || !f.inside) continue;
    // Focus came back round to an element already visited: one full cycle is done.
    if (seen.some((g) => g.x === f.x && g.y === f.y && g.text === f.text)) break;
    seen.push(f);
  }
  return seen;

}

// A control may show its own focus mark in place of the global outline only when it draws a
// visible replacement: the JourneySegment 3px inset rule (D-36) or a Field border.
const RULE_FOCUS = /^none\|.*\|shadow$/;

for (const s of english) {
  if (RENDERS_NOTHING.has(`${s.component}/${s.state}`)) continue;

  test(`focus ring ${s.component} / ${s.state} / ${VIEWPORTS[s.viewport].width}`, async ({ page }) => {
    await open(page, s.url, s.viewport);
    const seq = await tabThrough(page, 40);
    for (const f of seq) {
      const [style, width, color, offset] = f.ring.split("|");
      const global = style === "solid" && width === "2px" && color === TEAL && offset === "2px";
      const replaced = RULE_FOCUS.test(f.ring) && s.component.startsWith("journey-") && f.tag.startsWith("button");
      expect(global || replaced, `${f.tag} "${f.text}" focus: ${f.ring}`).toBe(true);
    }
  });

  test(`first Tab lands on the first tabbable (dialogs: focus stays inside) ${s.component} / ${s.state} / ${VIEWPORTS[s.viewport].width}`, async ({ page }) => {
    await open(page, s.url, s.viewport);
    const first = await page.evaluate(
      ({ scope, tabbable }) => {
        const roots = Array.from(document.querySelectorAll(scope));
        const visible = (e: Element) => {
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && cs.visibility !== "hidden";
        };
        // The dialog, when open, traps focus and is the tab scope.
        const dialog = document.querySelector("[role=dialog]");
        const scopeRoots = dialog ? [dialog] : roots;
        for (const r of scopeRoots) {
          for (const e of Array.from(r.querySelectorAll(tabbable))) {
            if (visible(e) && !e.closest("[aria-hidden=true]")) {
              const t = Number(e.getAttribute("tabindex") ?? 0);
              if (t >= 0) return (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30);
            }
          }
        }
        return null;
      },
      { scope: SCOPE, tabbable: TABBABLE },
    );
    test.skip(first === null, "no tabbable element in this scene");
    const opened = await page.evaluate(
      () => document.querySelector("[role=dialog], [data-radix-popper-content-wrapper]") !== null,
    );
    if (opened) {
      // An open sheet, cart dialog or popover moves focus inside itself first (heading, day, ...),
      // so "first" is not the first tabbable. A modal dialog must keep every Tab inside it.
      if (await page.locator("[role=dialog]").count()) {
        const dialog = page.locator("[role=dialog]");
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press("Tab");
          expect(await dialog.evaluate((d) => d.contains(document.activeElement)), `Tab ${i + 1} stays in the dialog`).toBe(true);
        }
      }
      return;
    }
    const seq = await tabThrough(page, 6);
    expect(seq.length, "focus reaches the scene").toBeGreaterThan(0);
    expect(seq[0].text).toBe(first);
  });
}

test.describe("tab order follows visual order", () => {
  for (const [component, state, viewport, locale] of [
    ["journey-bar", "empty", "desktop", "en"],
    ["journey-bar", "empty", "desktop", "ar"],
    ["journey-bar", "filled", "desktop", "en"],
    ["journey-bar", "arrival", "desktop", "en"],
    ["journey-sheet", "step-1", "phone", "en"],
    ["journey-sheet", "step-3", "phone", "en"],
    ["journey-sheet", "step-3", "phone", "ar"],
    ["step-rail", "step-3", "desktop", "en"],
    ["journey-cart", "rail-filled", "desktop", "en"],
    ["guest-panel", "filled", "desktop", "en"],
  ] as const) {
    test(`${component} / ${state} / ${viewport} / ${locale}`, async ({ page }) => {
      await open(page, `/__harness?c=${component}&s=${state}&l=${locale}`, viewport);
      const seq = await tabThrough(page, 24);
      expect(seq.length).toBeGreaterThan(1);
      const rtl = locale === "ar";
      // A modal dialog cycles its focus: one jump from the last control back to the first is expected.
      let wrapped = false;
      for (let i = 1; i < seq.length; i++) {
        const a = seq[i - 1];
        const b = seq[i];
        const sameRow = Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < Math.max(a.h, b.h) / 2;
        if (sameRow) {
          // Same row: reading direction.
          const ok = rtl ? b.x + b.w / 2 <= a.x + a.w / 2 + 1 : b.x + b.w / 2 >= a.x + a.w / 2 - 1;
          expect(ok, `${a.text} -> ${b.text} runs against the reading direction`).toBe(true);
        } else {
          // A new row: it is below, or (wrapping) the sequence restarts higher only from the last item.
          if (b.y < a.y - 1 && !wrapped) wrapped = true;
          else expect(b.y, `${a.text} -> ${b.text} jumps up`).toBeGreaterThanOrEqual(a.y - 1);
        }
      }
    });
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { loadRenderer } from "./helpers/render-component.mjs";

// SiteNav tone="on-image" sits over the hero. Its cva base listed `sticky` and the tone listed `absolute` in one
// class string and the stylesheet let `sticky` win (measured on the build: position sticky, 61px of the page).
// Plans 04 and 06 wrapped the nav in an absolute div to work around it. The nav now merges its classes.

const render = await loadRenderer("components/ui/nav.tsx", "SiteNav");
const headerClasses = (html) => /<header class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];
const base = { locale: "en", links: [{ label: "Destinations", href: "/destinations" }], login: false, currency: false };

test("on-image: absolute, inset-x-0, not sticky", () => {
  const classes = headerClasses(render({ ...base, tone: "on-image" }));
  assert.ok(classes.includes("absolute"), classes.join(" "));
  assert.ok(classes.includes("inset-x-0"), classes.join(" "));
  assert.equal(classes.includes("sticky"), false, `sticky would win over absolute: ${classes.join(" ")}`);
  assert.ok(classes.includes("top-0") && classes.includes("z-40") && classes.includes("w-full"), classes.join(" "));
  assert.ok(classes.includes("bg-transparent") && classes.includes("text-ivory"), classes.join(" "));
});

test("solid (the default): sticky, not absolute", () => {
  for (const props of [{ ...base }, { ...base, tone: "solid" }]) {
    const classes = headerClasses(render(props));
    assert.ok(classes.includes("sticky"), classes.join(" "));
    assert.equal(classes.includes("absolute"), false, classes.join(" "));
    assert.ok(classes.includes("top-0") && classes.includes("z-40") && classes.includes("bg-ivory"), classes.join(" "));
  }
});

test("on-image uses the white wordmark, solid the charcoal one", () => {
  assert.match(render({ ...base, tone: "on-image" }), /Poly_White\.svg/);
  assert.match(render({ ...base, tone: "solid" }), /Stacked_Charcoal\.svg/);
});

test("no page wraps the nav in an absolute div to lay it over the hero", async () => {
  const { existsSync, readFileSync } = await import("node:fs");
  // The home and the stay page both reach SiteNav through PublicFrame; the stay page's own chrome file is gone.
  assert.equal(existsSync("components/pages/stay-detail/chrome.tsx"), false);
  for (const file of [
    "components/site/public-frame.tsx",
    "components/pages/home/home-nav.tsx",
    "components/pages/stay-detail-page.tsx",
  ]) {
    assert.equal(/<div className="absolute inset-x-0/.test(readFileSync(file, "utf8")), false, `${file} wraps the nav`);
  }
});

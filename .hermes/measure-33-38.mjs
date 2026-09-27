import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const outDir = "/Users/koss/Developer/almarprod-Website-Code/.hermes/measure-33-38";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const requests = [];
page.on("request", (req) => {
  const url = req.url();
  if (!url.includes("127.0.0.1:3010")) return;
  if (url.includes("/_next/") || url.endsWith(".css") || url.endsWith(".js")) return;
  requests.push({ method: req.method(), url, type: req.resourceType() });
});

await page.goto("http://127.0.0.1:3010/design", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(() => {
  window.__measureDay = (el) => {
    const cs = getComputedStyle(el);
    const before = getComputedStyle(el, "::before");
    const after = getComputedStyle(el, "::after");
    const rect = el.getBoundingClientRect();
    return {
      classes: el.className,
      text: el.textContent?.trim(),
      disabled: el.disabled,
      focusVisible: el.matches(":focus-visible"),
      w: Math.round(rect.width * 100) / 100,
      h: Math.round(rect.height * 100) / 100,
      radius: cs.borderRadius,
      bg: cs.backgroundColor,
      color: cs.color,
      boxShadow: cs.boxShadow,
      outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`,
      border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
      before: {
        content: before.content,
        top: before.top,
        right: before.right,
        bottom: before.bottom,
        left: before.left,
        width: before.width,
        height: before.height,
        bg: before.backgroundColor,
        border: `${before.borderTopWidth} ${before.borderTopStyle}`,
        radius: before.borderRadius,
        transform: before.transform,
      },
      after: {
        content: after.content,
        width: after.width,
        height: after.height,
        bg: after.backgroundColor,
        border: `${after.borderTopWidth} ${after.borderTopStyle} ${after.borderTopColor}`,
        radius: after.borderRadius,
        boxShadow: after.boxShadow,
      },
    };
  };
});

const tokens = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const pick = (name) => cs.getPropertyValue(name).trim();
  const probe = document.createElement("div");
  probe.style.color = "var(--color-heading)";
  document.body.appendChild(probe);
  const heading = getComputedStyle(probe).color;
  probe.style.color = "var(--color-accent)";
  const accent = getComputedStyle(probe).color;
  probe.style.background = "var(--color-bg)";
  const bg = getComputedStyle(probe).backgroundColor;
  probe.style.background = "var(--color-surface)";
  const surface = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return {
    headingVar: pick("--color-heading"),
    accentVar: pick("--color-accent"),
    heading,
    accent,
    bg,
    surface,
    teal: pick("--color-teal"),
    gold: pick("--color-gold"),
  };
});

async function snapshotCalendar(selector, label) {
  return page.evaluate(({ selector, label }) => {
    const root = document.querySelector(selector);
    if (!root) return { label, missing: true, selector };
    const cal = root.querySelector(".calendar");
    if (!cal) return { label, missingCalendar: true, selector };
    const grid = cal.querySelector(".calendar-grid");
    const gcs = grid ? getComputedStyle(grid) : null;
    const typed = {};
    for (const cls of ["is-start", "is-end", "is-single", "is-range", "is-today"]) {
      const el = cal.querySelector(`.calendar-day.${cls}`);
      if (el) typed[cls] = window.__measureDay(el);
    }
    const radii = new Set(
      [...cal.querySelectorAll(".calendar-day, .calendar, .calendar-grid")].map((el) => getComputedStyle(el).borderRadius),
    );
    const sizes = [...cal.querySelectorAll(".calendar-day")].map((el) => {
      const r = el.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    });
    return {
      label,
      selector,
      sectionId: root.id || root.closest("section")?.id || null,
      title: cal.querySelector(".calendar-title")?.textContent?.trim(),
      gridColumns: gcs?.gridTemplateColumns,
      gridGap: gcs?.gap,
      dayCount: cal.querySelectorAll(".calendar-day").length,
      sizeSet: [...new Set(sizes)],
      radii: [...radii],
      typed,
    };
  }, { selector, label });
}

async function pickRange(sectionSelector) {
  const days = page.locator(`${sectionSelector} .calendar-day:not([disabled])`);
  const count = await days.count();
  if (count < 8) return { picked: false, count };
  await days.nth(2).click();
  await days.nth(6).click();
  return { picked: true, count };
}

const calendars = {};
calendars.dateRangePick = await pickRange("#date-range");
calendars.dateRange = await snapshotCalendar("#date-range", "date-range");
calendars.nights = await snapshotCalendar("#specimen-nights", "nights");

await page.locator("#hero").getByRole("button", { name: "Dates" }).click();
await page.waitForSelector("#hero .calendar-day");
calendars.heroPick = await pickRange("#hero");
calendars.hero = await snapshotCalendar("#hero", "hero");

await page.locator("#input #date").click();
await page.waitForSelector("#input .calendar-day");
const inputDays = page.locator("#input .calendar-day:not([disabled])");
if (await inputDays.count()) await inputDays.nth(4).click();
await page.locator("#input #date").click();
await page.waitForSelector("#input .calendar-day");
calendars.input = await snapshotCalendar("#input", "input");

async function interaction(section) {
  const plain = page.locator(`${section} .calendar-day:not([disabled]):not(.is-start):not(.is-end):not(.is-single)`).first();
  await plain.scrollIntoViewIfNeeded();
  await plain.hover();
  const hover = await plain.evaluate((el) => window.__measureDay(el));
  const tabDay = page.locator(`${section} .calendar-day[tabindex="0"]`);
  await tabDay.focus();
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate((section) => {
    const el = document.querySelector(`${section} .calendar-day:focus`);
    if (!el) return { missing: true };
    return window.__measureDay(el);
  }, section);
  return { hover, focused };
}

calendars.dateRangeInteract = await interaction("#date-range");
calendars.nightsInteract = await interaction("#specimen-nights");
calendars.heroInteract = await interaction("#hero");
await page.locator("#input #date").click();
await page.waitForSelector("#input .calendar-day");
calendars.inputInteract = await interaction("#input");

await page.locator("#date-range .range-picker").screenshot({ path: `${outDir}/33-date-range.png` });
await page.locator("#specimen-nights .calendar").screenshot({ path: `${outDir}/33-nights.png` });
await page.locator("#hero .calendar").screenshot({ path: `${outDir}/33-hero.png` });
await page.locator("#input .calendar").screenshot({ path: `${outDir}/33-input.png` });

const select = await page.evaluate(() => {
  const stack = document.querySelector("#select .ui-select-stack");
  const trigger = stack?.querySelector(".ui-select");
  const icon = stack?.querySelector(".ui-select-icon");
  const preview = stack?.querySelector(".ui-select-preview");
  const box = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      radius: cs.borderRadius,
      borderTop: cs.borderTopWidth,
      borderRight: cs.borderRightWidth,
      borderBottom: cs.borderBottomWidth,
      borderLeft: cs.borderLeftWidth,
      bg: cs.backgroundColor,
      shadow: cs.boxShadow,
    };
  };
  const svg = icon?.querySelector("svg");
  return {
    items: [...(preview?.querySelectorAll(".ui-select-item") ?? [])].map((el) => el.textContent?.trim()),
    triggerText: trigger?.innerText?.replace(/\s+/g, " ").trim(),
    stack: box(stack),
    trigger: box(trigger),
    icon: box(icon),
    iconBorderInline: icon ? getComputedStyle(icon).borderInlineStartWidth : null,
    svgTransform: svg ? getComputedStyle(svg).transform : null,
    preview: box(preview),
  };
});
await page.locator("#select .ui-select-stack").screenshot({ path: `${outDir}/34-select-closed.png` });
await page.locator("#select .ui-select").first().click();
await page.waitForTimeout(250);
const selectOpen = await page.evaluate(() => {
  const menu = document.querySelector('[role="listbox"], .ui-select-menu');
  const attached = document.querySelector(".ui-select-attached");
  const target = attached || menu;
  if (!target) return { missing: true };
  const cs = getComputedStyle(target);
  const r = target.getBoundingClientRect();
  const stack = document.querySelector("#select .ui-select-stack")?.getBoundingClientRect();
  return {
    className: target.className,
    items: [...target.querySelectorAll(".ui-select-item, [role='option']")].map((el) => el.textContent?.trim()),
    w: Math.round(r.width),
    h: Math.round(r.height),
    radius: cs.borderRadius,
    border: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].join(" "),
    bg: cs.backgroundColor,
    shadow: cs.boxShadow,
    stackW: stack ? Math.round(stack.width) : null,
    leftDelta: stack ? Math.round((r.left - stack.left) * 100) / 100 : null,
    topDelta: stack ? Math.round((r.top - stack.bottom) * 100) / 100 : null,
  };
});
const selectBox = await page.locator("#select .ui-select-stack").boundingBox();
if (selectBox) {
  await page.screenshot({
    path: `${outDir}/34-select-open.png`,
    clip: {
      x: Math.max(0, selectBox.x - 20),
      y: Math.max(0, selectBox.y - 20),
      width: Math.min(500, selectBox.width + 80),
      height: Math.min(700, selectBox.height + 280),
    },
  });
}
await page.keyboard.press("Escape");

const footer = await page.evaluate(() => {
  const footer = document.querySelector("#footer > footer.site-footer");
  if (!footer) return { missing: true };
  const cs = getComputedStyle(footer);
  const label = footer.querySelector(".footer-email-label");
  const input = footer.querySelector("#footer-newsletter-email");
  const labelBox = label?.getBoundingClientRect();
  const inputBox = input?.getBoundingClientRect();
  const radii = [...new Set([...footer.querySelectorAll("*")].map((el) => getComputedStyle(el).borderRadius))];
  return {
    bg: cs.backgroundColor,
    radius: cs.borderRadius,
    borderTop: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
    links: [...footer.querySelectorAll("a")].map((a) => ({
      text: a.textContent?.replace(/\s+/g, " ").trim(),
      href: a.getAttribute("href"),
    })),
    labelText: label?.textContent?.trim(),
    labelFor: label?.getAttribute("for"),
    labelColor: label ? getComputedStyle(label).color : null,
    labelVisible: Boolean(labelBox && labelBox.height > 8),
    labelAboveField: labelBox && inputBox ? labelBox.bottom <= inputBox.top + 2 && labelBox.left >= inputBox.left - 2 : null,
    inputRadius: input ? getComputedStyle(input).borderRadius : null,
    buttonRadius: getComputedStyle(footer.querySelector(".ui-button")).borderRadius,
    radii,
  };
});
await page.locator("#footer footer").screenshot({ path: `${outDir}/35-footer.png` });
const beforeInvalid = requests.length;
await page.locator("#footer-newsletter-email").fill("not-an-email");
await page.locator("#footer form").evaluate((form) => form.requestSubmit());
await page.waitForTimeout(250);
const invalidSubmit = {
  error: await page.locator("#footer-newsletter-error").textContent().catch(() => null),
  newRequests: requests.slice(beforeInvalid),
};
await page.locator("#footer-newsletter-email").fill("qa@example.com");
const beforeValid = requests.length;
await page.locator("#footer form").evaluate((form) => form.requestSubmit());
await page.waitForTimeout(400);
const validSubmit = {
  errorCount: await page.locator("#footer-newsletter-error").count(),
  toast: await page.getByText("Subscribed. Check your inbox.").count(),
  url: page.url(),
  newRequests: requests.slice(beforeValid),
};

const account = await page.evaluate(() => {
  const nav = document.querySelector("#account-menu .account-menu");
  if (!nav) return { missing: true };
  const cs = getComputedStyle(nav);
  const sign = nav.querySelector(".account-menu-sign-out");
  const nr = nav.getBoundingClientRect();
  const sr = sign?.getBoundingClientRect();
  return {
    tag: nav.tagName,
    radius: cs.borderRadius,
    border: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
    bg: cs.backgroundColor,
    shadow: cs.boxShadow !== "none",
    width: Math.round(nr.width),
    links: [...nav.querySelectorAll("a")].map((a) => ({
      text: a.textContent?.trim(),
      href: a.getAttribute("href"),
      display: getComputedStyle(a).display,
      decoration: getComputedStyle(a).textDecorationLine,
      radius: getComputedStyle(a).borderRadius,
    })),
    signText: sign?.textContent?.trim(),
    signTag: sign?.tagName,
    signWidth: sr ? Math.round(sr.width) : null,
    signRadius: sign ? getComputedStyle(sign).borderRadius : null,
    panelWiderThanSign: sr ? Math.round(nr.width - sr.width) : null,
    paragraphs: [...document.querySelectorAll("#account-menu p")].map((p) => p.textContent?.trim()),
  };
});
await page.locator("#account-menu .account-menu").screenshot({ path: `${outDir}/36-account.png` });

const map = await page.evaluate(() => {
  const section = document.querySelector("#specimen-map");
  if (!section) return { missing: true };
  return {
    text: section.innerText.replace(/\s+/g, " ").trim(),
    hasImg: !!section.querySelector("img"),
    hasIframe: !!section.querySelector("iframe"),
    osm: /openstreetmap|leaflet/i.test(section.innerHTML),
    mapbox: /mapbox/i.test(section.innerHTML),
  };
});
await page.locator("#specimen-map").screenshot({ path: `${outDir}/37-map.png` });

const photos = await page.evaluate(() => {
  const viewer = document.querySelector("#specimen-photos .photo-viewer");
  if (!viewer) return { missing: true };
  const img = viewer.querySelector("img").getBoundingClientRect();
  const controls = viewer.querySelector(".photo-viewer-controls");
  const ccs = getComputedStyle(controls);
  const buttons = [...viewer.querySelectorAll(".photo-viewer-control")].map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      label: el.getAttribute("aria-label"),
      w: Math.round(r.width * 100) / 100,
      h: Math.round(r.height * 100) / 100,
      radius: cs.borderRadius,
      bg: cs.backgroundColor,
      border: cs.borderTopWidth,
      onPhoto: r.left >= img.left - 1 && r.right <= img.right + 1 && r.top >= img.top - 1 && r.bottom <= img.bottom + 1,
    };
  });
  return {
    controlsBg: ccs.backgroundColor,
    controlsPosition: ccs.position,
    buttons,
  };
});
await page.locator("#specimen-photos .photo-viewer").screenshot({ path: `${outDir}/38-photos.png` });
await page.locator("#specimen-photos .photo-viewer-prev").click();
const afterPrev = await page.locator("#specimen-photos .photo-viewer").getAttribute("data-move");
await page.locator("#specimen-photos .photo-viewer-next").click();
const afterNext = await page.locator("#specimen-photos .photo-viewer").getAttribute("data-move");
await page.locator("#specimen-photos .photo-viewer-close").click();
const afterClose = await page.locator("#specimen-photos .photo-viewer").getAttribute("data-move");

console.log(JSON.stringify({
  tokens,
  calendars,
  select,
  selectOpen,
  footer,
  invalidSubmit,
  validSubmit,
  account,
  map,
  photos: { ...photos, afterPrev, afterNext, afterClose },
}, null, 2));
await browser.close();

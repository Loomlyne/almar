import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:3010/design", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.locator("#date-range").waitFor({ timeout: 20000 });

async function dayBox(root, selector) {
  const loc = page.locator(`${root} ${selector}`).first();
  if ((await loc.count()) === 0) return null;
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const b = getComputedStyle(el, "::before");
    return {
      text: el.textContent.trim(),
      w: Math.round(r.width),
      h: Math.round(r.height),
      radius: s.borderRadius,
      bg: s.backgroundColor,
      shadow: s.boxShadow,
      beforeW: b.width,
      beforeH: b.height,
      beforeBorder: b.borderTopWidth,
    };
  });
}

async function pickRange(root) {
  const days = page.locator(`${root} .calendar-day:not([disabled])`);
  const count = await days.count();
  if (count < 2) return { count };
  await days.nth(0).click();
  await days.nth(Math.min(4, count - 1)).click();
  const start = await dayBox(root, ".calendar-day.is-start");
  const mid = await dayBox(root, ".calendar-day.is-range");
  const end = await dayBox(root, ".calendar-day.is-end");
  let gap = null;
  if (start && mid) {
    const a = await page.locator(`${root} .calendar-day.is-start`).first().boundingBox();
    const b = await page.locator(`${root} .calendar-day.is-range`).first().boundingBox();
    if (a && b && Math.abs(a.y - b.y) < 2) gap = Math.round(b.x - (a.x + a.width));
  }
  return { count, start, mid, end, gap };
}

const nights = await pickRange("#specimen-nights");
const dateRange = await pickRange("#date-range");

const when = page.locator("#input button, #input input").first();
await page.locator("#input").scrollIntoViewIfNeeded();
const inputOpen = await page.locator("#input .calendar-day").count();

const select = await page.locator("#select .ui-select-field").first().evaluate((el) => {
  const button = el.querySelector("button");
  const icon = el.querySelector(".ui-select-icon");
  const menu = el.querySelector(".ui-select-menu, .ui-select-preview");
  const br = button.getBoundingClientRect();
  const ir = icon?.getBoundingClientRect();
  const bs = getComputedStyle(button);
  const ms = menu ? getComputedStyle(menu) : null;
  return {
    label: el.querySelector(".field-label")?.textContent?.trim(),
    value: button.textContent.trim(),
    button: { w: Math.round(br.width), h: Math.round(br.height), radius: bs.borderRadius },
    iconInside: ir ? ir.x >= br.x && ir.right <= br.right + 1 : false,
    menuBorder: ms?.borderTopWidth,
    options: [...el.querySelectorAll("[role=option], .ui-select-preview *")].map((n) => n.textContent.trim()).filter(Boolean).slice(0, 8),
  };
});

const footer = await page.locator("#footer footer").evaluate((el) => {
  const text = el.innerText;
  const label = el.querySelector("label");
  const input = el.querySelector("input");
  const lr = label?.getBoundingClientRect();
  const ir = input?.getBoundingClientRect();
  return {
    text: text.slice(0, 500),
    emailWithField: lr && ir ? lr.bottom <= ir.top + 2 && Math.abs(lr.x - ir.x) < 40 : false,
    radius: getComputedStyle(el).borderRadius,
  };
});

const account = await page.locator("#account-menu").evaluate((el) => ({
  paragraphs: el.querySelectorAll("p").length,
  links: [...el.querySelectorAll("a")].map((a) => a.textContent.trim()),
  signOut: el.querySelector("button")?.textContent.trim(),
  signOutW: Math.round(el.querySelector("button")?.getBoundingClientRect().width || 0),
  sectionW: Math.round(el.getBoundingClientRect().width),
}));

const map = await page.locator("#specimen-map .map-panel").evaluate((el) => ({
  html: el.innerHTML.slice(0, 200),
  imgs: el.querySelectorAll("img, iframe, canvas").length,
}));
const mapStatus = await page.request.get("http://127.0.0.1:3010/design/map");

const photos = await page.locator("#specimen-photos .photo-viewer").evaluate((el) => {
  const img = el.querySelector("img").getBoundingClientRect();
  const controls = [...el.querySelectorAll("button")].map((b) => {
    const r = b.getBoundingClientRect();
    return {
      label: b.getAttribute("aria-label"),
      w: Math.round(r.width),
      h: Math.round(r.height),
      onPhoto: r.top >= img.top - 1 && r.bottom <= img.bottom + 1,
      radius: getComputedStyle(b).borderRadius,
    };
  });
  return { controls, viewerH: Math.round(el.getBoundingClientRect().height), imgH: Math.round(img.height) };
});

console.log(JSON.stringify({ nights, dateRange, inputOpen, select, footer, account, map, mapStatus: mapStatus.status(), photos }, null, 2));
await browser.close();

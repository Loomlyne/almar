// Pictures for job 03.2-12 (Coming soon pages + Content rail), made BEFORE any app code, for the owner's signature.
// Static HTML drawn from tokens.json, lib/copy/dashboard.ts and the canvas boards DashContent / DashPosts / DashPackages
// (layout) and DashMediaNav (rail words). Run from the repo root:  node .planning/phases/03.2-real-catalog-and-team-inserted/pictures/03.2-12/build-pictures.mjs
// Output: <state>-<width>-<lang>.png next to this file. Re-shoot only what the owner changes: edit COPY below, then run with
// a filter, e.g.  ... build-pictures.mjs legal   (state name) or  ... build-pictures.mjs "" ar   (language).
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { DASHBOARD_COPY } from "../../../../../lib/copy/dashboard.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../../..");
const tokens = JSON.parse(readFileSync(join(root, "tokens.json"), "utf8"));
const C = tokens.color;
const work = process.env.P12_WORK ?? "/Users/koss/.almar-p12-work";
mkdirSync(work, { recursive: true });

const file = (p) => pathToFileURL(join(root, p)).href;
const LOGO = file("brand/Logo Typography/Stacked_Charcoal.svg");
const QUESTA = file("brand/Font/questa-webfont/2-Questa_Regular.woff");
const LATO = file("brand/Font/lato/Lato-Regular.ttf");
const LATO_B = file("brand/Font/lato/Lato-Bold.ttf");

// ---- words ---------------------------------------------------------------------------------------------------------
// CANVAS = verbatim from the boards (EN, AR, ES). DRAFT = new for this job, listed in the hand-over for review.
const WORDS = {
  en: {
    soon: "Soon", media: "Media", navLabel: "Navigation and footer",
    pages: {
      title: "Page editing is coming soon",
      line: "For now the public pages are edited outside the dashboard. Editing every page here arrives in a later phase.",
      list: ["Edit text and images on every page", "Reorder and switch sections on and off", "English, Arabic and Spanish for every field", "Search title and description per page", "Preview before publishing", "Add new pages"],
    },
    blog: {
      title: "The blog editor is coming soon",
      line: "Writing and publishing posts from the dashboard arrives in a later phase.",
      list: ["Rich text editor in three languages", "Cover image and alt text", "Destination tag and reading time", "Featured stay and experience cards", "Schedule or publish", "Search title and description"],
    },
    legal: {
      title: "Legal pages are coming soon",
      line: "For now the legal pages are edited outside the dashboard. Editing them here, with versions, arrives in a later phase.",
      list: [],
    },
    navigation: {
      title: "Navigation editing is coming soon",
      line: "Menus, footer links and contact details are edited outside the dashboard for now. Editing them here arrives in a later phase.",
      list: [],
    },
  },
  ar: {
    soon: "قريبًا", media: "الوسائط", navLabel: "التنقل والتذييل",
    pages: {
      title: "تحرير الصفحات قريبًا",
      line: "تُحرَّر الصفحات العامة حاليًا خارج لوحة التحكم. يصل تحرير كل صفحة هنا في مرحلة لاحقة.",
      list: ["تحرير النصوص والصور في كل صفحة", "إعادة ترتيب الأقسام وتشغيلها وإيقافها", "الإنجليزية والعربية والإسبانية لكل حقل", "عنوان ووصف البحث لكل صفحة", "المعاينة قبل النشر", "إضافة صفحات جديدة"],
    },
    blog: {
      title: "محرر المدونة قريبًا",
      line: "كتابة المقالات ونشرها من لوحة التحكم تصل في مرحلة لاحقة.",
      list: ["محرر نصوص غني بثلاث لغات", "صورة الغلاف والنص البديل", "وسم الوجهة ووقت القراءة", "بطاقات إقامة وتجربة مميزتين", "الجدولة أو النشر", "عنوان ووصف البحث"],
    },
    legal: {
      title: "الصفحات القانونية قريبًا",
      line: "تُحرَّر الصفحات القانونية حاليًا خارج لوحة التحكم. يصل تحريرها هنا، مع الإصدارات، في مرحلة لاحقة.",
      list: [],
    },
    navigation: {
      title: "تحرير التنقل قريبًا",
      line: "تُحرَّر القوائم وروابط التذييل وبيانات التواصل حاليًا خارج لوحة التحكم. يصل تحريرها هنا في مرحلة لاحقة.",
      list: [],
    },
  },
  es: {
    soon: "Pronto", media: "Medios", navLabel: "Navegación y pie",
    pages: {
      title: "La edición de páginas llega pronto",
      line: "Por ahora las páginas públicas se editan fuera del panel. Editar cada página aquí llega en una fase posterior.",
      list: ["Editar textos e imágenes de cada página", "Reordenar y activar o desactivar secciones", "Inglés, árabe y español en cada campo", "Título y descripción de búsqueda por página", "Vista previa antes de publicar", "Añadir páginas nuevas"],
    },
    blog: {
      title: "El editor del blog llega pronto",
      line: "Escribir y publicar entradas desde el panel llega en una fase posterior.",
      list: ["Editor de texto enriquecido en tres idiomas", "Imagen de portada y texto alternativo", "Etiqueta de destino y tiempo de lectura", "Tarjetas de estancia y experiencia destacadas", "Programar o publicar", "Título y descripción de búsqueda"],
    },
    legal: {
      title: "Las páginas legales llegan pronto",
      line: "Por ahora las páginas legales se editan fuera del panel. Editarlas aquí, con versiones, llega en una fase posterior.",
      list: [],
    },
    navigation: {
      title: "La edición de la navegación llega pronto",
      line: "Por ahora los menús, los enlaces del pie y los datos de contacto se editan fuera del panel. Editarlos aquí llega en una fase posterior.",
      list: [],
    },
  },
};

for (const [lang, w] of Object.entries(WORDS)) {
  for (const k of ["soon", "media", "navLabel"]) if (typeof w[k] !== "string" || !w[k]) throw new Error(`WORDS.${lang}.${k} is not a non-empty string`);
}
const STATES = ["pages", "blog", "legal", "navigation"];
const WIDTHS = [390, 834, 1440];
const LANGS = ["en", "ar", "es"];

// ---- drawing -------------------------------------------------------------------------------------------------------
const check = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${C.muted}" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const chev = (open) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${C.teal}" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" style="transform:rotate(${open ? -90 : 90}deg)"><path d="M9 5l7 7-7 7"/></svg>`;
const chipHtml = (w) => `<span class="chip">${w.soon}</span>`;
const menuGlyph = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;
const closeGlyph = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 5l14 14M19 5L5 19"/></svg>`;

function rail(lang, current, { catalogOpen }) {
  const w = WORDS[lang];
  const r = DASHBOARD_COPY[lang].rail;
  const link = (label, key, { nested = false, soon = false } = {}) =>
    `<div class="item${nested ? " nested" : ""}${current === key ? " current" : ""}"><span>${label}</span>${soon ? chipHtml(w) : ""}</div>`;
  const heading = (t) => `<p class="group-title">${t}</p>`;
  return `
    ${link(r.home, "home")}${link(r.bookings, "bookings")}${link(r.customers, "customers")}${link(r.calendar, "calendar")}
    <div class="item catalog${catalogOpen ? " open" : ""}"><span>${r.catalog}</span>${chev(catalogOpen)}</div>
    ${catalogOpen ? `<div class="sub">${link(r.destinations, "destinations", { nested: true })}${link(r.stays, "stays", { nested: true })}${link(r.experiences, "experiences", { nested: true })}${link(r.packages, "packages", { nested: true })}</div>` : ""}
    ${heading(r.content)}
    <div class="sub">
      ${link(r.pages, "pages", { nested: true, soon: true })}
      ${link(r.blog, "blog", { nested: true, soon: true })}
      ${link(r.team, "team", { nested: true })}
      ${link(r.legal, "legal", { nested: true, soon: true })}
      ${link(w.media, "media", { nested: true })}
      ${link(w.navLabel, "navigation", { nested: true, soon: true })}
    </div>
    ${link(r.settings, "settings")}${link(r.profile, "profile")}`;
}

function screen(lang, state, width) {
  const w = WORDS[lang];
  const r = DASHBOARD_COPY[lang].rail;
  const c = w[state];
  const sectionTitle = state === "navigation" ? w.navLabel : r[state];
  const wide = width >= 834;
  const list = c.list.length
    ? `<div class="list" style="grid-template-columns:repeat(${wide ? 2 : 1},minmax(0,1fr))">${c.list.map((t) => `<div class="li">${check}<span>${t}</span></div>`).join("")}</div>`
    : "";
  return `
    <div class="stack">
      <h1>${sectionTitle}</h1>
      <section class="card ${wide ? "card-wide" : "card-narrow"}">
        ${chipHtml(w)}
        <h2>${c.title}</h2>
        <p class="line">${c.line}</p>
        ${list}
      </section>
    </div>`;
}

function page({ lang, state, width, menu = false, catalogOpen = false }) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const d = DASHBOARD_COPY[lang];
  const desktop = width >= 1280;
  const header = `
    <header>
      <div class="brand"><img src="${LOGO}" alt="ALMAR">${desktop ? `<span class="dname">${d.dashboardName}</span>` : ""}</div>
      ${desktop ? "" : `<button class="menu" aria-label="${menu ? d.closeMenu : d.menu}">${menu ? closeGlyph : menuGlyph}</button>`}
    </header>`;
  const nav = `<nav class="${menu ? "drawer" : desktop ? "side" : "hidden"}">${rail(lang, state, { catalogOpen })}</nav>`;
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><style>
    @font-face{font-family:Questa;src:url("${QUESTA}")}
    @font-face{font-family:Lato;src:url("${LATO}");font-weight:400}
    @font-face{font-family:Lato;src:url("${LATO_B}");font-weight:700}
    *{box-sizing:border-box}
    html,body{margin:0}
    body{background:${C.ivory};color:${C.ink};font-family:Lato,Arial,sans-serif;font-size:16px;line-height:1.5}
    [dir=rtl] body{font-family:"Geeza Pro","Noto Sans Arabic",Lato,sans-serif;line-height:1.7}
    .shell{min-height:100vh;display:flex;flex-direction:column;width:${width}px}
    header{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:4px 16px;border-bottom:1px solid ${C.line};background:${C.ivory}}
    .brand{display:flex;align-items:center;gap:8px;min-height:44px}
    .brand img{display:block;width:140px;height:70px;object-fit:contain;object-position:${dir === "rtl" ? "right" : "left"}}
    .dname{font-family:Questa,Georgia,serif;font-size:14px;text-transform:uppercase;letter-spacing:.12em;color:${C.teal};white-space:nowrap}
    [dir=rtl] .dname{font-family:"Geeza Pro",serif;text-transform:none;letter-spacing:0}
    .menu{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:1px solid ${C.line};border-radius:0;background:${C.surface};color:${C.teal}}
    .body{display:flex;flex:1;align-items:stretch;min-width:0}
    nav{display:flex;flex-direction:column;padding:8px}
    nav.hidden{display:none}
    nav.side{width:240px;flex:none;background:${C.surface};border-inline-end:1px solid ${C.line}}
    nav.drawer{position:absolute;left:0;right:0;top:78px;bottom:0;background:${C.ivory};overflow:auto}
    .item{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:0 8px;font-size:14px;line-height:1.43;color:${C.ink}}
    [dir=rtl] .item{line-height:1.63}
    .item.nested{padding-inline-start:16px}
    .item.current{background:${C["teal-tint"]};color:${C.teal}}
    .item.catalog.open{color:${C.teal}}
    [dir=rtl] .item svg{transform:scaleX(-1)}
    .group-title{margin:0;display:flex;align-items:center;min-height:44px;padding:0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:${C.muted}}
    [dir=rtl] .group-title{text-transform:none;letter-spacing:0}
    .sub{display:flex;flex-direction:column;margin-inline-start:16px;border-inline-start:1px solid ${C.line}}
    .chip{display:inline-flex;align-items:center;height:24px;padding:0 8px;border:1px solid ${C.ink};background:${C.ivory};font-size:12px;color:${C.ink};white-space:nowrap}
    main{flex:1;min-width:0;padding:16px}
    .stack{display:flex;flex-direction:column;gap:24px;min-width:0}
    h1,h2{margin:0;font-family:Questa,Georgia,serif;font-weight:400;font-size:32px;line-height:1.2;color:${C.teal};text-wrap:balance}
    [dir=rtl] h1,[dir=rtl] h2{font-family:"Geeza Pro",serif;line-height:1.4}
    h2{font-size:32px}
    .card{display:flex;flex-direction:column;align-items:flex-start;gap:24px;border:1px solid ${C.line};background:${C.surface}}
    .card-wide{padding:48px}
    .card-narrow{padding:24px}
    .card-narrow h2{font-size:20px;line-height:1.3}
    [dir=rtl] .card-narrow h2{line-height:1.5}
    .line{margin:0;max-width:65ch;font-size:16px;color:${C.ink};text-wrap:pretty}
    .list{display:grid;gap:12px;align-self:stretch}
    .li{display:flex;align-items:center;gap:12px;min-height:44px;font-size:14px;color:${C.ink}}
    .li svg{flex:none}
    .frame{position:relative;width:${width}px}
  </style></head><body><div class="frame"><div class="shell">${header}<div class="body">${nav}<main>${screen(lang, state, width)}</main></div></div></div></body></html>`;
}

// ---- shoot ---------------------------------------------------------------------------------------------------------
const [stateFilter = "", langFilter = ""] = process.argv.slice(2);
const jobs = [];
for (const lang of LANGS) {
  if (langFilter && lang !== langFilter) continue;
  for (const state of STATES) {
    if (stateFilter && state !== stateFilter) continue;
    for (const width of WIDTHS) jobs.push({ name: `${state}-${width}-${lang}`, lang, state, width });
  }
  if (!stateFilter || stateFilter === "menu") jobs.push({ name: `menu-390-${lang}`, lang, state: "pages", width: 390, menu: true });
  if (!stateFilter || stateFilter === "rail") jobs.push({ name: `rail-catalog-open-1440-${lang}`, lang, state: "pages", width: 1440, catalogOpen: true });
}

const browser = await chromium.launch();
for (const job of jobs) {
  const html = join(work, `${job.name}.html`);
  writeFileSync(html, page(job));
  const ctx = await browser.newContext({ viewport: { width: job.width, height: job.menu ? 844 : 900 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  await tab.goto(pathToFileURL(html).href);
  await tab.evaluate(() => document.fonts.ready);
  // Gate: every label that is drawn must be a real, non-empty string (a label object once printed "[object Object]").
  const texts = await tab.evaluate(() =>
    [...document.querySelectorAll("nav .item, nav .group-title, nav .chip, h1, h2, .line, .li, .chip")].map((el) => (el.textContent ?? "").trim()),
  );
  const badText = texts.filter((t) => !t || t.includes("[object") || t.includes("undefined") || t.includes("NaN"));
  if (badText.length || texts.length < 10) {
    await browser.close();
    throw new Error(`${job.name}: bad or missing text (${texts.length} nodes): ${JSON.stringify(badText)}`);
  }
  await tab.screenshot({ path: join(here, `${job.name}.png`), fullPage: !job.menu });
  await ctx.close();
}
await browser.close();
console.log(`${jobs.length} pictures`);

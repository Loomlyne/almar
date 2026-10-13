// Pictures for job 03.2-15 (stay panel: Rates, Availability, Access tabs), made BEFORE any app code, for the owner's
// signature. Static HTML drawn from tokens.json, lib/copy/dashboard.ts (rail), lib/copy/ops-kit.ts (Close, Save, Cancel,
// Delete, Published, Unpublish) and the canvas board DashStays (Availability words, weekdays, stay panel tabs).
// Run from the repo root:  node .planning/phases/03.2-real-catalog-and-team-inserted/pictures/03.2-15/build-pictures.mjs
// Output: <state>-<width>-<lang>.png next to this file. Re-shoot only what the owner changes: edit WORDS below, then run
// with a filter, e.g.  ... build-pictures.mjs rates-overlap   (state)  or  ... build-pictures.mjs "" ar   (language).
//
// No money value is drawn anywhere: every price is the bracket "[PRICE]". Reasons, stay name and access values are
// brackets too. Only dates and night counts (which follow from the dates) are example values.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { DASHBOARD_COPY } from "../../../../../lib/copy/dashboard.ts";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../../..");
const tokens = JSON.parse(readFileSync(join(root, "tokens.json"), "utf8"));
const C = tokens.color;
const work = process.env.P15_WORK ?? "/Users/koss/.almar-p15-work";
mkdirSync(work, { recursive: true });

const file = (p) => pathToFileURL(join(root, p)).href;
const LOGO = file("brand/Logo Typography/Stacked_Charcoal.svg");
const QUESTA = file("brand/Font/questa-webfont/2-Questa_Regular.woff");
const LATO = file("brand/Font/lato/Lato-Regular.ttf");
const LATO_B = file("brand/Font/lato/Lato-Bold.ttf");

// ---- words ---------------------------------------------------------------------------------------------------------
// CANVAS = verbatim from DashStays (EN, AR, ES). PLAN = the sentence fixed in 03.2-15-PLAN (EN), AR/ES drafted here.
// DRAFT = new for this job, listed in the report for the owner's review. Nothing here is a price.
const WORDS = {
  en: {
    stays: "Stays", newStay: "New stay", stayName: "[Stay name]", // CANVAS, CANVAS, bracket
    tabDetails: "Details", tabConnections: "Experiences and services", tabAvailability: "Availability", // CANVAS
    tabRates: "Rates", tabAccess: "Access", // DRAFT
    // Rates
    baseLabel: "Price per night (AED)", // CANVAS "Price per night" + unit
    baseHint: "Guests pay this for every night that no date range covers.", // DRAFT
    savePrice: "Save price", // DRAFT
    noRate: "No nightly rate yet: guests cannot book this stay.", // PLAN
    rangesTitle: "Date ranges", // DRAFT
    rule: "The shortest range covering a night sets its price. Two ranges of the same length cannot share a night.", // PLAN
    colFirst: "First night", colLast: "Last night", colNights: "Nights", colRate: "AED per night", // DRAFT
    addRange: "Add range", edit: "Edit", saveRange: "Save range", // DRAFT
    noRanges: "No date ranges yet. Every night uses the price per night.", // DRAFT
    overlap: "Another range of the same length already covers these nights.", // PLAN
    checkTitle: "Check prices", // PLAN
    checkLine: "Choose nights to see the price of each one and where it comes from. Up to 366 nights.", // DRAFT
    check: "Check", colNight: "Night", colFrom: "Price from", // DRAFT
    srcRange: "Range", srcBase: "Base", srcNone: "No rate", // DRAFT
    // Availability
    availLine: "Blocked and booked dates for this stay. Blocks are set in the Calendar.", // CANVAS
    blocked: "Blocked", blockLink: "Block dates for this stay", // CANVAS
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], // CANVAS
    reasonsTitle: "Blocked days this month", // DRAFT
    scopeStay: "This stay", scopeDestination: "Whole destination", scopeAll: "Everything", // DRAFT
    reason: "[Reason]", noReason: "No reason given", // bracket, DRAFT
    prevMonth: "Previous month", nextMonth: "Next month", // DRAFT (aria only)
    // Access
    accessLine: "The guest sees this only after you confirm the booking.", // PLAN
    privateLine: "Only you can see it here. It is never on the public site.", // DRAFT
    address: "Address", wifiName: "Wi-Fi name", wifiPassword: "Wi-Fi password", doorCode: "Door code", notes: "Notes", // DRAFT
    notesHint: "Parking, keys, anything the guest needs on arrival. Up to 2,000 characters.", // DRAFT
    show: "Show", hide: "Hide", // DRAFT (aria of the eye)
    vAddress: "[Address]", vWifi: "[Wi-Fi name]", vNotes: "[Notes]", // brackets
  },
  ar: {
    stays: "الإقامات", newStay: "إقامة جديدة", stayName: "[اسم الإقامة]",
    tabDetails: "التفاصيل", tabConnections: "التجارب والخدمات", tabAvailability: "التوافر",
    tabRates: "الأسعار", tabAccess: "معلومات الوصول",
    baseLabel: "السعر لكل ليلة (درهم)",
    baseHint: "يدفع الضيوف هذا السعر عن كل ليلة لا يغطيها أي نطاق تواريخ.",
    savePrice: "حفظ السعر",
    noRate: "لا يوجد سعر لليلة بعد: لا يمكن للضيوف حجز هذه الإقامة.",
    rangesTitle: "نطاقات التواريخ",
    rule: "أقصر نطاق يغطي الليلة هو الذي يحدد سعرها. لا يمكن لنطاقين بالطول نفسه أن يشتركا في ليلة.",
    colFirst: "الليلة الأولى", colLast: "الليلة الأخيرة", colNights: "الليالي", colRate: "درهم لكل ليلة",
    addRange: "إضافة نطاق", edit: "تعديل", saveRange: "حفظ النطاق",
    noRanges: "لا توجد نطاقات تواريخ بعد. كل ليلة تستخدم السعر لكل ليلة.",
    overlap: "يغطي نطاق آخر بالطول نفسه هذه الليالي بالفعل.",
    checkTitle: "التحقق من الأسعار",
    checkLine: "اختر الليالي لترى سعر كل ليلة ومن أين يأتي. حتى 366 ليلة.",
    check: "تحقق", colNight: "الليلة", colFrom: "مصدر السعر",
    srcRange: "نطاق", srcBase: "السعر الأساسي", srcNone: "بلا سعر",
    availLine: "التواريخ المحجوبة والمحجوزة لهذه الإقامة. تُضبط الحجوزات المحجوبة من التقويم.",
    blocked: "محجوب", blockLink: "حجب تواريخ لهذه الإقامة",
    weekdays: ["إث", "ث", "أر", "خ", "ج", "س", "أح"],
    reasonsTitle: "الأيام المحجوبة هذا الشهر",
    scopeStay: "هذه الإقامة", scopeDestination: "الوجهة كلها", scopeAll: "كل شيء",
    reason: "[السبب]", noReason: "بدون سبب",
    prevMonth: "الشهر السابق", nextMonth: "الشهر التالي",
    accessLine: "لا يرى الضيف هذه المعلومات إلا بعد أن تؤكد الحجز.",
    privateLine: "لا يراها هنا أحد غيرك، ولا تظهر أبدًا على الموقع العام.",
    address: "العنوان", wifiName: "اسم شبكة Wi-Fi", wifiPassword: "كلمة مرور Wi-Fi", doorCode: "رمز الباب", notes: "ملاحظات",
    notesHint: "الموقف، المفاتيح، وكل ما يحتاجه الضيف عند الوصول. حتى 2,000 حرف.",
    show: "إظهار", hide: "إخفاء",
    vAddress: "[العنوان]", vWifi: "[اسم الشبكة]", vNotes: "[ملاحظات]",
  },
  es: {
    stays: "Estancias", newStay: "Nueva estancia", stayName: "[Nombre de la estancia]",
    tabDetails: "Detalles", tabConnections: "Experiencias y servicios", tabAvailability: "Disponibilidad",
    tabRates: "Tarifas", tabAccess: "Acceso",
    baseLabel: "Precio por noche (AED)",
    baseHint: "Los huéspedes pagan esto por cada noche que ningún rango de fechas cubre.",
    savePrice: "Guardar precio",
    noRate: "Todavía no hay precio por noche: los huéspedes no pueden reservar esta estancia.",
    rangesTitle: "Rangos de fechas",
    rule: "El rango más corto que cubre una noche fija su precio. Dos rangos de la misma duración no pueden compartir una noche.",
    colFirst: "Primera noche", colLast: "Última noche", colNights: "Noches", colRate: "AED por noche",
    addRange: "Añadir rango", edit: "Editar", saveRange: "Guardar rango",
    noRanges: "Todavía no hay rangos de fechas. Cada noche usa el precio por noche.",
    overlap: "Otro rango de la misma duración ya cubre estas noches.",
    checkTitle: "Comprobar precios",
    checkLine: "Elige noches para ver el precio de cada una y de dónde viene. Hasta 366 noches.",
    check: "Comprobar", colNight: "Noche", colFrom: "Precio de",
    srcRange: "Rango", srcBase: "Base", srcNone: "Sin precio",
    availLine: "Fechas bloqueadas y reservadas de esta estancia. Los bloqueos se definen en el Calendario.",
    blocked: "Bloqueado", blockLink: "Bloquear fechas de esta estancia",
    weekdays: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"],
    reasonsTitle: "Días bloqueados este mes",
    scopeStay: "Esta estancia", scopeDestination: "Todo el destino", scopeAll: "Todo",
    reason: "[Motivo]", noReason: "Sin motivo",
    prevMonth: "Mes anterior", nextMonth: "Mes siguiente",
    accessLine: "El huésped solo ve esto después de que confirmes la reserva.",
    privateLine: "Solo tú lo ves aquí. Nunca aparece en el sitio público.",
    address: "Dirección", wifiName: "Nombre del Wi-Fi", wifiPassword: "Contraseña del Wi-Fi", doorCode: "Código de la puerta", notes: "Notas",
    notesHint: "Aparcamiento, llaves, todo lo que el huésped necesita al llegar. Hasta 2.000 caracteres.",
    show: "Mostrar", hide: "Ocultar",
    vAddress: "[Dirección]", vWifi: "[Nombre de la red]", vNotes: "[Notas]",
  },
};

// Gate 1: every word is a non-empty string (arrays: every item), and the three languages have the same keys.
const enKeys = Object.keys(WORDS.en).sort().join();
for (const [lang, w] of Object.entries(WORDS)) {
  if (Object.keys(w).sort().join() !== enKeys) throw new Error(`WORDS.${lang} keys differ from en`);
  for (const [k, v] of Object.entries(w)) {
    const items = Array.isArray(v) ? v : [v];
    if (!items.length || items.some((s) => typeof s !== "string" || !s.trim())) throw new Error(`WORDS.${lang}.${k} is not a non-empty string`);
  }
}
// Gate 2: no digit inside any price slot; the only price drawn is the bracket.
const PRICE = "[PRICE]";

const STATES = ["rates", "rates-empty", "rates-overlap", "rates-check", "availability", "access"];
const WIDTHS = [390, 834, 1440];
const LANGS = ["en", "ar", "es"];

// ---- example dates (no money) ---------------------------------------------------------------------------------------
const RANGES = [
  { id: "r1", first: "20/12/2026", last: "05/01/2027", nights: 17 },
  { id: "r2", first: "24/12/2026", last: "26/12/2026", nights: 3 },
  { id: "r3", first: "31/12/2026", last: "31/12/2026", nights: 1 },
];
// Check prices for 18/12/2026 to 24/12/2026: 18, 19 base; 20 to 23 the 17-night range; 24 the 3-night range.
const CHECK = [
  ["18/12/2026", "base"], ["19/12/2026", "base"], ["20/12/2026", "range"], ["21/12/2026", "range"],
  ["22/12/2026", "range"], ["23/12/2026", "range"], ["24/12/2026", "range"],
];
// December 2026 starts on a Tuesday. Blocks: 10-11 everything, 24-26 this stay, 31 the destination.
const MONTH_TITLE = { en: "December 2026", ar: "ديسمبر 2026", es: "diciembre de 2026" };
const BLOCKS = [
  { from: 10, to: 11, scope: "scopeAll", reason: false, label: "10/12/2026 – 11/12/2026" },
  { from: 24, to: 26, scope: "scopeStay", reason: true, label: "24/12/2026 – 26/12/2026" },
  { from: 31, to: 31, scope: "scopeDestination", reason: true, label: "31/12/2026" },
];

// ---- drawing -------------------------------------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eye = (masked) => `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M1.75 10S4.5 4.75 10 4.75 18.25 10 18.25 10 15.5 15.25 10 15.25 1.75 10 1.75 10Z" stroke="currentColor" stroke-width="1.5"/><rect x="7.75" y="7.75" width="4.5" height="4.5" stroke="currentColor" stroke-width="1.5"/>${masked ? `<path d="M4 16 16 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` : ""}</svg>`;
const chev = (deg) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" aria-hidden="true" style="transform:rotate(${deg}deg)"><path d="M9 5l7 7-7 7"/></svg>`;
const calIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/></svg>`;
const menuGlyph = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

const btn = (label, variant = "primary", extra = "") => `<span class="btn ${variant}" ${extra}>${esc(label)}</span>`;
const field = ({ label, value, hint = "", error = "", password = false, shown = false, w, area = false, icon = false }) => `
  <div class="field">
    <span class="flabel">${esc(label)}</span>
    <div class="control${error ? " invalid" : ""}${area ? " area" : ""}">
      ${icon ? `<span class="icon">${calIcon}</span>` : ""}
      <span class="value${password && !shown ? " dots" : ""}${value ? "" : " empty"}">${password && !shown ? "••••••••" : esc(value)}</span>
      ${password ? `<span class="eye" aria-label="${esc(shown ? w.hide : w.show)}">${eye(!shown)}</span>` : ""}
    </div>
    ${error ? `<p class="ferror">${esc(error)}</p>` : hint ? `<p class="fhint">${esc(hint)}</p>` : ""}
  </div>`;

function rangesBlock(w, k, { wide, overlap }) {
  const rows = RANGES.map((r) => ({ ...r, clash: overlap && r.id === "r2" }));
  const actions = `<span class="links">${btn(w.edit, "ghost")}${btn(k.delete, "ghost")}</span>`;
  const table = wide
    ? `<table><thead><tr><th>${esc(w.colFirst)}</th><th>${esc(w.colLast)}</th><th>${esc(w.colNights)}</th><th>${esc(w.colRate)}</th><th></th></tr></thead><tbody>
        ${rows
          .map(
            (r) => `<tr class="${r.clash ? "clash" : ""}"><td>${r.first}</td><td>${r.last}</td><td class="num">${r.nights}</td><td>${PRICE}</td><td>${actions}</td></tr>
            ${r.clash ? `<tr class="clash-msg"><td colspan="5"><p class="ferror">${esc(w.overlap)}</p></td></tr>` : ""}`,
          )
          .join("")}</tbody></table>`
    : `<ul class="cards">${rows
        .map(
          (r) => `<li class="${r.clash ? "clash" : ""}">
            <dl>
              <div><dt>${esc(w.colFirst)}</dt><dd>${r.first}</dd></div>
              <div><dt>${esc(w.colLast)}</dt><dd>${r.last}</dd></div>
              <div><dt>${esc(w.colNights)}</dt><dd>${r.nights}</dd></div>
              <div><dt>${esc(w.colRate)}</dt><dd>${PRICE}</dd></div>
            </dl>
            ${r.clash ? `<p class="ferror">${esc(w.overlap)}</p>` : ""}
            ${actions}
          </li>`,
        )
        .join("")}</ul>`;
  return table;
}

function ratesTab(lang, state, wide) {
  const w = WORDS[lang];
  const k = OPS_KIT_COPY[lang];
  const empty = state === "rates-empty";
  const overlap = state === "rates-overlap";
  const checking = state === "rates-check";
  const base = `
    <section class="group">
      ${field({ label: w.baseLabel, value: empty ? "" : PRICE, hint: empty ? "" : w.baseHint, w })}
      ${empty ? `<p class="warn">${esc(w.noRate)}</p>` : ""}
      <div class="row-actions">${btn(w.savePrice, empty ? "primary disabled" : "secondary")}</div>
    </section>`;
  const form = overlap
    ? `<div class="form">
        <p class="ftitle">${esc(w.addRange)}</p>
        <div class="pair">
          ${field({ label: w.colFirst, value: "25/12/2026", icon: true, w })}
          ${field({ label: w.colLast, value: "27/12/2026", icon: true, w })}
        </div>
        ${field({ label: w.baseLabel, value: PRICE, w })}
        <div class="row-actions">${btn(w.saveRange)}${btn(k.cancel, "secondary")}</div>
      </div>`
    : "";
  const ranges = `
    <section class="group">
      <h3>${esc(w.rangesTitle)}</h3>
      <p class="rule">${esc(w.rule)}</p>
      ${empty ? `<p class="muted">${esc(w.noRanges)}</p>` : rangesBlock(w, k, { wide, overlap })}
      ${form}
      ${overlap ? "" : `<div class="row-actions">${btn(w.addRange, "secondary")}</div>`}
    </section>`;
  const checkRows = checking
    ? wide
      ? `<table><thead><tr><th>${esc(w.colNight)}</th><th>${esc(w.colFrom)}</th><th>AED</th></tr></thead><tbody>${CHECK.map(
          ([d, s]) => `<tr><td>${d}</td><td>${esc(s === "range" ? w.srcRange : w.srcBase)}</td><td>${PRICE}</td></tr>`,
        ).join("")}</tbody></table>`
      : `<ul class="nights">${CHECK.map(
          ([d, s]) => `<li><span>${d}</span><span class="src">${esc(s === "range" ? w.srcRange : w.srcBase)}</span><span>${PRICE}</span></li>`,
        ).join("")}</ul>`
    : "";
  const check = `
    <section class="group">
      <h3>${esc(w.checkTitle)}</h3>
      <p class="muted">${esc(w.checkLine)}</p>
      <div class="pair">
        ${field({ label: w.colFirst, value: checking ? "18/12/2026" : "", icon: true, w })}
        ${field({ label: w.colLast, value: checking ? "24/12/2026" : "", icon: true, w })}
      </div>
      <div class="row-actions">${btn(w.check, empty ? "secondary disabled" : "secondary")}</div>
      ${checkRows}
    </section>`;
  return base + ranges + check;
}

function availabilityTab(lang) {
  const w = WORDS[lang];
  const blockedDays = new Set();
  for (const b of BLOCKS) for (let d = b.from; d <= b.to; d++) blockedDays.add(d);
  const lead = 1; // 1 Dec 2026 is a Tuesday: one empty Monday cell.
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(`<span class="day out"></span>`);
  for (let d = 1; d <= 31; d++) cells.push(`<span class="day${blockedDays.has(d) ? " blocked" : ""}">${d}</span>`);
  while (cells.length % 7) cells.push(`<span class="day out"></span>`);
  const reasons = BLOCKS.map(
    (b) => `<li><span class="sw"></span><span class="rtext"><span class="when">${b.label}</span><span>${esc(w[b.scope])} · ${esc(b.reason ? w.reason : w.noReason)}</span></span></li>`,
  ).join("");
  return `
    <p class="muted">${esc(w.availLine)}</p>
    <div class="month">
      <div class="mhead"><span class="mnav" aria-label="${esc(w.prevMonth)}">${chev(lang === "ar" ? 0 : 180)}</span><span class="mtitle">${esc(MONTH_TITLE[lang])}</span><span class="mnav" aria-label="${esc(w.nextMonth)}">${chev(lang === "ar" ? 180 : 0)}</span></div>
      <div class="grid">${w.weekdays.map((d) => `<span class="wd">${esc(d)}</span>`).join("")}${cells.join("")}</div>
      <div class="legend"><span class="sw"></span><span>${esc(w.blocked)}</span></div>
    </div>
    <section class="group">
      <h3>${esc(w.reasonsTitle)}</h3>
      <ul class="reasons">${reasons}</ul>
    </section>
    <div class="row-actions">${btn(w.blockLink, "secondary")}</div>`;
}

function accessTab(lang) {
  const w = WORDS[lang];
  const k = OPS_KIT_COPY[lang];
  return `
    <p class="lead">${esc(w.accessLine)}</p>
    <p class="muted">${esc(w.privateLine)}</p>
    ${field({ label: w.address, value: w.vAddress, area: true, w })}
    ${field({ label: w.wifiName, value: w.vWifi, w })}
    ${field({ label: w.wifiPassword, value: "", password: true, w })}
    ${field({ label: w.doorCode, value: "", password: true, w })}
    ${field({ label: w.notes, value: w.vNotes, hint: w.notesHint, area: true, w })}
    <div class="row-actions">${btn(k.save)}</div>`;
}

function panel(lang, state, width) {
  const w = WORDS[lang];
  const k = OPS_KIT_COPY[lang];
  const wide = width >= 834;
  const tabKey = state.startsWith("rates") ? "rates" : state;
  const tabs = [
    ["details", w.tabDetails], ["connections", w.tabConnections], ["rates", w.tabRates],
    ["availability", w.tabAvailability], ["access", w.tabAccess],
  ];
  const body = tabKey === "rates" ? ratesTab(lang, state, wide) : tabKey === "availability" ? availabilityTab(lang) : accessTab(lang);
  return `
    <aside class="panel ${wide ? "docked" : "sheet"}">
      <div class="phead"><h2>${esc(w.stayName)}</h2><span class="close">${esc(k.close)}</span></div>
      <div class="pbody">
        <div class="tabs" role="tablist">${tabs.map(([key, label]) => `<span class="tab${key === tabKey ? " on" : ""}">${esc(label)}</span>`).join("")}</div>
        <div class="tabbody">${body}</div>
      </div>
      <div class="pfoot"><span class="chip">${esc(k.published)}</span>${btn(k.unpublish, "secondary")}</div>
    </aside>`;
}

function rail(lang) {
  const r = DASHBOARD_COPY[lang].rail;
  const link = (label, cur = false, nested = false) => `<div class="item${nested ? " nested" : ""}${cur ? " current" : ""}"><span>${esc(label)}</span></div>`;
  return `${link(r.home)}${link(r.bookings)}${link(r.customers)}${link(r.calendar)}
    <div class="item open"><span>${esc(r.catalog)}</span>${chev(lang === "ar" ? 90 : -90)}</div>
    <div class="sub">${link(r.destinations, false, true)}${link(r.stays, true, true)}${link(r.experiences, false, true)}${link(r.packages, false, true)}</div>
    <p class="group-title">${esc(r.content)}</p>
    <div class="sub">${link(r.pages, false, true)}${link(r.blog, false, true)}${link(r.team, false, true)}${link(r.legal, false, true)}</div>
    ${link(r.settings)}${link(r.profile)}`;
}

function page({ lang, state, width }) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const d = DASHBOARD_COPY[lang];
  const w = WORDS[lang];
  const k = OPS_KIT_COPY[lang];
  const desktop = width >= 1280;
  const wide = width >= 834;
  const header = `<header><div class="brand"><img src="${LOGO}" alt="ALMAR">${desktop ? `<span class="dname">${esc(d.dashboardName)}</span>` : ""}</div>${desktop ? "" : `<span class="menu">${menuGlyph}</span>`}</header>`;
  const list = `<div class="stack"><div class="titlerow"><h1>${esc(w.stays)}</h1>${btn(w.newStay)}</div>
    <div class="list">${[1, 2, 3, 4].map(() => `<div class="lrow"><span>${esc(w.stayName)}</span><span class="chip">${esc(k.published)}</span></div>`).join("")}</div></div>`;
  const shell = wide
    ? `<div class="shell">${header}<div class="body">${desktop ? `<nav class="side">${rail(lang)}</nav>` : ""}<main>${list}</main></div></div><div class="scrim"></div>`
    : "";
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><style>
    @font-face{font-family:Questa;src:url("${QUESTA}")}
    @font-face{font-family:Lato;src:url("${LATO}");font-weight:400}
    @font-face{font-family:Lato;src:url("${LATO_B}");font-weight:700}
    *{box-sizing:border-box}
    html,body{margin:0}
    body{background:${C.ivory};color:${C.ink};font-family:Lato,Arial,sans-serif;font-size:16px;line-height:1.5}
    [dir=rtl] body{font-family:"Geeza Pro","Noto Sans Arabic",Lato,sans-serif;line-height:1.7}
    .frame{position:relative;width:${width}px;min-height:${wide ? 900 : 844}px}
    .shell{min-height:900px;display:flex;flex-direction:column}
    header{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:4px 16px;border-bottom:1px solid ${C.line}}
    .brand{display:flex;align-items:center;gap:8px}
    .brand img{display:block;width:140px;height:70px;object-fit:contain;object-position:${dir === "rtl" ? "right" : "left"}}
    .dname{font-family:Questa,Georgia,serif;font-size:14px;text-transform:uppercase;letter-spacing:.12em;color:${C.teal}}
    [dir=rtl] .dname{font-family:"Geeza Pro",serif;text-transform:none;letter-spacing:0}
    .menu{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid ${C.line};background:${C.surface};color:${C.teal}}
    .body{display:flex;flex:1}
    nav.side{width:240px;flex:none;background:${C.surface};border-inline-end:1px solid ${C.line};padding:8px;display:flex;flex-direction:column}
    .item{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:0 8px;font-size:14px}
    .item.nested{padding-inline-start:16px}
    .item.current{background:${C["teal-tint"]};color:${C.teal}}
    .item.open{color:${C.teal}}
    .group-title{margin:0;display:flex;align-items:center;min-height:44px;padding:0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:${C.muted}}
    [dir=rtl] .group-title{text-transform:none;letter-spacing:0}
    .sub{display:flex;flex-direction:column;margin-inline-start:16px;border-inline-start:1px solid ${C.line}}
    main{flex:1;min-width:0;padding:16px}
    .stack{display:flex;flex-direction:column;gap:24px}
    .titlerow{display:flex;align-items:center;justify-content:space-between;gap:16px}
    h1,h2{margin:0;font-family:Questa,Georgia,serif;font-weight:400;color:${C.teal}}
    h1{font-size:32px;line-height:1.2}
    h2{font-size:20px;line-height:1.3}
    [dir=rtl] h1,[dir=rtl] h2,[dir=rtl] h3{font-family:"Geeza Pro",serif;line-height:1.5}
    h3{margin:0;font-family:Questa,Georgia,serif;font-weight:400;font-size:20px;line-height:1.3;color:${C.teal}}
    .list{display:flex;flex-direction:column;border-top:1px solid ${C.line}}
    .lrow{display:flex;align-items:center;justify-content:space-between;min-height:44px;padding:0 8px;border-bottom:1px solid ${C.line};font-size:14px}
    .chip{display:inline-flex;align-items:center;height:24px;padding:0 8px;border:1px solid ${C.ink};background:${C.ivory};font-size:12px;white-space:nowrap}
    .scrim{position:absolute;inset:0;background:rgb(38 38 38 / .4)}
    .btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border:1px solid transparent;font-size:14px;text-transform:uppercase;letter-spacing:.12em;white-space:nowrap}
    [dir=rtl] .btn{text-transform:none;letter-spacing:0}
    .btn.primary{background:${C.teal};color:${C.ivory};border-color:${C.teal}}
    .btn.secondary{background:transparent;color:${C.teal};border-color:${C.teal}}
    .btn.ghost{color:${C.teal};text-transform:none;letter-spacing:0;padding:0 8px;min-height:44px}
    .btn.disabled{opacity:.45}
    /* panel */
    .panel{background:${C.surface};display:flex;flex-direction:column}
    .panel.docked{position:absolute;top:0;bottom:0;inset-inline-end:0;width:480px;box-shadow:${tokens.shadow.lg}}
    .panel.sheet{position:relative;width:${width}px;min-height:844px}
    .phead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:16px;min-height:60px}
    .panel.sheet .phead{border-bottom:1px solid ${C.line}}
    .close{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 8px;border:1px solid ${C.line};font-size:14px}
    .pbody{display:flex;flex-direction:column;gap:16px;padding:0 16px 16px;flex:1;min-width:0}
    .panel.sheet .pbody{padding-top:16px}
    .tabs{display:flex;flex-wrap:wrap;border-bottom:1px solid ${C.line}}
    .tab{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;font-size:14px}
    .tab.on{color:${C.teal};box-shadow:inset 0 -3px 0 ${C.teal}}
    .tabbody{display:flex;flex-direction:column;gap:16px;min-width:0}
    .pfoot{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid ${C.line};padding:16px;background:${C.surface}}
    .group{display:flex;flex-direction:column;gap:12px;padding-bottom:16px;border-bottom:1px solid ${C.line}}
    .group:last-child{border-bottom:0}
    .field{display:grid;gap:8px;max-width:384px;min-width:0}
    .flabel{font-size:14px}
    .control{position:relative;display:flex;align-items:center;gap:8px;min-height:44px;border:1px solid ${C.ink};background:${C.surface};padding:8px 16px;font-size:${wide ? 14 : 16}px}
    .control.area{min-height:96px;align-items:flex-start}
    .control.invalid{border-color:${C.error}}
    .control .icon{display:inline-flex;color:${C.ink}}
    .value.empty{color:${C.muted}}
    .value.dots{letter-spacing:.2em}
    .eye{position:absolute;inset-inline-end:4px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:44px;height:44px;color:${C.ink}}
    .fhint,.ferror,.muted,.rule,.lead,.warn{margin:0;font-size:14px;max-width:65ch}
    .fhint,.muted{color:${C.muted}}
    .ferror{color:${C.error}}
    .warn{color:${C.warning};border-inline-start:3px solid ${C.warning};padding-inline-start:12px}
    .rule{color:${C.ink}}
    .lead{font-size:16px;color:${C.ink}}
    .row-actions{display:flex;flex-wrap:wrap;gap:8px}
    .form{display:flex;flex-direction:column;gap:12px;border:1px solid ${C.ink};padding:16px}
    .ftitle{margin:0;font-size:14px;font-weight:700}
    .pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    table{width:100%;border-collapse:collapse;font-size:14px}
    th{height:44px;padding:0 6px;text-align:start;font-size:12px;font-weight:400;text-transform:uppercase;letter-spacing:.12em;color:${C.muted};border-bottom:1px solid ${C.line}}
    [dir=rtl] th{text-transform:none;letter-spacing:0}
    td{height:44px;padding:0 6px;border-bottom:1px solid ${C.line};white-space:nowrap}
    td.num{text-align:center}
    tr.clash td{box-shadow:inset 0 -3px 0 ${C.error}}
    tr.clash-msg td{height:auto;padding:8px 6px;white-space:normal;border-bottom:1px solid ${C.line}}
    .links{display:inline-flex}
    .links .btn{padding:0 4px}
    ul.cards,ul.nights,ul.reasons{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
    ul.cards li{display:flex;flex-direction:column;gap:8px;border:1px solid ${C.line};padding:16px}
    ul.cards li.clash{border-color:${C.error}}
    dl{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:8px}
    dt{font-size:12px;color:${C.muted}}
    dd{margin:0;font-size:14px}
    ul.nights li{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;min-height:44px;border-bottom:1px solid ${C.line};font-size:14px}
    .month{display:flex;flex-direction:column;gap:8px;border:1px solid ${C.line};padding:12px}
    .mhead{display:flex;align-items:center;justify-content:space-between}
    .mnav{display:grid;place-items:center;width:44px;height:44px;border:1px solid ${C.line};color:${C.teal}}
    .mtitle{font-family:Questa,Georgia,serif;font-size:20px;color:${C.teal}}
    [dir=rtl] .mtitle{font-family:"Geeza Pro",serif}
    .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
    .wd{text-align:center;font-size:12px;color:${C.muted};padding:4px 0}
    .day{display:grid;place-items:center;height:${wide ? 52 : 44}px;font-size:14px;border:1px solid transparent}
    .day.out{visibility:hidden}
    .day.blocked{background:repeating-linear-gradient(135deg,${C.line} 0 2px,transparent 2px 7px);border-color:${C.ink};color:${C.ink}}
    .legend{display:flex;align-items:center;gap:8px;font-size:12px}
    .sw{display:inline-block;flex:none;width:16px;height:16px;border:1px solid ${C.ink};background:repeating-linear-gradient(135deg,${C.line} 0 2px,transparent 2px 7px)}
    ul.reasons li{display:flex;align-items:flex-start;gap:12px;font-size:14px;padding:4px 0}
    ul.reasons li .sw{margin-top:4px}
    .rtext{display:flex;flex-direction:column}
    .when{font-weight:700}
  </style></head><body><div class="frame">${shell}${panel(lang, state, width)}</div></body></html>`;
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
}

const browser = await chromium.launch();
for (const job of jobs) {
  const html = join(work, `${job.name}.html`);
  writeFileSync(html, page(job));
  const ctx = await browser.newContext({ viewport: { width: job.width, height: job.width >= 834 ? 900 : 844 }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  await tab.goto(pathToFileURL(html).href);
  await tab.evaluate(() => document.fonts.ready);
  // Let the frame grow to the docked panel's content so a full-page shot shows all of it.
  await tab.evaluate(() => {
    const p = document.querySelector(".panel.docked");
    const f = document.querySelector(".frame");
    if (p && f) f.style.minHeight = `${Math.max(f.scrollHeight, p.scrollHeight)}px`;
  });
  // Gate 3: every drawn label is a real, non-empty string (a label object once printed "[object Object]"), and no
  // price slot holds a digit.
  const report = await tab.evaluate(() => {
    const sel = ".ftitle, .tab, h1, h2, h3, .flabel, .fhint, .ferror, .muted, .rule, .lead, .warn, .btn, .chip, th, dt, .wd, .mtitle, .legend span:last-child, .rtext span, .close, ul.nights li span, td";
    const texts = [...document.querySelectorAll(sel)].map((el) => (el.textContent ?? "").trim());
    const all = document.body.innerText;
    const panel = document.querySelector(".panel");
    return { texts, all, panelOverflow: panel.scrollWidth > panel.clientWidth + 1 };
  });
  const bad = report.texts.filter((t) => t.includes("[object") || t.includes("undefined") || t.includes("NaN"));
  const emptyLabels = await tab.evaluate(() =>
    [...document.querySelectorAll(".tab, h1, h2, h3, .flabel, .btn, .chip, .close, .wd")].filter((el) => !(el.textContent ?? "").trim()).length,
  );
  const priceDigits = /AED[ \u00a0]*\d|\d[ \u00a0]*AED|درهم[ \u00a0]*\d/.test(report.all);
  if (bad.length || emptyLabels || report.texts.length < 15 || priceDigits || report.panelOverflow) {
    await browser.close();
    throw new Error(
      `${job.name}: bad=${JSON.stringify(bad)} empty=${emptyLabels} nodes=${report.texts.length} priceDigits=${priceDigits} panelOverflow=${report.panelOverflow}`,
    );
  }
  await tab.screenshot({ path: join(here, `${job.name}.png`), fullPage: true });
  await ctx.close();
}
await browser.close();
console.log(`${jobs.length} pictures`);

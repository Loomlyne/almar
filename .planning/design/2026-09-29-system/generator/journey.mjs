import { C, LOGO, icon, cap, kicker, header, section } from './lib.mjs';

const IMG = {
  home: '/_blob/79a19165c21252c7b2e6958718861132', airport: '/_blob/ead41235be30229e516a6935a1468fda', walled: '/_blob/2ab2631d6f8ea3584ff064b8c7a7278e',
  heritage: '/_blob/6b1ec21187c8f2debfe1b6ee485c0590', rosario: '/_blob/2299a6d14a809a14dace2a84f593ab30', stay: '/_blob/b419850988981c4fc11054e579355989', hero: '/_blob/7d53a3a9f8de9819eabfcc4203ba7d2e',
  yacht: '/_blob/2299a6d14a809a14dace2a84f593ab30', concierge: '/_blob/79a19165c21252c7b2e6958718861132',
};
const UP = 'text-transform:{{tt}};letter-spacing:{{ls}};';
const FLOAT = 'box-shadow:0 18px 40px -10px rgb(10 9 7 / 0.3), 0 4px 10px -4px rgb(10 9 7 / 0.1);';
const LG = 'box-shadow:0 28px 56px -16px rgb(10 9 7 / 0.28), 0 10px 20px -10px rgb(10 9 7 / 0.12);';
const FOCUS = `outline:2px solid ${C.teal};outline-offset:2px;`;

export function makeJ(k, J) {
  const get = (lang, path) => path.split('.').reduce((o, p) => (o == null ? o : o[p]), J[lang]);
  const cat = (lang, n) => (lang === 'ar' ? (n === 0 ? 'zero' : n === 1 ? 'one' : n === 2 ? 'two' : n % 100 >= 3 && n % 100 <= 10 ? 'few' : n % 100 >= 11 ? 'many' : 'other') : n === 1 ? 'one' : 'other');
  const plural = (lang, base, n) => {
    const node = get(lang, base);
    const s = node[cat(lang, n)] ?? node.other;
    return s.replaceAll('#', String(n));
  };
  const LOC = { en: 'en', ar: 'ar-AE-u-nu-latn', es: 'es' };
  const guestSum = (lang, g) => {
    const parts = [];
    if (g.adults) parts.push(plural(lang, 'guests.summary.adults', g.adults));
    if (g.children) parts.push(plural(lang, 'guests.summary.children', g.children));
    if (g.infants) parts.push(plural(lang, 'guests.summary.infants', g.infants));
    return new Intl.ListFormat(LOC[lang], { style: 'long', type: 'conjunction' }).format(parts);
  };
  const t = (path, vars = {}) => {
    const f = (lang) => { let s = get(lang, path); if (typeof s !== 'string') throw new Error('bad copy path ' + path); for (const [a, v] of Object.entries(vars)) s = s.replaceAll('{' + a + '}', typeof v === 'function' ? v(lang) : v); return s; };
    return k(f('en'), f('ar'), f('es'));
  };
  const tp = (base, n) => k(plural('en', base, n), plural('ar', base, n), plural('es', base, n));
  const gs = (g) => k(guestSum('en', g), guestSum('ar', g), guestSum('es', g));
  const lit = (en, ar, es) => k(en, ar ?? en, es ?? en);
  const dt = (lang, y, m, opts) => new Intl.DateTimeFormat(LOC[lang], opts).format(new Date(Date.UTC(y, m, 1)));
  const month = (y, m) => k(dt('en', y, m, { month: 'long', year: 'numeric', timeZone: 'UTC' }), dt('ar', y, m, { month: 'long', year: 'numeric', timeZone: 'UTC' }), dt('es', y, m, { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  const wday = (i) => { const d = (lang) => new Intl.DateTimeFormat(LOC[lang], { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 5 + i))); return k(d('en'), d('ar'), d('es')); };
  const city = { Cartagena: ['كارتاخينا', 'Cartagena'], 'Medellín': ['ميديين', 'Medellín'], 'Bogotá': ['بوغوتا', 'Bogotá'], 'San Andrés': ['سان أندريس', 'San Andrés'], 'Cocora Valley': ['وادي كوكورا', 'Valle de Cocora'] };
  const cityT = (n) => k(n, city[n][0], city[n][1]);
  return { k, t, tp, gs, lit, month, wday, cityT, J };
}

const cartI = `<span role="img" aria-label="Cart" style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;color:${C.teal}">${icon('cart', 24, C.teal)}</span>`;
const bdi = (s, style = '') => `<bdi style="font-variant-numeric:tabular-nums;${style}">${s}</bdi>`;
const RANGE = '12/10/2026 – 17/10/2026';
const btnP = (label, o = {}) => `<span style="display:inline-flex;align-items:center;justify-content:center;gap:12px;height:${o.h || 44}px;${o.w ? `width:${o.w}px;` : ''}padding:0 ${o.px ?? 24}px;box-sizing:border-box;background:${C.teal};color:${C.ivory};font-size:14px;${UP}flex:none">${o.icon || ''}${label}</span>`;
const btnGhost = (label) => `<span style="display:inline-flex;align-items:center;height:44px;padding:0 8px;font-size:14px;color:${C.teal}">${label}</span>`;
const stepBtn = (g, disabled) => `<span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;box-sizing:border-box;background:${C.surface};border:1px solid ${disabled ? C.line : C.teal};color:${disabled ? C.muted : C.teal}">${icon(g, 16, 'currentColor')}</span>`;
const stepper = (n, minusOff, plusOff) => `<span style="display:inline-flex;align-items:center;flex:none">${stepBtn('minus', minusOff)}<span aria-live="polite" style="width:28px;text-align:center;font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:${C.ink}">${n}</span>${stepBtn('plus', plusOff)}</span>`;
const lbl = (s, color = C.muted, sz = 12) => `<span style="font-size:${sz}px;line-height:{{lhC}};color:${color}">${s}</span>`;
const nameT = (s, sz = 20) => `<span style="font-family:{{fd}};font-size:${sz}px;line-height:{{lhT}};color:${C.teal}">${s}</span>`;
const lab = (label, inner, w) => `<div style="display:flex;flex-direction:column;gap:12px;flex:none;${w ? `width:${w}px;` : ''}"><span style="font-size:12px;line-height:1.5;color:${C.muted}"><bdi>${label}</bdi></span>${inner}</div>`;

// ---------- desktop bar pieces ----------
function bar(J, W, opt = {}) {
  const { t, gs, cityT } = J;
  const h = opt.h || 72;
  const seg = (label, value, grow, st) => {
    const bg = st === 'open' || st === 'hover' ? C.surface : 'transparent';
    const rule = st === 'open' ? `box-shadow:inset 0 -3px 0 ${C.teal};` : st === 'missing' ? `box-shadow:inset 0 -3px 0 ${C.error};` : '';
    const lc = st === 'missing' ? C.error : C.muted;
    return `<div style="flex:${grow};min-width:0;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:0 24px;background:${bg};${rule}"><span style="font-size:12px;line-height:{{lhC}};color:${lc}">${label}</span><span style="font-size:16px;line-height:{{lhB}};color:${value.filled ? C.ink : C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${value.html}</span></div>`;
  };
  const div = `<span style="width:1px;height:36px;background:${C.line};display:block;flex:none"></span>`;
  const dest = opt.dest ? { filled: true, html: cityT('Cartagena') } : { html: t('bar.destination.empty') };
  const dates = opt.dates ? { filled: true, html: bdi(RANGE) } : { html: t('bar.dates.empty') };
  const guests = { filled: true, html: gs({ adults: 2, children: 0, infants: 0 }) };
  const s = opt.states || {};
  const searchW = opt.docked ? 160 : 200;
  return `<div style="width:${W}px;height:${h}px;box-sizing:border-box;background:${C.ivory};border-top:2px solid ${C.gold};${opt.docked ? `border-bottom:1px solid ${C.line};` : FLOAT}display:flex;align-items:center">${seg(t('bar.destination.label'), dest, 1.1, s.dest)}${div}${seg(t('bar.dates.label'), dates, 1.5, s.dates)}${div}${seg(t('bar.guests.label'), guests, 1.1, s.guests)}<span style="display:flex;align-items:center;justify-content:center;gap:12px;width:${searchW}px;height:100%;background:${s.search === 'hover' ? C.tealHover : C.teal};color:${C.ivory};font-size:14px;${UP}flex:none">${icon('search', 20, C.ivory, true)}${t('bar.search')}</span></div>`;
}
const alertLine = (J, txt) => `<div role="alert" style="display:inline-flex;align-items:center;gap:8px;background:${C.surface};${LG}padding:12px 16px;font-size:14px;line-height:{{lhL}};font-weight:700;color:${C.error}">${icon('alert-circle', 20, C.error)}<span>${txt}</span></div>`;
const panelBox = (inner, extra = '') => `<div style="background:${C.surface};${LG}${extra}">${inner}</div>`;

function destMenu(J, sel, w = 440) {
  const { t, lit, cityT } = J;
  const names = ['Cartagena', 'Medellín', 'Bogotá', 'San Andrés', 'Cocora Valley'];
  return panelBox(`<div style="padding:12px 0"><div style="padding:0 24px 8px;font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${t('menu.head')}</div>${names.map((n) => { const on = n === sel; return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px;box-sizing:border-box;padding:8px 24px;background:${on ? C.tealTint : C.surface}"><div style="display:flex;flex-direction:column;gap:2px;min-width:0">${nameT(cityT(n))}<span style="font-size:12px;line-height:{{lhC}};color:${on ? C.ink : C.muted}">${lit('[Short line]', '[سطر قصير]', '[Línea breve]')}</span></div>${on ? icon('check', 20, C.teal) : ''}</div>`; }).join('')}</div>`, `width:${w}px;`);
}

function monthGrid(J, y, m, offset, days, range, opts = {}) {
  const { month, wday } = J;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span></span>');
  for (let d = 1; d <= days; d++) {
    let st = `background:${C.surface};color:${C.ink};`;
    if (opts.past && d < opts.past) st = `background:${C.surface};color:${C.muted};`;
    if (range && (d === range[0] || d === range[1])) st = `background:${C.teal};color:${C.ivory};font-weight:700;`;
    else if (range && d > range[0] && d < range[1]) st = `background:${C.tealTint};color:${C.ink};`;
    else if (opts.today === d) st += `box-shadow:inset 0 -2px 0 ${C.teal};`;
    cells.push(`<span style="display:flex;align-items:center;justify-content:center;height:44px;box-sizing:border-box;font-size:${opts.phone ? 16 : 14}px;font-variant-numeric:tabular-nums;${st}">${d}</span>`);
  }
  const wd = [0, 1, 2, 3, 4, 5, 6].map((i) => `<span style="text-align:center;font-size:12px;line-height:{{lhC}};color:${C.muted}">${wday(i)}</span>`).join('');
  return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;justify-content:space-between;height:44px">${opts.prev === false ? '<span style="width:44px"></span>' : `<span style="display:flex;width:44px;height:44px;align-items:center;justify-content:center;color:${opts.prevOff ? C.muted : C.teal}">${icon('chevron-right', 20, 'currentColor', true).replace('transform: {{flip}};', 'transform: scaleX(-1);')}</span>`}${nameT(month(y, m))}${opts.next === false ? '<span style="width:44px"></span>' : `<span style="display:flex;width:44px;height:44px;align-items:center;justify-content:center;color:${C.teal}">${icon('chevron-right', 20, 'currentColor', true)}</span>`}</div><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">${wd}${cells.join('')}</div></div>`;
}

function datePanel(J, w, two, opts = {}) {
  const { t, k } = J;
  const range = opts.none ? null : [12, 17];
  const line = opts.none ? t('dates.line.none') : t('dates.line.range', { start: bdi('12/10/2026'), end: bdi('17/10/2026'), nights: (lang) => plural5(J, lang) });
  return panelBox(`<div style="padding:32px 32px 24px;display:flex;flex-direction:column;gap:24px"><div style="display:flex;gap:48px">${monthGrid(J, 2026, 9, 3, 31, range, { prevOff: true, next: !two, today: 2, past: 2 })}${two ? monthGrid(J, 2026, 10, 6, 30, null, { prev: false }) : ''}</div><div style="display:flex;align-items:center;gap:24px;padding-top:16px;border-top:1px solid ${C.line}"><span style="flex:1;font-size:14px;line-height:{{lhL}};color:${C.ink}">${line}</span>${btnGhost(t('dates.clear'))}${btnP(t('done'))}</div></div>`, `width:${w}px;`);
}
function plural5(J, lang) { const n = J.J[lang].dates.nights; const c = lang === 'ar' ? (n.few ?? n.other) : n.other; return c.replaceAll('#', '5'); }

function guestPanel(J, w, footer = true) {
  const { t } = J;
  const rows = [['adults', 'adultsHint', 'adult', 2, true], ['children', 'childrenHint', 'child', 0, false], ['infants', 'infantsHint', 'infant', 0, false]];
  return panelBox(`<div style="padding:12px 24px 24px">${rows.map(([a, b, g, n, on]) => `<div style="display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid ${C.line}"><div style="flex:1;display:flex;flex-direction:column"><span style="font-size:14px;line-height:{{lhL}};color:${C.ink}">${t('guests.' + a)}</span>${lbl(t('guests.' + b))}</div>${stepper(n, n === (a === 'adults' ? 1 : 0), false)}</div>`).join('')}${footer ? `<div style="display:flex;align-items:center;gap:16px;padding-top:16px">${lbl(t('guests.floor'))}<span style="flex:1"></span>${btnP(t('done'))}</div>` : ''}</div>`, `width:${w}px;`);
}

// ---------- BOARD 4a: journey bar (desktop and tablet) ----------
export function barBoard(k, J0) {
  const J = makeJ(k, J0);
  const { t } = J;
  const W = 1240;
  // segment geometry of the 1240 bar: grows 1.1 / 1.5 / 1.1, two 1px dividers, 200px Search
  const area = W - 200 - 2; const sw = (g) => (area * g) / 3.7;
  const DATES_C = sw(1.1) + 1 + sw(1.5) / 2;
  const GUESTS_C = sw(1.1) + 1 + sw(1.5) + 1 + sw(1.1) / 2;
  const stack = (barHtml, panel, ph) => `<div style="position:relative;height:${72 + 12 + ph}px;width:${W}px">${barHtml}<div style="position:absolute;top:84px;inset-inline-start:${panel.x || 0}px">${panel.html}</div></div>`;
  const b = (o) => bar(J, W, o);
  const blocks = [
    lab('Empty', b({}), W),
    lab('Destination open + DestinationMenu', stack(b({ states: { dest: 'open' } }), { html: destMenu(J, 'Cartagena') }, 400), W),
    lab('Dates open + DateRangePanel, two months, centered under the Dates tab', stack(b({ dest: true, states: { dates: 'open' } }), { html: datePanel(J, 760, true), x: DATES_C - 380 }, 520), W),
    lab('Guests open + GuestPanel, centered under the Guests tab', stack(b({ dest: true, dates: true, states: { guests: 'open' } }), { html: guestPanel(J, 440), x: GUESTS_C - 220 }, 340), W),
    lab('Hover on Dates · Search hover', b({ dest: true, states: { dates: 'hover', search: 'hover' } }), W),
    lab('Missing after Search: 3px error rule and one alert line', `<div style="display:flex;flex-direction:column;gap:12px">${b({ states: { dest: 'missing', dates: 'missing' } })}<div>${alertLine(J, t('bar.error.both'))}</div></div>`, W),
    lab('Filled', b({ dest: true, dates: true }), W),
    lab('Docked in the sticky header (second row, gold rule kept, no shadow)', `<div style="width:${W}px;background:${C.ivory};border:1px solid ${C.line}"><div style="display:flex;align-items:center;justify-content:space-between;height:96px;padding:0 32px;box-sizing:border-box;border-bottom:1px solid ${C.line}"><img src="${LOGO}" alt="ALMAR Private Journeys" style="width:150px;height:auto;display:block">${cartI}</div><div style="padding:0 0">${bar(J, W - 2, { dest: true, dates: true, docked: true, h: 56 })}</div></div>`, W),
  ];
  const tab = lab('Tablet 834 · panels open full column width, one month', `<div style="width:834px;display:flex;flex-direction:column;gap:12px;background:${C.ivory};border:1px solid ${C.line};padding:32px;box-sizing:border-box">${bar(J, 770, { dest: true, states: { dates: 'open' } })}${datePanel(J, 770, false)}</div>`, 834);
  const bodyHtml = header(k,
    k('ALMAR design system · Journey · 1 of 4', 'نظام تصميم ألمار · الرحلة · ١ من ٤', 'Sistema de diseño ALMAR · Viaje · 1 de 4'),
    k('Journey bar', 'شريط الرحلة', 'Barra de viaje'),
    k('Search is teal and never disabled. Segments have five states. Copy is the drafted lib/copy/journey.ts text in EN, AR and ES.', 'زر البحث أخضر مزرق ولا يُعطَّل أبدًا. للأقسام خمس حالات. النص هو مسودة lib/copy/journey.ts بالإنجليزية والعربية والإسبانية.', 'Buscar es verde azulado y nunca se deshabilita. Los segmentos tienen cinco estados. El texto es el borrador de lib/copy/journey.ts en EN, AR y ES.')) +
    section(k('Desktop 1440, states and panels', 'سطح المكتب ١٤٤٠، الحالات واللوحات', 'Escritorio 1440, estados y paneles'), '', `<div style="display:flex;flex-direction:column;gap:48px">${blocks.join('')}</div>`) +
    section(k('Tablet', 'اللوحي', 'Tableta'), '', tab);
  const h = 250 + 80 + 300 + 64 + 8 * 60 + (72 + 12 + 400) + (72 + 12 + 520) + (72 + 12 + 340) + 72 + 72 + 130 + 140 + 400 + 140 + 900 + 160;
  return { bodyHtml, w: 1440, h, title: 'Journey · Bar' };
}

// ---------- BOARD 4b: phone ----------
function phoneFrame(label, inner, h = 844) {
  return lab(label, `<div style="width:390px;height:${h}px;box-sizing:border-box;background:${C.ivory};border:1px solid ${C.line};overflow:hidden;display:flex;flex-direction:column;position:relative">${inner}</div>`, 390);
}
function entry(J, filled, docked) {
  const { t, cityT, gs, lit } = J;
  const h = docked ? 56 : 64;
  return `<div style="height:${h}px;box-sizing:border-box;background:${C.ivory};border-top:2px solid ${C.gold};${docked ? `border-bottom:1px solid ${C.line};` : FLOAT}display:flex;align-items:center;gap:16px;padding-inline-start:16px;padding-inline-end:${docked ? 6 : 8}px"><span style="flex:none">${icon('search', 20, C.teal, true)}</span><div style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:16px;line-height:{{lhB}};color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${filled ? cityT('Cartagena') + ' · ' + bdi(RANGE) : t('entry.title')}</span><span style="font-size:12px;line-height:{{lhC}};color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${filled ? gs({ adults: 2, children: 1, infants: 1 }) : t('entry.hint')}</span></div><span style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:${C.teal};color:${C.ivory};flex:none">${icon('arrow-right', 20, C.ivory, true)}</span></div>`;
}
function sheet(J, step, warn) {
  const { t, cityT, lit, gs } = J;
  const q = step === 1 ? t('sheet.where') : step === 2 ? t('sheet.when') : t('sheet.who');
  const head = `<div style="height:60px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 8px"><span style="display:flex;width:44px;height:44px;align-items:center;justify-content:center;color:${C.teal}">${icon('chevron-right', 20, 'currentColor', true).replace('transform: {{flip}};', 'transform: scaleX(-1);')}</span><span style="font-size:12px;line-height:{{lhC}};color:${C.muted};font-variant-numeric:tabular-nums">${t('sheet.progress', { n: String(step) })}</span><span style="display:flex;width:44px;height:44px;align-items:center;justify-content:center;color:${C.teal}">${icon('x', 20, C.teal)}</span></div>`;
  const prog = `<div style="padding:0 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;flex:none">${[1, 2, 3].map((n) => `<span style="height:3px;background:${n <= step ? C.teal : C.line};display:block"></span>`).join('')}</div>`;
  const title = `<h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:32px;line-height:{{lh1}};letter-spacing:{{tk}};color:${C.teal}">${q}</h2>`;
  let bodyIn;
  if (step === 1) bodyIn = `<div style="display:flex;flex-direction:column">${['Cartagena', 'Medellín', 'Bogotá', 'San Andrés', 'Cocora Valley'].map((n) => { const on = !warn && n === 'Cartagena'; return `<div style="display:flex;align-items:center;justify-content:space-between;min-height:64px;box-sizing:border-box;padding:8px 0;border-bottom:1px solid ${C.line};background:${on ? C.tealTint : 'transparent'}"><div style="display:flex;flex-direction:column;padding-inline-start:${on ? 8 : 0}px">${nameT(cityT(n))}${lbl(lit('[Short line]', '[سطر قصير]', '[Línea breve]'), on ? C.ink : C.muted)}</div><span style="padding-inline-end:8px">${icon('chevron-right', 20, C.teal, true)}</span></div>`; }).join('')}</div>`;
  else if (step === 2) bodyIn = `<div style="display:flex;flex-direction:column;gap:8px">${monthGrid(J, 2026, 9, 3, 31, warn ? null : [12, 17], { phone: true, prevOff: true, next: true, today: 2, past: 2 })}</div>`;
  else bodyIn = `<div>${guestPanel(J, 358, false).replace(LG, '')}</div>`;
  const summary = step === 1 ? (warn ? t('sheet.summary.where') : cityT('Cartagena')) : step === 2 ? (warn ? t('sheet.summary.whereHint').replace(/^/, '') : bdi(RANGE)) : gs({ adults: 2, children: 1, infants: 1 });
  const sub = warn ? `<span role="alert" style="font-size:12px;line-height:{{lhC}};font-weight:700;color:${C.error}">${step === 1 ? t('sheet.warn.where') : t('sheet.warn.when')}</span>` : lbl(step === 1 ? t('sheet.summary.whereHint') : step === 2 ? t('sheet.summary.whenHint') : t('guests.floor'));
  const dock = `<div style="height:88px;flex:none;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:16px;border-top:1px solid ${C.line};background:${C.ivory}"><div style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;line-height:{{lhL}};color:${C.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${step === 1 ? t('sheet.summary.where') : step === 2 ? t('sheet.when') : gs({ adults: 2, children: 1, infants: 1 })}</span>${sub}</div>${btnP(step === 3 ? t('bar.search') : t('sheet.next'), { h: 56, icon: step === 3 ? icon('search', 20, C.ivory, true) : '' })}</div>`;
  return `${head}${prog}<div style="flex:1;min-height:0;overflow:hidden;padding:32px 16px 0;display:flex;flex-direction:column;gap:24px">${title}${bodyIn}</div>${dock}`;
}
export function phoneBoard(k, J0) {
  const J = makeJ(k, J0);
  const hero = (inner) => `<div style="position:relative;height:300px;flex:none;overflow:hidden"><img src="${IMG.hero}" alt="${J.t('bar.label')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"><div style="position:absolute;inset:0;background:rgba(38,38,38,0.4)"></div><div style="position:absolute;left:16px;right:16px;bottom:24px">${inner}</div></div>`;
  const hdrRow = `<div style="height:72px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid ${C.line}"><img src="${LOGO}" alt="ALMAR Private Journeys" style="width:112px;height:auto;display:block"><div style="display:flex;align-items:center;gap:8px">${cartI}<span style="display:inline-flex;align-items:center;height:44px;padding:0 16px;box-sizing:border-box;border:1px solid ${C.muted};font-size:14px;color:${C.ink}">${J.lit('Menu', 'القائمة', 'Menú')}</span></div></div>`;
  const frames = [
    phoneFrame('Entry · empty (hero)', hdrRow + hero(entry(J, false, false)), 372),
    phoneFrame('Entry · filled', hdrRow + hero(entry(J, true, false)), 372),
    phoneFrame('Docked row in the sticky header', hdrRow + entry(J, true, true), 128),
    phoneFrame('Sheet 1 · Where', sheet(J, 1, false)),
    phoneFrame('Sheet 1 · warning in the dock', sheet(J, 1, true)),
    phoneFrame('Sheet 2 · When', sheet(J, 2, false)),
    phoneFrame('Sheet 2 · warning in the dock', sheet(J, 2, true)),
    phoneFrame('Sheet 3 · Who', sheet(J, 3, false)),
  ];
  const bodyHtml = header(k,
    k('ALMAR design system · Journey · 2 of 4', 'نظام تصميم ألمار · الرحلة · ٢ من ٤', 'Sistema de diseño ALMAR · Viaje · 2 de 4'),
    k('Phone journey', 'رحلة الهاتف', 'Viaje en el teléfono'),
    k('One tap target in the hero, then three steps: Where, When, Who. One button at the bottom. The button is never disabled: when a step is incomplete the warning replaces the hint.', 'هدف لمس واحد في الواجهة ثم ثلاث خطوات: أين ومتى ومن. زر واحد في الأسفل لا يُعطَّل أبدًا: عند نقص الخطوة يحل التحذير محل التلميح.', 'Un solo punto de toque en la portada y luego tres pasos: Dónde, Cuándo, Quién. Un botón abajo que nunca se deshabilita: si falta algo, el aviso sustituye la ayuda.')) +
    `<div style="display:flex;align-items:flex-start;gap:80px">${frames.join('')}</div>`;
  return { bodyHtml, w: 200 + 8 * 390 + 7 * 80, h: 250 + 160 + 300 + 64 + 30 + 844 + 40, title: 'Journey · Phone' };
}

// ---------- add-ons, cart, rail ----------
function stepRail(J, cur, phone) {
  const { t, k } = J;
  const names = ['stay', 'addons', 'travelers', 'pay'];
  if (phone) return `<div style="padding:16px;display:flex;flex-direction:column;gap:8px"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">${names.map((n, i) => `<span style="height:3px;background:${i < cur ? C.teal : C.line};display:block"></span>`).join('')}</div>${lbl(t('steps.phone', { n: String(cur), name: (lang) => J.J[lang].steps[names[cur - 1]] }))}</div>`;
  return `<ol aria-label="${t('steps.label')}" style="margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid ${C.line}">${names.map((n, i) => {
    const st = i + 1 < cur ? 'done' : i + 1 === cur ? 'cur' : 'up';
    const mark = st === 'done' ? `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:${C.teal};color:${C.ivory}">${icon('check', 14, C.ivory)}</span>` : `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;box-sizing:border-box;border:1px solid ${st === 'cur' ? C.teal : C.muted};color:${st === 'cur' ? C.teal : C.muted};font-size:12px;font-variant-numeric:tabular-nums">${i + 1}</span>`;
    return `<li style="display:flex;align-items:center;gap:12px;padding-bottom:16px;padding-top:0;${st === 'cur' ? `box-shadow:inset 0 -3px 0 ${C.teal};` : ''}">${mark}<span style="font-size:14px;line-height:{{lhL}};color:${st === 'up' ? C.muted : C.teal}">${t('steps.' + n)}</span>${st === 'done' ? `<span style="display:inline-flex;align-items:center;min-height:44px;padding:0 8px;font-size:14px;color:${C.teal}">${t('steps.change')}</span>` : ''}</li>`;
  }).join('')}</ol>`;
}

const ADD = [
  { key: 'home', img: IMG.home, name: ['Home pickup', 'استقبال من المنزل', 'Recogida en casa'], kind: 'service', uae: true, unit: 'trip', q: 1 },
  { key: 'vip', img: IMG.airport, name: ['VIP Airport Meet & Greet', 'استقبال كبار الشخصيات في المطار', 'Recibimiento VIP en el aeropuerto'], kind: 'service', uae: true, unit: 'trip', q: 0 },
  { key: 'conc', img: IMG.concierge, name: ['24/7 Private Concierge', 'كونسيرج خاص على مدار الساعة', 'Conserje privado 24/7'], kind: 'service', unit: 'night', q: 5 },
  { key: 'walled', img: IMG.walled, name: ['Cartagena Walled City Night', 'ليلة في المدينة المسوّرة بكارتاخينا', 'Noche en la ciudad amurallada de Cartagena'], kind: 'experience', unit: 'person', q: 4 },
  { key: 'heritage', img: IMG.heritage, name: ['Cartagena Heritage Tours', 'جولات تراث كارتاخينا', 'Recorridos patrimoniales de Cartagena'], kind: 'experience', unit: 'person', q: 0 },
  { key: 'rosario', img: IMG.rosario, name: ['Rosario Islands Escape', 'رحلة جزر الروزاريو', 'Escapada a las Islas del Rosario'], kind: 'experience', unit: 'person', q: 2 },
];
function addRow(J, a, phone) {
  const { t, k, lit } = J;
  const nm = k(...a.name);
  const kind = a.uae ? t('addons.kind.serviceUae') : a.kind === 'service' ? t('addons.kind.service') : t('addons.kind.experience');
  const unit = t('addons.unit.' + a.unit);
  const maxN = a.unit === 'night' ? 5 : 4;
  const added = a.q > 0;
  let ctl;
  if (a.unit === 'trip') ctl = `<span style="display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;width:${phone ? 44 : 124}px;box-sizing:border-box;border:1px solid ${C.teal};background:${added ? C.teal : C.surface};color:${added ? C.ivory : C.teal};font-size:12px;${UP}">${added ? icon('check', 16, C.ivory) : (phone ? icon('plus', 20, C.teal) : '')}${phone ? '' : (added ? t('addons.added') : t('addons.add'))}</span>`;
  else ctl = `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">${stepper(a.q, a.q === 0, a.q === maxN)}${a.q === maxN ? lbl(t('addons.max.' + a.unit)) : ''}</div>`;
  const price = `<div style="display:flex;flex-direction:column;align-items:flex-end;text-align:end"><span style="font-size:${phone ? 14 : 16}px;line-height:{{lhB}};font-variant-numeric:tabular-nums;color:${C.ink}"><bdi>AED [PRICE]</bdi></span>${lbl(unit)}</div>`;
  const ring = added ? `box-shadow:inset 0 0 0 2px ${C.teal};` : `box-shadow:inset 0 0 0 1px ${C.line};`;
  if (phone) return `<div style="display:flex;align-items:center;gap:12px;background:${C.surface};padding:8px;${ring}flex-wrap:wrap"><img src="${a.img}" alt="${nm}" style="width:84px;height:84px;object-fit:cover;display:block;flex:none"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${kind}</span>${nameT(nm, 16)}<span style="font-size:14px;line-height:{{lhL}};font-variant-numeric:tabular-nums;color:${C.ink}"><bdi>AED [PRICE]</bdi> · ${unit}</span></div>${a.unit === 'trip' ? ctl : ''}${a.unit !== 'trip' ? `<div style="width:100%;display:flex;justify-content:flex-end">${ctl}</div>` : ''}</div>`;
  return `<div style="display:flex;align-items:center;gap:24px;background:${C.surface};padding:12px;padding-inline-end:24px;${ring}"><img src="${a.img}" alt="${nm}" style="width:136px;height:102px;object-fit:cover;display:block;flex:none;outline:1px solid rgba(38,38,38,0.1);outline-offset:-1px"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${kind}</span>${nameT(nm)}</div><div style="width:152px;flex:none">${price}</div><div style="width:124px;flex:none;display:flex;justify-content:flex-end">${ctl}</div></div>`;
}
function inclusions(J, phone) {
  const { t, k } = J;
  const items = [['Airport meet', 'استقبال المطار', 'Recibimiento en el aeropuerto'], ['Transfer in Colombia', 'التنقل داخل كولومبيا', 'Traslado en Colombia'], ['Your stay', 'إقامتك', 'Tu estancia'], ['Private guide', 'مرشد خاص', 'Guía privado'], ['Security', 'الأمن', 'Seguridad'], ['Insurance', 'التأمين', 'Seguro'], ['Return', 'العودة', 'Regreso']];
  if (phone) return `<div style="background:${C.tealTint};padding:12px 16px;display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.teal}">${t('inclusions.title')}</span><span style="font-size:14px;line-height:{{lhL}};color:${C.teal}">${items.map((i) => k(...i)).join(' · ')}</span></div>`;
  return `<section aria-label="${t('inclusions.title')}" style="background:${C.tealTint};padding:24px;display:flex;flex-direction:column;gap:16px"><div style="display:flex;align-items:center;justify-content:space-between;gap:16px"><h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:20px;line-height:{{lhT}};color:${C.teal}">${t('inclusions.title')}</h2><span style="font-size:14px;color:${C.teal}">${t('inclusions.note')}</span></div><div style="display:flex;flex-wrap:wrap;gap:12px 24px">${items.map((i) => `<span style="display:inline-flex;align-items:center;gap:8px;font-size:14px;line-height:{{lhL}};color:${C.teal}">${icon('check', 16, C.teal)}${k(...i)}</span>`).join('')}</div></section>`;
}
function cartLine(J, nameHtml, amt, extra = '', remove = true) {
  return `<div style="display:flex;align-items:center;gap:12px;font-size:14px;line-height:{{lhL}};font-variant-numeric:tabular-nums;color:${C.ink}"><span style="flex:1;min-width:0">${nameHtml}${extra}</span><span>${amt}</span>${remove ? `<span style="display:flex;width:44px;height:44px;align-items:center;justify-content:center;color:${C.muted}">${icon('x', 20, 'currentColor')}</span>` : ''}</div>`;
}
function cartBody(J, empty) {
  const { t, k, cityT, gs, lit } = J;
  const amt = `<bdi>AED [AMOUNT]</bdi>`;
  const lines = empty ? `<span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${t('cart.empty')}</span>` : `${lbl(t('cart.addons.other').replace('#', '3') && k(J.J.en.cart.addons.other.replace('#', '3'), (J.J.ar.cart.addons.few ?? J.J.ar.cart.addons.other).replace('#', '3'), J.J.es.cart.addons.other.replace('#', '3')), C.muted)}${cartLine(J, k(...ADD[0].name), amt)}${cartLine(J, k(...ADD[3].name), amt, `<span style="color:${C.muted}"> × 4</span>`)}${cartLine(J, k(...ADD[5].name), amt, `<span style="color:${C.muted}"> × 2</span>`)}`;
  return `<div style="display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:{{lhL}};font-variant-numeric:tabular-nums"><div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid ${C.line}"><span>${k(J.J.en.cart.stay.other.replace('#', '5'), (J.J.ar.cart.stay.few ?? J.J.ar.cart.stay.other).replace('#', '5'), J.J.es.cart.stay.other.replace('#', '5'))}</span><span>${amt}</span></div>${lines}<div style="display:flex;justify-content:space-between;color:${C.muted};padding-top:12px;border-top:1px solid ${C.line}"><span>${k(J.J.en.cart.inclusions.other.replace('#', '7'), (J.J.ar.cart.inclusions.few ?? J.J.ar.cart.inclusions.other).replace('#', '7'), J.J.es.cart.inclusions.other.replace('#', '7'))}</span><span>${t('cart.included')}</span></div><div style="display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid ${C.line}"><div style="display:flex;justify-content:space-between"><span>${t('cart.subtotal')}</span><span>${amt}</span></div><div style="display:flex;justify-content:space-between"><span>${t('cart.vat')}</span><span>${amt}</span></div></div><div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid ${C.ink};font-size:20px;line-height:{{lhT}}"><span>${t('cart.total')}</span><span style="font-weight:700">${amt}</span></div></div>`;
}
function cartRail(J, empty) {
  const { t, cityT, gs, k } = J;
  return `<aside aria-label="${t('cart.label')}" style="width:400px;box-sizing:border-box;background:${C.surface};border:1px solid ${C.line};flex:none"><img src="${IMG.stay}" alt="${k('Getsemaní Colonial House', 'بيت جتسيماني الاستعماري', 'Casa colonial de Getsemaní')}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block"><div style="padding:24px;display:flex;flex-direction:column;gap:16px"><div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;line-height:{{lhC}};${UP}color:${C.muted}">${t('cart.kicker', { destination: (l) => J.J[l] && ({ en: 'Cartagena', ar: 'كارتاخينا', es: 'Cartagena' })[l] })}</span>${nameT(k('Getsemaní Colonial House', 'بيت جتسيماني الاستعماري', 'Casa colonial de Getsemaní'))}<span style="font-size:14px;line-height:{{lhL}};color:${C.ink}">${bdi(RANGE)} · ${J.gs({ adults: 2, children: 1, infants: 1 })}</span></div>${cartBody(J, empty)}<span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${t('cart.note')}</span></div></aside>`;
}
function dock(J, total) {
  const { t, k } = J;
  return `<div style="height:88px;flex:none;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:16px;border-top:1px solid ${C.line};background:${C.ivory}"><div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;height:56px"><div style="display:flex;flex-direction:column;min-width:0"><span style="font-size:12px;line-height:{{lhC}};color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${k(J.J.en.cart.phoneTotal.other.replace('#', '3'), (J.J.ar.cart.phoneTotal.few ?? J.J.ar.cart.phoneTotal.other).replace('#', '3'), J.J.es.cart.phoneTotal.other.replace('#', '3'))}</span><span style="font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:${C.ink}"><bdi>AED [AMOUNT]</bdi></span></div>${icon('chevron-up', 20, C.teal)}</div>${btnP(t('cart.continue'), { h: 56 })}</div>`;
}
const chips = (J) => { const { t } = J; const chip = (s, on, first) => `<span style="display:inline-flex;align-items:center;height:40px;padding:0 16px;box-sizing:border-box;margin-inline-start:${first ? 0 : -1}px;background:${on ? C.teal : 'transparent'};color:${on ? C.ivory : C.ink};border:1px solid ${on ? C.teal : C.muted};font-size:14px">${s}</span>`; return `<div role="group" aria-label="${t('addons.filter.label')}" style="display:flex">${chip(t('addons.filter.all'), true, true)}${chip(t('addons.filter.experiences'), false)}${chip(t('addons.filter.services'), false)}</div>`; };

// ---------- BOARD 4c: add-ons step (desktop) ----------
export function addonsBoard(k, J0) {
  const J = makeJ(k, J0);
  const { t, tp } = J;
  const rail = `<div style="width:1240px;background:${C.ivory}">${stepRail(J, 2, false)}</div>`;
  const list = `<div tabindex="0" aria-label="${t('addons.listLabel')}" style="height:520px;overflow:hidden;display:flex;flex-direction:column;gap:12px">${ADD.map((a) => addRow(J, a, false)).join('')}</div>`;
  const page = `<div style="width:1240px;display:flex;flex-direction:column;gap:32px;padding:32px 0 0"><div style="display:flex;flex-direction:column;gap:16px"><h1 style="margin:0;font-family:{{fd}};font-weight:400;font-size:48px;line-height:{{lh1}};letter-spacing:{{tk}};color:${C.teal}">${t('addons.title')}</h1><p style="margin:0;font-size:16px;line-height:{{lhB}};color:${C.ink};max-width:65ch">${t('addons.intro')}</p></div><div style="display:flex;gap:32px;align-items:flex-start"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:24px">${inclusions(J, false)}<div style="display:flex;align-items:center;justify-content:space-between;gap:16px"><div style="display:flex;flex-direction:column;gap:4px"><h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:32px;line-height:{{lh2}};color:${C.teal}">${t('addons.section', { destination: (l) => ({ en: 'Cartagena', ar: 'كارتاخينا', es: 'Cartagena' })[l] })}</h2>${lbl(t('addons.count', { shown: '11', added: '3' }))}</div>${chips(J)}</div>${list}<div style="display:flex;align-items:center;justify-content:space-between">${btnGhost(t('addons.back'))}${btnP(t('addons.continue'), { h: 56, px: 32 })}</div></div>${cartRail(J, false)}</div></div>`;
  const skeleton = `<div style="width:808px;display:flex;flex-direction:column;gap:12px">${[1, 2, 3].map(() => `<div style="display:flex;align-items:center;gap:24px;background:${C.surface};padding:12px;box-shadow:inset 0 0 0 1px ${C.line}"><span style="width:136px;height:102px;background:${C.ivory};display:block"></span><div style="flex:1;display:flex;flex-direction:column;gap:8px"><span style="height:12px;width:80px;background:${C.ivory};display:block"></span><span style="height:20px;width:60%;background:${C.ivory};display:block"></span></div></div>`).join('')}</div>`;
  const empties = col2(t('addons.empty.all'), t('addons.empty.experiences'), t('addons.empty.services'));
  function col2(...xs) { return `<div style="display:flex;flex-direction:column;gap:12px">${xs.map((x) => `<span style="font-size:14px;line-height:{{lhL}};color:${C.muted}">${x}</span>`).join('')}</div>`; }
  const states = `<div style="display:flex;gap:48px;align-items:flex-start">${lab('Loading · three skeleton rows, opacity only', skeleton, 808)}${lab('Empty list lines (per filter)', empties, 300)}${lab('Cart empty', `<div style="width:400px;background:${C.surface};border:1px solid ${C.line};padding:24px;box-sizing:border-box">${cartBody(J, true)}</div>`, 400)}</div>`;
  const bodyHtml = header(k,
    k('ALMAR design system · Journey · 3 of 4', 'نظام تصميم ألمار · الرحلة · ٣ من ٤', 'Sistema de diseño ALMAR · Viaje · 3 de 4'),
    k('Add-ons step, desktop', 'خطوة الإضافات، سطح المكتب', 'Paso de extras, escritorio'),
    k('StepRail, InclusionsList, the scrolling add-on list with all three units, and the cart rail. Prices are AED [PRICE] and AED [AMOUNT] only.', 'سلم الخطوات وقائمة المشمولات وقائمة الإضافات القابلة للتمرير بالوحدات الثلاث وشريط السلة. الأسعار AED [PRICE] وAED [AMOUNT] فقط.', 'StepRail, lista de incluidos, la lista desplazable de extras con las tres unidades y el carro lateral. Precios solo AED [PRICE] y AED [AMOUNT].')) +
    section(k('StepRail', 'سلم الخطوات', 'StepRail'), k('Done, current, upcoming. The current step has a 3px teal rule.', 'مكتملة وحالية وقادمة. الخطوة الحالية بخط أخضر مزرق ٣ بكسل.', 'Hecho, actual, próximo. El paso actual lleva una regla de 3 px.'), rail) +
    section(k('/booking/trip · add-ons', '/booking/trip · الإضافات', '/booking/trip · extras'), k('Home pickup starts Added. Rows: trip, night at max, person at max, person at zero, person, trip off.', 'استقبال المنزل يبدأ مضافًا. الصفوف: رحلة، ليلة عند الحد الأقصى، شخص عند الحد الأقصى، شخص عند الصفر.', 'Recogida en casa empieza añadida. Filas: viaje, noche al máximo, persona al máximo, persona en cero.'), page) +
    section(k('Other states', 'حالات أخرى', 'Otros estados'), '', states);
  return { bodyHtml, w: 1440, h: 350 + 160 + 300 + 64 + 300 + 64 + 200 + 1900 + 64 + 200 + 700, title: 'Journey · Add-ons' };
}

// ---------- BOARD 4d: phone add-ons, cart, pay ----------
export function phoneAddonsBoard(k, J0) {
  const J = makeJ(k, J0);
  const { t } = J;
  const hdrRow = `<div style="height:72px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid ${C.line}"><img src="${LOGO}" alt="ALMAR Private Journeys" style="width:112px;height:auto;display:block"><div style="display:flex;align-items:center;gap:8px">${cartI}<span style="display:inline-flex;align-items:center;height:44px;padding:0 16px;box-sizing:border-box;border:1px solid ${C.muted};font-size:14px;color:${C.ink}">${J.lit('Menu', 'القائمة', 'Menú')}</span></div></div>`;
  const page = phoneFrame('Add-ons · phone', `${hdrRow}${stepRail(J, 2, true)}<div style="flex:1;min-height:0;overflow:hidden;padding:0 16px;display:flex;flex-direction:column;gap:16px"><h1 style="margin:0;font-family:{{fd}};font-weight:400;font-size:32px;line-height:{{lh1}};letter-spacing:{{tk}};color:${C.teal}">${t('addons.title')}</h1>${inclusions(J, true)}${chips(J)}<div style="display:flex;flex-direction:column;gap:12px">${addRow(J, ADD[0], true)}${addRow(J, ADD[3], true)}${addRow(J, ADD[2], true)}</div></div>${dock(J)}`);
  const cartFull = phoneFrame('Cart · full screen (tap the total)', `<div style="height:60px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 16px;border-bottom:1px solid ${C.line}"><h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:20px;line-height:{{lhT}};color:${C.teal}">${t('cart.label')}</h2><span style="display:flex;width:44px;height:44px;align-items:center;justify-content:center;color:${C.teal}">${icon('x', 20, C.teal)}</span></div><div style="flex:1;min-height:0;overflow:hidden;padding:16px;display:flex;flex-direction:column;gap:12px">${cartBody(J, false)}<span style="font-size:12px;line-height:{{lhC}};color:${C.muted}">${t('cart.note')}</span></div>${dock(J)}`);
  const tc = (title, detail, on, amount) => `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;min-height:44px;padding:16px;box-sizing:border-box;background:${C.surface};border:1px solid ${on ? C.teal : C.muted};${on ? `box-shadow:inset 0 0 0 2px ${C.teal};` : ''}"><span style="display:flex;flex-direction:column;gap:4px">${nameT(title)}<span style="font-size:14px;line-height:{{lhL}};color:${C.muted}">${detail}</span>${amount ? `<span style="font-size:16px;font-variant-numeric:tabular-nums;color:${C.ink}"><bdi>AED [AMOUNT]</bdi></span>` : ''}</span>${on ? icon('check', 20, C.teal) : ''}</div>`;
  const err = (txt) => `<div role="alert" style="display:flex;align-items:center;gap:8px;color:${C.error};font-size:14px;line-height:{{lhL}}">${icon('alert-circle', 20, C.error)}<span>${txt}</span></div>`;
  const DEP = k('Deposit', 'دفعة مقدّمة', 'Depósito'), FULL = k('Full payment', 'دفع كامل', 'Pago completo'), DET = k('[Detail line]', '[سطر التفاصيل]', '[Línea de detalle]');
  const payPage = `<div style="width:1240px;background:${C.ivory}">${stepRail(J, 4, false)}<div style="padding:32px 0;display:flex;flex-direction:column;gap:32px"><h1 style="margin:0;font-family:{{fd}};font-weight:400;font-size:48px;line-height:{{lh1}};letter-spacing:{{tk}};color:${C.teal}">${k('Pay', 'الدفع', 'Pago')}</h1><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px"><div style="display:flex;flex-direction:column;gap:12px" role="group" aria-label="${k('Payment', 'الدفع', 'Pago')}">${tc(DEP, DET, false, true)}${tc(FULL, DET, false, true)}${err(t('pay.choice.error'))}</div><div style="display:flex;flex-direction:column;gap:12px" role="group" aria-label="${k('Payment', 'الدفع', 'Pago')}">${tc(DEP, DET, true, true)}${tc(FULL, DET, false, true)}</div><div style="display:flex;flex-direction:column;gap:12px" role="group" aria-label="${k('UAE airport', 'مطار الإمارات', 'Aeropuerto EAU')}">${tc('Dubai · DXB', '', true, false)}${tc('Abu Dhabi · AUH', '', false, false)}${err(t('pay.airport.error'))}</div></div></div></div>`;
  const bodyHtml = header(k,
    k('ALMAR design system · Journey · 4 of 4', 'نظام تصميم ألمار · الرحلة · ٤ من ٤', 'Sistema de diseño ALMAR · Viaje · 4 de 4'),
    k('Phone add-ons, cart and Pay', 'إضافات الهاتف والسلة والدفع', 'Extras en teléfono, carro y Pago'),
    k('The phone dock holds the total and one Continue button. The total opens the full-screen cart. The Pay step uses ToggleCards, never radio controls.', 'شريط الهاتف السفلي يضم الإجمالي وزر متابعة واحدًا. الإجمالي يفتح السلة بملء الشاشة. خطوة الدفع تستخدم بطاقات تبديل وليس أزرار اختيار دائرية.', 'La barra inferior del teléfono lleva el total y un botón Continuar. El total abre el carro a pantalla completa. Pago usa ToggleCards, nunca radios.')) +
    section(k('Phone', 'الهاتف', 'Teléfono'), '', `<div style="display:flex;align-items:flex-start;gap:80px">${page}${cartFull}</div>`) +
    section(k('Pay step · ToggleCards', 'خطوة الدفع · بطاقات التبديل', 'Paso Pago · ToggleCards'), k('Left: none chosen and Continue pressed. Middle: deposit chosen. Right: UAE airport, none chosen.', 'اليسار: لا اختيار بعد الضغط على متابعة. الوسط: اختيار دفعة مقدّمة. اليمين: مطار الإمارات دون اختيار.', 'Izquierda: sin elegir tras pulsar Continuar. Centro: depósito elegido. Derecha: aeropuerto de EAU sin elegir.'), payPage);
  return { bodyHtml, w: 1440, h: 250 + 160 + 300 + 64 + 100 + 844 + 64 + 100 + 600 + 80, title: 'Journey · Phone add-ons and Pay' };
}

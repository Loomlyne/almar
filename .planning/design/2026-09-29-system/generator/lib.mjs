// Shared helpers for generating the ALMAR design-system canvas boards (.dc.html).
export const C = {
  ivory: '#fffaf0', surface: '#ffffff', teal: '#1f3b40', tealHover: '#1b3438', tealPress: '#182d31',
  tealTint: '#d1dfe0', gold: '#d4ba8a', ink: '#262626', muted: '#63615f', line: 'rgba(38,38,38,0.16)',
  error: '#8f2d2d', success: '#1e6b45', warning: '#8a3b12', whatsapp: '#25D366',
};
export const MONO = "'JetBrains Mono', monospace";
export const LOGO = '/_blob/769c70da26459274369f4f03fda0c908'; // Poly_Black.svg (brand/Logo Typography)
export const HERO_IMG = '/_blob/7d53a3a9f8de9819eabfcc4203ba7d2e';

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400&amp;family=Noto+Sans+Arabic:wght@400;700&amp;family=JetBrains+Mono:wght@400..600&amp;display=swap">
<style>
@font-face{font-family:'Questa';src:url('/_blob/dfb13bed53d3c684b2436f251c533b6f') format('woff');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Lato';src:url('/_blob/77d52f10b0e77b462369bcd47ca1c172') format('truetype');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Lato';src:url('/_blob/32fa77770b678d5e662eb3e29bdb2c6b') format('truetype');font-weight:700;font-style:normal;font-display:swap}
body{margin:0;background:#fffaf0;color:#262626;font-family:'Lato',Arial,sans-serif}
a{color:#1f3b40}a:hover{color:#1f3b40}
</style>`;

const ICONS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  'chevron-right': '<path d="M9 5l7 7-7 7"/>',
  'chevron-down': '<path d="M5 9l7 7 7-7"/>',
  'chevron-up': '<path d="M5 15l7-7 7 7"/>',
  'arrow-right': '<path d="M4 12h15M13 6l6 6-6 6"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  mail: '<rect x="3" y="5" width="18" height="14"/><path d="M3 7l9 6.5L21 7"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
  'eye-off': '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M4 4l16 16"/>',
  spinner: '<path d="M12 3a9 9 0 1 1-9 9"/>',
  cart: '<path d="M3 4h2.5l2.2 10.5h9.6L20 7H6.5"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  lock: '<rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};
export const ICON_NAMES = Object.keys(ICONS);
// flip = true: mirrors the glyph in RTL (chevrons, arrows, search). Check, plus, minus, x never flip.
export function icon(name, size = 20, color = 'currentColor', flip = false, fill = 'none') {
  const tf = flip ? ' transform: {{flip}};' : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" style="display:block;flex:none;${tf}">${ICONS[name]}</svg>`;
}

export function makeDict() {
  const dict = {};
  let n = 0;
  const k = (en, ar, es) => {
    const key = 'k' + ++n;
    dict[key] = { en, ar, es };
    return `{{t.${key}}}`;
  };
  return { dict, k };
}

// text helpers (holes come from renderVals)
export const mono = (s) => `<bdi style="font-family:${MONO};font-size:12px;color:${C.muted}">${s}</bdi>`;
export const code = (s, color = C.muted, size = 12) => `<bdi style="font-family:${MONO};font-size:${size}px;color:${color}">${s}</bdi>`;
export const kicker = (t, color = C.muted) => `<div style="font-size:12px;line-height:{{lhC}};text-transform:{{tt}};letter-spacing:{{ls}};color:${color}">${t}</div>`;
export const cap = (t, color = C.muted) => `<span style="font-size:12px;line-height:{{lhC}};color:${color}">${t}</span>`;
export const lab = (t, color = C.ink) => `<span style="font-size:14px;line-height:{{lhL}};color:${color}">${t}</span>`;
export const body = (t, color = C.ink) => `<p style="margin:0;font-size:16px;line-height:{{lhB}};color:${color};max-width:65ch">${t}</p>`;
export const h1 = (t) => `<h1 style="margin:0;font-family:{{fd}};font-weight:400;font-size:64px;line-height:{{lh0}};letter-spacing:{{tk}};color:${C.teal}">${t}</h1>`;
export const h2 = (t) => `<h2 style="margin:0;font-family:{{fd}};font-weight:400;font-size:32px;line-height:{{lh2}};color:${C.teal}">${t}</h2>`;
export const h3 = (t) => `<h3 style="margin:0;font-family:{{fd}};font-weight:400;font-size:20px;line-height:{{lhT}};color:${C.teal}">${t}</h3>`;
export const flex = (style, inner) => `<div style="display:flex;${style}">${inner}</div>`;
export const col = (gap, inner, extra = '') => `<div style="display:flex;flex-direction:column;gap:${gap}px;${extra}">${inner}</div>`;
export const row = (gap, inner, extra = '') => `<div style="display:flex;align-items:center;gap:${gap}px;${extra}">${inner}</div>`;
export const grid = (n, gap, inner, extra = '') => `<div style="display:grid;grid-template-columns:repeat(${n},minmax(0,1fr));gap:${gap}px;${extra}">${inner}</div>`;
export const panel = (inner, extra = '') => `<div style="background:${C.surface};border:1px solid ${C.line};padding:24px;${extra}">${inner}</div>`;

export function section(title, sub, inner) {
  return `<section style="display:flex;flex-direction:column;gap:24px">
<div style="display:flex;flex-direction:column;gap:8px;border-top:2px solid ${C.gold};padding-top:24px">${h2(title)}${sub ? body(sub, C.muted) : ''}</div>${inner}</section>`;
}

const SWITCH = (k) => `<div style="display:flex;align-items:center;gap:8px" role="group" aria-label="${k('Language','اللغة','Idioma')}">
<button type="button" onClick="{{setEn}}" aria-pressed="{{pEn}}" style="{{sw.en}}">EN</button>
<button type="button" onClick="{{setAr}}" aria-pressed="{{pAr}}" style="{{sw.ar}}">AR</button>
<button type="button" onClick="{{setEs}}" aria-pressed="{{pEs}}" style="{{sw.es}}">ES</button></div>`;

// Header block shared by every board: kicker, title, intro, language switch and draft note.
export function header(k, kickerText, title, intro) {
  return `<div style="display:flex;flex-direction:column;gap:16px">
${kicker(kickerText)}
<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:32px"><div style="display:flex;flex-direction:column;gap:16px;min-width:0">${h1(title)}${body(intro, C.ink)}</div>
<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;flex:none">{{switchHtml}}${cap(k('Arabic and Spanish are drafts for owner review.', 'العربية والإسبانية مسودات بانتظار مراجعة المالك.', 'El árabe y el español son borradores para revisión del propietario.'))}</div></div></div>`;
}
export const switchMarkup = (k) => SWITCH(k);

export function wrapBoard({ title, w, h, bodyHtml, dict, fixedAr }) {
  const dictJson = JSON.stringify(dict).replace(/</g, '\\u003c');
  const showSwitch = !fixedAr;
  const bodyOut = bodyHtml.replace('{{switchHtml}}', showSwitch ? '__SWITCH__' : '');
  return `<!doctype html>
<html lang="${fixedAr ? 'ar' : 'en'}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${FONTS}
</helmet>
<div dir="{{dir}}" style="width:${w}px;height:${h}px;box-sizing:border-box;padding:80px 100px;background:${C.ivory};color:${C.ink};font-family:{{fb}};display:flex;flex-direction:column;gap:64px;overflow:hidden">
${bodyOut}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
const DICT = ${dictJson};
const FIXED = ${fixedAr ? "'ar'" : 'null'};
class Component extends DCLogic {
  renderVals() {
    const lang = FIXED || (this.state && this.state.lang) || 'en';
    const ar = lang === 'ar';
    const t = {};
    Object.keys(DICT).forEach((key) => { t[key] = DICT[key][lang]; });
    const on = 'height:44px;min-width:44px;padding:0 12px;box-sizing:border-box;font:14px Lato,Arial,sans-serif;cursor:pointer;background:#1f3b40;color:#fffaf0;border:1px solid #1f3b40;border-radius:0';
    const off = 'height:44px;min-width:44px;padding:0 12px;box-sizing:border-box;font:14px Lato,Arial,sans-serif;cursor:pointer;background:#ffffff;color:#262626;border:1px solid #63615f;border-radius:0';
    return {
      t, dir: ar ? 'rtl' : 'ltr',
      fd: ar ? "'Noto Naskh Arabic', serif" : "'Questa', Georgia, serif",
      fb: ar ? "'Noto Sans Arabic', 'Lato', Arial, sans-serif" : "'Lato', Arial, sans-serif",
      tt: ar ? 'none' : 'uppercase', ls: ar ? 'normal' : '0.12em', tk: ar ? 'normal' : '-0.02em',
      flip: ar ? 'scaleX(-1)' : 'none',
      lhC: ar ? 1.7 : 1.5, lhL: ar ? 1.63 : 1.43, lhB: ar ? 1.7 : 1.5, lhT: ar ? 1.5 : 1.3,
      lh2: ar ? 1.4 : 1.2, lh1: ar ? 1.3 : 1.1, lh0: ar ? 1.25 : 1.05,
      sw: { en: lang === 'en' ? on : off, ar: lang === 'ar' ? on : off, es: lang === 'es' ? on : off },
      pEn: lang === 'en', pAr: lang === 'ar', pEs: lang === 'es',
      setEn: () => this.setState({ lang: 'en' }),
      setAr: () => this.setState({ lang: 'ar' }),
      setEs: () => this.setState({ lang: 'es' }),
    };
  }
}
</script>
</body>
</html>
`.replace('__SWITCH__', showSwitch ? switchMarkupFor(dict) : '');
}

// The switch markup needs its aria-label key; register once through the dictionary handed in.
function switchMarkupFor() {
  return `<div style="display:flex;align-items:center;gap:8px" role="group" aria-label="EN AR ES">
<button type="button" onClick="{{setEn}}" aria-pressed="{{pEn}}" style="{{sw.en}}">EN</button>
<button type="button" onClick="{{setAr}}" aria-pressed="{{pAr}}" style="{{sw.ar}}">AR</button>
<button type="button" onClick="{{setEs}}" aria-pressed="{{pEs}}" style="{{sw.es}}">ES</button></div>`;
}

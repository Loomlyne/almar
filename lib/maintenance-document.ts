// Plan 02-06: the page every public address shows while maintenance is saved on (02-UI-SPEC "Maintenance page",
// pictures signed 2026-10-13). Static HTML with no script, like the branded 404: the build writes it over every public
// page (scripts/assemble-cloudflare.mjs) and the public Worker answers /login, /account and /bookings with it
// (middleware.ts). The ops host never shows it and it never links there.
//
// Phone and email are the existing contact details, as real links (D-111). No form, no button, no WhatsApp, no Sign in.
// Language stays (three plain links, so the line can translate); currency is not shown: there is no price on this page,
// so a currency control would do nothing (C-18).
//
// Fonts: the build copies Questa and Lato to /brand/ (BRAND_FILES in lib/site-settings.ts); Arabic falls back to the
// system's Arabic face (no third-party font request on this page).
//
// A leaf module (no imports): the assembler, the middleware and the node tests load it directly.

export type MaintenanceLocale = "en" | "ar" | "es";

type MaintenanceCopy = { title: string; line: string; skip: string; languages: string };

/** The line is the 02-UI-SPEC string table's (UAT-correctable); title and languages label are drafts for the owner. */
export const MAINTENANCE_COPY: Record<MaintenanceLocale, MaintenanceCopy> = {
  en: {
    title: "ALMAR Private Journey",
    line: "ALMAR Private Journey is closed for a short time.",
    skip: "Skip to content",
    languages: "Language",
  },
  ar: {
    title: "ALMAR Private Journey",
    line: "ALMAR Private Journey مغلقة لوقت قصير.",
    skip: "تخطي إلى المحتوى",
    languages: "اللغة",
  },
  es: {
    title: "ALMAR Private Journey",
    line: "ALMAR Private Journey está cerrado por un momento.",
    skip: "Saltar al contenido",
    languages: "Idioma",
  },
};

export const MAINTENANCE_PHONE = { label: "+971 56 388 3302", href: "tel:+971563883302" } as const;
export const MAINTENANCE_EMAIL = { label: "inquiries@almarprivatejourney.com", href: "mailto:inquiries@almarprivatejourney.com" } as const;

const LANGUAGES: { locale: MaintenanceLocale; name: string; href: string }[] = [
  { locale: "en", name: "English", href: "/" },
  { locale: "ar", name: "العربية", href: "/ar/" },
  { locale: "es", name: "Español", href: "/es/" },
];

const FACE: Record<MaintenanceLocale, { display: string; body: string }> = {
  en: { display: "Questa, Georgia, serif", body: "Lato, Arial, sans-serif" },
  es: { display: "Questa, Georgia, serif", body: "Lato, Arial, sans-serif" },
  ar: { display: '"Noto Naskh Arabic", "Geeza Pro", Georgia, serif', body: '"Noto Sans Arabic", "Geeza Pro", Arial, sans-serif' },
};

const SAFE_PATH = /^\/brand\/[a-z]+\.(svg|webp|png|jpg)$/;
const SAFE_STYLE = /^(<style id="almar-brand">:root\{[^<]*\}<\/style>)?$/;

/**
 * The closed page for one locale. `logoSrc` is a same-origin /brand/ file (lib/site-settings.ts logoPath); `brandStyle`
 * is lib/site-settings.ts brandStyle() output, so the saved colours apply here too.
 */
export function renderMaintenancePage(locale: MaintenanceLocale, { logoSrc, brandStyle = "" }: { logoSrc: string; brandStyle?: string }): string {
  if (!SAFE_PATH.test(logoSrc)) throw new Error(`renderMaintenancePage: refusing logo ${JSON.stringify(logoSrc)}`);
  if (!SAFE_STYLE.test(brandStyle)) throw new Error("renderMaintenancePage: refusing the brand style");
  const copy = MAINTENANCE_COPY[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const face = FACE[locale];
  const languages = LANGUAGES.map(
    (l) =>
      `<a href="${l.href}" lang="${l.locale}"${l.locale === locale ? ' aria-current="true"' : ""}>${l.name}</a>`,
  ).join("");
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${copy.title}</title>
<style>
  @font-face { font-family: Questa; src: url("/brand/questa.woff") format("woff"); font-weight: 400; font-display: swap; }
  @font-face { font-family: Lato; src: url("/brand/lato.ttf") format("truetype"); font-weight: 400; font-display: swap; }
  :root { --color-teal: #1f3b40; --color-ink: #262626; --color-gold: #d4ba8a; --color-ivory: #fffaf0; --color-surface: #ffffff; }
  * { box-sizing: border-box; border-radius: 0; }
  body { margin: 0; background: var(--color-ivory); color: var(--color-ink); font: 16px/1.5 ${face.body}; }
  a { color: var(--color-teal); text-decoration: underline; text-decoration-color: var(--color-gold); text-underline-offset: 4px; }
  .skip { position: absolute; inset-inline-start: 16px; top: 8px; padding: 8px; background: var(--color-surface); }
  .skip:not(:focus) { clip-path: inset(50%); width: 1px; height: 1px; overflow: hidden; white-space: nowrap; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; flex-wrap: wrap; }
  header img { display: block; width: 112px; height: 56px; object-fit: contain; object-position: left; }
  html[dir="rtl"] header img { object-position: right; }
  nav { display: flex; gap: 4px; font-size: 14px; }
  nav a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 8px; text-decoration: none; }
  nav a[aria-current] { text-decoration: underline; text-decoration-color: var(--color-gold); }
  main { min-height: calc(100vh - 200px); display: grid; place-items: center; padding: 32px 16px 64px; }
  .inner { max-width: 640px; width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 24px; }
  h1 { margin: 0; font: 400 32px/1.2 ${face.display}; color: var(--color-teal); text-wrap: balance; }
  html[lang="ar"] h1 { line-height: 1.4; }
  .rule { width: 64px; height: 1px; background: var(--color-gold); }
  .contact { display: flex; flex-direction: column; gap: 8px; align-items: center; }
  .contact a { display: inline-flex; align-items: center; min-height: 44px; }
  .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  @media (min-width: 768px) { header { padding: 24px 32px; } header img { width: 140px; height: 70px; } .contact { flex-direction: row; gap: 32px; } }
  @media (min-width: 1280px) { header { padding: 24px 64px; } }
  :focus-visible { outline: 2px solid var(--color-teal); outline-offset: 2px; }
</style>
${brandStyle}
</head>
<body>
<a class="skip" href="#content">${copy.skip}</a>
<header>
<img src="${logoSrc}" alt="ALMAR Private Journey">
<nav aria-label="${copy.languages}">${languages}</nav>
</header>
<main id="content">
<div class="inner">
<h1>${copy.line}</h1>
<span class="rule" aria-hidden="true"></span>
<div class="contact">
<a class="num" href="${MAINTENANCE_PHONE.href}">${MAINTENANCE_PHONE.label}</a>
<a href="${MAINTENANCE_EMAIL.href}">${MAINTENANCE_EMAIL.label}</a>
</div>
</div>
</main>
</body>
</html>`;
}

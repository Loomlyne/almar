import { readFileSync } from "node:fs";
import path from "node:path";

function slice(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) {
    throw new Error(`Hero booker CSS markers missing: ${start} … ${end}`);
  }
  return source.slice(from, to);
}

let cached: string | null = null;

export function heroBookerStyle() {
  if (cached) return cached;

  const source = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
  const calendar = slice(source, ".calendar-bar {", "/* Comment 31. Date range");
  const calendarKit = slice(source, ":is(.kit-section:not(#date-range)) .calendar,", ".calendar-month {");
  const search = slice(source, "/* hero-search: comment 11 search bar.", "/* Add-on only (comment 14).");
  const iconButton = slice(source, ".icon-button {", ".toast-stack {");

  cached = `
@font-face {
  font-family: "ALMAR Lato";
  src: url("/embed/font/Lato-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "ALMAR Lato";
  src: url("/embed/font/Lato-Bold.ttf") format("truetype");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* Comment 7. Booking bar replaces the hero's Design your journey control.
   Do not hide the Framer nav — that is the header, a sibling comment. */
[data-framer-name="Hero Section"] {
  overflow: visible !important;
  z-index: 8 !important;
}
[data-framer-name="Hero Section"] a.framer-1wdb5js {
  display: none !important;
}
#almar-hero-booker {
  box-sizing: border-box;
  position: relative;
  z-index: 4;
  width: 80%;
  max-width: 80%;
  min-width: 0;
  align-self: center;
  margin: 0;
  border-radius: 0;
  --color-teal: #1f3b40;
  --color-charcoal: #262626;
  --color-gold: #d4ba8a;
  --color-ivory: #fffaf0;
  --color-white: #ffffff;
  --color-error: #8f2d2d;
  --color-success: #1e6b45;
  --color-warning: #8a3b12;
  --color-muted: #63615f;
  --color-accent-hover: #c6ae82;
  --color-accent-press: #b8a27a;
  --color-bg: var(--color-ivory);
  --color-surface: var(--color-white);
  --color-fg: var(--color-charcoal);
  --color-heading: var(--color-teal);
  --color-link: var(--color-teal);
  --color-link-hover: var(--color-gold);
  --color-accent: var(--color-gold);
  --color-focus: var(--color-teal);
  --color-danger: var(--color-error);
  --color-border: var(--color-charcoal);
  --color-muted-fg: var(--color-muted);
  --font-lato: "ALMAR Lato", Arial, sans-serif;
  --font-questa: Georgia, serif;
  --font-display: var(--font-questa), Georgia, serif;
  --font-body: var(--font-lato), Arial, sans-serif;
  --shadow-overlay: 0 16px 40px rgb(38 38 38 / 0.12);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --radius-control: 0;
  --radius-overlay: 0;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --text-body: 16px;
  --text-label: 14px;
  color: #262626;
  font-family: var(--font-lato), Arial, sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
#almar-hero-booker .kit-section {
  display: block;
  margin: 0;
  padding: 0;
  border-radius: 0;
}
#almar-hero-booker :focus-visible {
  outline: 2px solid #1f3b40;
  outline-offset: 2px;
}
@media (forced-colors: active) {
  #almar-hero-booker :focus-visible {
    outline: 2px solid CanvasText;
    outline-offset: 2px;
  }
}

@scope (#almar-hero-booker) {
  ${iconButton}
  .icon-back,
  .icon-forward { display: inline-flex; }
  .icon-back { transform: scaleX(-1); }
  [dir="rtl"] .icon-forward { transform: scaleX(-1); }
  [dir="rtl"] .icon-back { transform: none; }
  ${calendar}
  ${calendarKit}
  ${search}
}

`

  return cached;
}

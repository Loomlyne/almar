// AR and ES reviewed and corrected 2026-10-05 (controller-delegated review): .planning/phases/03.3-public-site-in-react/I18N-REVIEW-2026-10-05.md
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Locale } from "./locale-path";

type NotFoundCopy = {
  title: string;
  heading: string;
  linkLabel: string;
  href: string;
  /** "draft" strings are proposed translations, waiting for the owner's review. */
  status: "published" | "draft";
};

export const NOT_FOUND_COPY: Record<Locale, NotFoundCopy> = {
  en: { title: "Page not found | ALMAR", heading: "Page not found", linkLabel: "Return home", href: "/", status: "published" },
  ar: {
    title: "الصفحة غير موجودة | ALMAR",
    heading: "الصفحة غير موجودة",
    linkLabel: "العودة إلى الصفحة الرئيسية",
    href: "/ar/",
    status: "published",
  },
  es: {
    title: "Página no encontrada | ALMAR",
    heading: "Página no encontrada",
    linkLabel: "Volver al inicio",
    href: "/es/",
    status: "published",
  },
};

export const NOT_FOUND_TITLE = NOT_FOUND_COPY.en.title;
export const NOT_FOUND_HEADING = NOT_FOUND_COPY.en.heading;
export const NOT_FOUND_LINK_LABEL = NOT_FOUND_COPY.en.linkLabel;
export const NOT_FOUND_HREF = NOT_FOUND_COPY.en.href;
export const MONOGRAM_FILE = "brand/Logo Monogram/Curves_black.svg";

const FONT_STACK: Record<Locale, string> = {
  en: "Georgia, serif",
  es: "Georgia, serif",
  ar: '"Noto Naskh Arabic", "Geeza Pro", "Times New Roman", serif',
};

/**
 * The branded 404 for one locale. Static HTML with no script: Cloudflare serves the nearest 404.html up the
 * tree, so out/404.html, out/ar/404.html and out/es/404.html each answer in their own language and direction.
 * `homeHref` lets the assembler fall back to "/" when a locale home was not built.
 */
export function renderStaticNotFound(locale: Locale = "en", homeHref: string = NOT_FOUND_COPY[locale].href) {
  const copy = NOT_FOUND_COPY[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const svg = readFileSync(join(process.cwd(), MONOGRAM_FILE), "utf8")
    .replace(/<\?xml[\s\S]*?\?>/, "")
    .replace(/<!DOCTYPE[\s\S]*?>/, "");

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${copy.title}</title>
<style>
  body { margin: 0; background: #fffaf0; color: #262626; font-family: ${FONT_STACK[locale]}; }
  main { max-width: 40rem; margin-inline: auto; padding: 4rem 1rem; }
  svg { width: 8rem; height: auto; }
  h1 { font-weight: 400; font-size: 2rem; line-height: 1.1; }
  a { color: #1f3b40; text-decoration: none; }
</style>
</head>
<body>
<main>
<!-- ${MONOGRAM_FILE} -->
${svg}
<h1>${copy.heading}</h1>
<a href="${homeHref}">${copy.linkLabel}</a>
</main>
</body>
</html>`;
}

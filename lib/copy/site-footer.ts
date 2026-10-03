// The public footer's strings: ONE table that every React public page reads (phase 3.3 integration fix f).
// The home, the stays list and the stay page each carried their own copy of these six lines; their Arabic
// drifted apart (three different "opens in a new tab" lines, two copyright lines, two Instagram labels).
//
// Imported directly; not registered in lib/copy/index.ts (reconcile R-9). Literals on purpose, so a plain
// Node test can import the file; tests/site-footer-copy.test.mjs pins each line to its source:
//   pages, contact, language  the lines already approved in lib/copy/home.ts
//   copyright                 the live footer's line, in the canvas dictionary (lib/copy/framer-source.ts)
//   instagram                 the brand name, as the live footer prints it, in every language
//   newTab                    DRAFTED UI COPY, no live source: the screen-reader suffix of a link that opens a
//                             new tab. The AR and ES wording is a draft for the owner's review.

export type SiteFooterLocale = "en" | "ar" | "es";

export type SiteFooterCopy = {
  /** Heading of the pages column and name of that navigation. */
  pages: string;
  /** Heading of the contact column. */
  contact: string;
  /** Label of the Instagram link. */
  instagram: string;
  /** Screen-reader suffix for a link that opens in a new tab. */
  newTab: string;
  /** Accessible name of the language row. */
  language: string;
  /** The copyright line. */
  copyright: string;
};

export const SITE_FOOTER_COPY: Record<SiteFooterLocale, SiteFooterCopy> = {
  en: {
    pages: "Pages",
    contact: "Contact",
    instagram: "Instagram",
    newTab: "(opens in a new tab)",
    language: "Language",
    copyright: "© 2026 ALMAR Private Journeys. All rights reserved.",
  },
  ar: {
    pages: "الصفحات",
    contact: "تواصل",
    instagram: "Instagram",
    newTab: "(يفتح في تبويب جديد)",
    language: "اللغة",
    copyright: "© 2026 المار للرحلات الخاصة. كل الحقوق محفوظة.",
  },
  es: {
    pages: "Páginas",
    contact: "Contacto",
    instagram: "Instagram",
    newTab: "(se abre en una pestaña nueva)",
    language: "Idioma",
    copyright: "© 2026 ALMAR Private Journeys. Todos los derechos reservados.",
  },
};

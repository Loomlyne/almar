// AR and ES reviewed and corrected 2026-10-05 (controller-delegated review): .planning/phases/03.3-public-site-in-react/I18N-REVIEW-2026-10-05.md
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
//   brand, madeBy (plan 41)   brand is the wordmark's alt text; madeBy is the "Made by" label before the studio's name.
//                             EN is the live footer's wording ("Made by"); the AR and ES values of both keys are
//                             DRAFTS for the owner's review. The name "Koussay" and https://koussay.com are
//                             constants in components/site/public-frame.tsx, not copy.
//   newsletter (plan 27)      the footer newsletter's strings, signed by the owner on 2026-10-14 (s3-pictures/
//                             partb-states.json, n_* keys and `sending`), copied here as literals (no value import:
//                             the footer is a client component and a value import would ship whole tables):
//                               title, email           = lib/copy/home.ts newsletter, email
//                               invalid                = lib/copy/home.ts emailError in EN and AR; ES is the signed tú line
//                               description            = the live line in lib/copy/framer-source.ts in EN and AR; ES is
//                                                        the signed tú line ("en tu bandeja de entrada")
//                               subscribe              = lib/copy/framer-source.ts "Join the List"
//                               dismiss                = lib/copy/framer-source.ts "Close" (the toast's close button)
//                               sending, success, failed  signed new lines (the busy button, the toast, the failed line)
//                             No consent or privacy line (owner: Phase 6).

export type SiteFooterLocale = "en" | "ar" | "es";

/** The footer newsletter (plan 27): every line the column, its toast and its failed state show. */
export type SiteFooterNewsletterCopy = {
  /** The column heading. */
  title: string;
  /** The line under the heading. */
  description: string;
  /** The email box's label. */
  email: string;
  /** The submit button. */
  subscribe: string;
  /** The submit button's label while the post is on its way. */
  sending: string;
  /** The line for an address that is not one. */
  invalid: string;
  /** The toast after the handler stored the address. */
  success: string;
  /** The line when it did not. */
  failed: string;
  /** The toast's close button. */
  dismiss: string;
};

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
  /** The wordmark's alt text. */
  brand: string;
  /** The label before the studio's name: "Made by". */
  madeBy: string;
  /** The footer newsletter (plan 27). */
  newsletter: SiteFooterNewsletterCopy;
};

export const SITE_FOOTER_COPY: Record<SiteFooterLocale, SiteFooterCopy> = {
  en: {
    pages: "Pages",
    contact: "Contact",
    instagram: "Instagram",
    newTab: "(opens in a new tab)",
    language: "Language",
    copyright: "© 2026 ALMAR Private Journeys. All rights reserved.",
    brand: "ALMAR Private Journeys",
    madeBy: "Made by",
    newsletter: {
      title: "Newsletter",
      description: "Private Colombia inspiration, delivered to your inbox.",
      email: "Email",
      subscribe: "Join the List",
      sending: "Sending…",
      invalid: "Enter an email as name@example.com.",
      success: "You're on the list.",
      failed: "You were not added. Please try again, or write to inquiries@almarprivatejourney.com.",
      dismiss: "Close",
    },
  },
  ar: {
    pages: "الصفحات",
    contact: "تواصل",
    instagram: "Instagram",
    newTab: "(يفتح في تبويب جديد)",
    language: "اللغة",
    copyright: "© 2026 المار للرحلات الخاصة. كل الحقوق محفوظة.",
    brand: "المار للرحلات الخاصة",
    madeBy: "صُمّم بواسطة",
    newsletter: {
      title: "النشرة",
      description: "إلهام خاص عن كولومبيا، يصل إلى بريدكم.",
      email: "البريد",
      subscribe: "انضموا إلى القائمة",
      sending: "جارٍ الإرسال…",
      invalid: "أدخلوا بريداً بصيغة name@example.com.",
      success: "أنتم على القائمة الآن.",
      failed: "لم تتم إضافتكم. حاولوا مرة أخرى، أو راسلونا على inquiries@almarprivatejourney.com.",
      dismiss: "إغلاق",
    },
  },
  es: {
    pages: "Páginas",
    contact: "Contacto",
    instagram: "Instagram",
    newTab: "(se abre en una pestaña nueva)",
    language: "Idioma",
    copyright: "© 2026 ALMAR Private Journeys. Todos los derechos reservados.",
    brand: "ALMAR Private Journeys",
    madeBy: "Hecho por",
    newsletter: {
      title: "Boletín",
      description: "Inspiración privada sobre Colombia, en tu bandeja de entrada.",
      email: "Correo",
      subscribe: "Unirse a la lista",
      sending: "Enviando…",
      invalid: "Escribe un correo como name@example.com.",
      success: "Ya estás en la lista.",
      failed: "No te agregamos. Inténtalo de nuevo o escribe a inquiries@almarprivatejourney.com.",
      dismiss: "Cerrar",
    },
  },
};

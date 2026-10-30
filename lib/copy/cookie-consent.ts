// Public copy of the cookie banner and its settings sheet (plan 06-04, F-05), EN / AR / ES. Signed by the owner with the
// 06-04 pictures (decisions/2026-10-30-06-04-06-05-06-07-pictures-signed.md), taken verbatim from the signed page: English
// ours, Arabic and Spanish his approved drafts. Button and link labels only: the banner's title, its text and the two
// category texts are the owner's, written in Content -> Legal (F-07), and never appear here.
// Imported directly; not registered in lib/copy/index.ts. Literals on purpose: the banner is a client component.

export type CookieConsentLocale = "en" | "ar" | "es";

export type CookieConsentCopy = {
  acceptAnalytics: string;
  necessaryOnly: string;
  /** The link on the banner, and the title of the settings sheet. */
  settings: string;
  save: string;
  close: string;
  alwaysOn: string;
  privacyLink: string;
};

export const COOKIE_CONSENT_COPY: Record<CookieConsentLocale, CookieConsentCopy> = {
  en: {
    acceptAnalytics: "Accept analytics",
    necessaryOnly: "Necessary only",
    settings: "Cookie settings",
    save: "Save my choice",
    close: "Close",
    alwaysOn: "Always on",
    privacyLink: "Privacy policy",
  },
  ar: {
    acceptAnalytics: "قبول التحليلات",
    necessaryOnly: "الضرورية فقط",
    settings: "إعدادات ملفات الارتباط",
    save: "حفظ اختياري",
    close: "إغلاق",
    alwaysOn: "مفعّلة دائمًا",
    privacyLink: "سياسة الخصوصية",
  },
  es: {
    acceptAnalytics: "Aceptar analítica",
    necessaryOnly: "Solo las necesarias",
    settings: "Ajustes de cookies",
    save: "Guardar mi elección",
    close: "Cerrar",
    alwaysOn: "Siempre activas",
    privacyLink: "Política de privacidad",
  },
};

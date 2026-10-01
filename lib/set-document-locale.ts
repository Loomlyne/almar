import { notoNaskh, notoSans } from "./fonts";

export type DocumentLocale = "en" | "ar" | "es";

const NOTO_CLASSES = `${notoNaskh.variable} ${notoSans.variable}`.split(" ");

export function isDocumentLocale(value: string): value is DocumentLocale {
  return value === "en" || value === "ar" || value === "es";
}

/** Sets documentElement lang and dir. Arabic also loads the existing Noto classes. */
export function setDocumentLocale(locale: DocumentLocale) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = locale === "ar" ? "ar" : locale === "es" ? "es" : "en";
  root.dir = locale === "ar" ? "rtl" : "ltr";
  root.classList.remove(...NOTO_CLASSES);
  if (locale === "ar") root.classList.add(...NOTO_CLASSES);
}

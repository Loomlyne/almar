"use client";

import { useLayoutEffect } from "react";
import { setDocumentLocale, type DocumentLocale } from "../lib/set-document-locale";

/** Puts lang and dir on the html element for a server-rendered page that has no screen state. */
export function DocumentLocale({ locale }: { locale: DocumentLocale }) {
  useLayoutEffect(() => setDocumentLocale(locale), [locale]);
  return null;
}

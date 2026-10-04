import type { ReactNode } from "react";
import "./globals.css";
import { LocaleDocument } from "../components/site/locale-document";
import { HOME_COPY } from "../lib/copy/home";
import { lato, notoNaskh, notoSans, questa } from "../lib/fonts";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <LocaleDocument
      latinFontClass={`${questa.variable} ${lato.variable}`}
      arabicFontClass={`${notoNaskh.variable} ${notoSans.variable}`}
      skipLabels={{ en: HOME_COPY.en.skip, ar: HOME_COPY.ar.skip, es: HOME_COPY.es.skip }}
    >
      {children}
    </LocaleDocument>
  );
}

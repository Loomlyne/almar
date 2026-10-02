"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegments } from "next/navigation";
import { isLocale, localeDir, type Locale } from "../../lib/locale-path";

/**
 * The only <html> and <body> in the app. lang, dir and the Arabic font classes come from the route's first
 * segment, so Arabic is right-to-left in the served HTML from the first paint (design 5.2).
 *
 * Segments, not usePathname(): measured 2026-10-03 on Next 15.5.26, /ar/nope is served by the prerendered
 * _not-found document with lang="en", and usePathname() would set "ar" on the client and mismatch it.
 * The first layout segment is "ar" or "es" only for a real locale route, so served and hydrated agree.
 */
export function LocaleDocument({
  latinFontClass,
  arabicFontClass,
  skipLabels,
  children,
}: {
  latinFontClass: string;
  arabicFontClass: string;
  skipLabels: Record<Locale, string>;
  children: ReactNode;
}) {
  const first = useSelectedLayoutSegments()[0];
  const locale: Locale = isLocale(first) && first !== "en" ? first : "en";
  return (
    <html
      lang={locale}
      dir={localeDir(locale)}
      className={`${latinFontClass} antialiased${locale === "ar" ? ` ${arabicFontClass}` : ""}`}
    >
      <body>
        <a className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-70 focus:bg-teal focus:px-4 focus:py-3 focus:text-ivory" href="#content">
          {skipLabels[locale]}
        </a>
        {children}
      </body>
    </html>
  );
}

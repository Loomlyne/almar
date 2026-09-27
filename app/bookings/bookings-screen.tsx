"use client";

import { useState } from "react";
import { SiteNav } from "../../components/ui/nav";
import { HOME_COPY } from "../../lib/home-copy";
import { setDocumentLocale, type DocumentLocale } from "../../lib/set-document-locale";

const COPY = {
  en: { bookings: "Bookings", noBookingsYet: "No bookings yet", startATrip: "Start a trip" },
  ar: { bookings: "الحجوزات", noBookingsYet: "لا حجوزات بعد", startATrip: "ابدأ رحلة" },
  es: { bookings: "Reservas", noBookingsYet: "Aún no hay reservas", startATrip: "Empezar un viaje" },
} as const;

export function BookingsScreen() {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const copy = COPY[locale];

  function chooseLocale(next: DocumentLocale) {
    setLocale(next);
    setDocumentLocale(next);
  }

  return (
    <>
      <SiteNav
        locale={locale}
        onLocale={chooseLocale}
        labels={HOME_COPY[locale].nav}
        markCurrent={false}
      />
      <main
        id="content"
        style={{
          boxSizing: "border-box",
          maxInlineSize: "var(--width-column)",
          marginInline: "auto",
          paddingBlock: "var(--spacing-2xl)",
          paddingInline: "var(--spacing-lg)",
          display: "grid",
          gap: "var(--spacing-lg)",
          justifyItems: "start",
        }}
      >
        <h1>{copy.bookings}</h1>
        <p style={{ margin: 0, textWrap: "pretty" }}>{copy.noBookingsYet}</p>
        <a
          className="hero-search-submit"
          href="/framer"
          style={{ textDecoration: "none", display: "inline-block" }}
        >
          {copy.startATrip}
        </a>
      </main>
    </>
  );
}

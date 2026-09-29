"use client";

import { useState } from "react";
import { SiteNav } from "../../components/ui/nav";
import { Link } from "../../components/ui/link";
import { WhatsApp } from "../../components/ui/whatsapp";
import { HOME_COPY } from "../../lib/copy/home";
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
        className="mx-auto box-border grid w-full max-w-column justify-items-start gap-6 px-4 py-12 md:px-8 lg:px-16"
      >
        <h1 className="m-0 font-display text-display tracking-display text-teal">{copy.bookings}</h1>
        <p className="m-0 text-pretty text-body text-ink">{copy.noBookingsYet}</p>
        <Link href="/" className="h-control justify-center border border-teal px-6 uppercase tracking-kicker ar:normal-case ar:tracking-normal no-underline hover:bg-teal-tint hover:no-underline">{copy.startATrip}</Link>
      </main>
      <WhatsApp />
    </>
  );
}

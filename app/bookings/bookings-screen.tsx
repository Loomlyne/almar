"use client";

import { useEffect, useState } from "react";
import type { NavAccount } from "../../components/ui/account-menu";
import { GUEST_COPY } from "../../lib/copy/guest";
import { SiteNav } from "../../components/ui/nav";
import { Link } from "../../components/ui/link";
import { WhatsApp } from "../../components/ui/whatsapp";
import { HOME_COPY } from "../../lib/copy/home";
import { setDocumentLocale, type DocumentLocale } from "../../lib/set-document-locale";


export function BookingsScreen({ initialLocale, account }: { initialLocale: DocumentLocale; account: NavAccount }) {
  const [locale, setLocale] = useState<DocumentLocale>(initialLocale);
  const copy = GUEST_COPY[locale];

  useEffect(() => setDocumentLocale(locale), [locale]);

  function chooseLocale(next: DocumentLocale) {
    setLocale(next);
    setDocumentLocale(next);
  }

  return (
    <>
      <SiteNav
        locale={locale}
        onLocale={chooseLocale}
        labels={{ ...HOME_COPY[locale].nav, bookings: copy.bookings, account: copy.account, signOut: copy.signOut, profile: copy.hub.profile, preferences: copy.hub.preferences, accountMenu: copy.hub.menuLabel }}
        loginHref="/login"
        markCurrent={false}
        account={account}
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

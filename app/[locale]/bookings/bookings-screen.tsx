"use client";

import type { NavAccount } from "../../../components/ui/account-menu";
import { GUEST_COPY } from "../../../lib/copy/guest";
import { pageLinks } from "../../../components/site/page-links";
import { SiteNav } from "../../../components/ui/nav";
import { Link } from "../../../components/ui/link";
import { WhatsApp } from "../../../components/ui/whatsapp";
import { HOME_COPY } from "../../../lib/copy/home";
import type { DocumentLocale } from "../../../lib/set-document-locale";
import { localePath } from "../../../lib/locale-path";
import { goToLocale } from "../../../components/site/locale-navigation";
import { postPreferences } from "../../../components/site/account-sync";


export function BookingsScreen({ initialLocale, account }: { initialLocale: DocumentLocale; account: NavAccount }) {
  const locale = initialLocale;
  const copy = GUEST_COPY[locale];

  // Job 21: the language is the address (/<locale>/bookings); a pick opens the page in that language and is offered to
  // her account, like a public pick.
  function chooseLocale(next: DocumentLocale) {
    postPreferences({ locale: next });
    goToLocale(next);
  }

  return (
    <>
      <SiteNav
        locale={locale}
        onLocale={chooseLocale}
        labels={{ ...HOME_COPY[locale].nav, bookings: copy.bookings, account: copy.account, signOut: copy.signOut, profile: copy.hub.profile, preferences: copy.hub.preferences, accountMenu: copy.hub.menuLabel }}
        links={pageLinks(locale, HOME_COPY[locale].nav)}
        currency={false}
        loginHref={localePath(locale, "/login")}
        markCurrent={false}
        account={account}
      />
      <main
        id="content"
        className="mx-auto box-border grid w-full max-w-column justify-items-start gap-6 px-4 py-12 md:px-8 lg:px-16"
      >
        <h1 className="m-0 font-display text-display tracking-display text-teal">{copy.bookings}</h1>
        <p className="m-0 text-pretty text-body text-ink">{copy.noBookingsYet}</p>
        <Link href={localePath(locale, "/")} className="h-control justify-center border border-teal px-6 uppercase tracking-kicker ar:normal-case ar:tracking-normal no-underline hover:bg-teal-tint hover:no-underline">{copy.startATrip}</Link>
      </main>
      <WhatsApp />
    </>
  );
}

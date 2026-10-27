"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { NavAccount } from "../../../components/ui/account-menu";
import { GUEST_COPY } from "../../../lib/copy/guest";
import { GUEST_BOOKINGS_COPY } from "../../../lib/copy/guest-bookings";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { pageLinks } from "../../../components/site/page-links";
import { SiteNav } from "../../../components/ui/nav";
import { Link } from "../../../components/ui/link";
import { Button, LinkButton } from "../../../components/ui/button";
import { WhatsApp } from "../../../components/ui/whatsapp";
import { HOME_COPY } from "../../../lib/copy/home";
import type { DocumentLocale } from "../../../lib/set-document-locale";
import { localeDir, localePath } from "../../../lib/locale-path";
import { goToLocale } from "../../../components/site/locale-navigation";
import { postPreferences } from "../../../components/site/account-sync";
// Type only: guest-list.ts imports server code, and only a type import is erased from the client bundle.
import type { GuestCard } from "../../../lib/booking/guest-list";

// Plan 04-06 (signed 2026-10-27, pictures/04-06/index.html): the signed-in guest's bookings in tabs Upcoming / Past /
// Cancelled. Presentational: the page reads the cards; null means they could not be read. P6-07 option 1: a Paid line
// on cards with a payment. Not drawn (P6-10): summary tiles, search, countdown, Pay balance, add-ons, cancellation.

type Tab = GuestCard["tab"];

const TABS: readonly Tab[] = ["upcoming", "past", "cancelled"];
const EMPTY_KEY = { upcoming: "emptyUpcoming", past: "emptyPast", cancelled: "emptyCancelled" } as const;
const PANEL_ID = "bookings-panel";
const tabId = (tab: Tab) => `bookings-tab-${tab}`;

/** Fills `{slot}`s with nodes (a day or a time in <bdi dir="ltr">); unknown slots stay as written. */
function fillNodes(template: string, values: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key !== undefined && key in values ? <span key={i}>{values[key]}</span> : part;
  });
}

const Ltr = ({ children }: { children: ReactNode }) => <bdi dir="ltr">{children}</bdi>;

export function BookingsScreen({
  initialLocale,
  account,
  cards,
}: {
  initialLocale: DocumentLocale;
  account: NavAccount;
  cards: GuestCard[] | null;
}) {
  const locale = initialLocale;
  const copy = GUEST_COPY[locale];
  const router = useRouter();

  // Job 21: the language is the address (/<locale>/bookings); a pick opens the page in that language and is offered to
  // her account, like a public pick.
  function chooseLocale(next: DocumentLocale) {
    postPreferences({ locale: next });
    goToLocale(next);
  }

  let body: ReactNode;
  if (cards === null) {
    body = (
      <>
        <p className="m-0 text-pretty text-body text-ink">{GUEST_BOOKINGS_COPY[locale].loadFailed}</p>
        <Button variant="secondary" onClick={() => router.refresh()}>
          {GUEST_BOOKINGS_COPY[locale].tryAgain}
        </Button>
      </>
    );
  } else if (cards.length === 0) {
    body = (
      <>
        <p className="m-0 text-pretty text-body text-ink">{copy.noBookingsYet}</p>
        <Link href={localePath(locale, "/")} className="h-control justify-center border border-teal px-6 uppercase tracking-kicker ar:normal-case ar:tracking-normal no-underline hover:bg-teal-tint hover:no-underline">{copy.startATrip}</Link>
      </>
    );
  } else {
    body = <BookingTabs locale={locale} cards={cards} />;
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
        {body}
      </main>
      <WhatsApp />
    </>
  );
}

function BookingTabs({ locale, cards }: { locale: DocumentLocale; cards: GuestCard[] }) {
  const list = GUEST_BOOKINGS_COPY[locale];
  const [selected, setSelected] = useState<Tab>("upcoming");
  const shown = cards.filter((card) => card.tab === selected);

  function select(tab: Tab, focus: boolean) {
    setSelected(tab);
    if (focus) document.getElementById(tabId(tab))?.focus();
  }

  // Arrow keys move between the tabs (and select, as a click does), mirrored in Arabic; Home and End jump to the ends.
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const at = TABS.indexOf(selected);
    const rtl = localeDir(locale) === "rtl";
    let next: number | null = null;
    if (event.key === "ArrowRight") next = rtl ? at - 1 : at + 1;
    else if (event.key === "ArrowLeft") next = rtl ? at + 1 : at - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(TABS[(next + TABS.length) % TABS.length], true);
  }

  return (
    <>
      <div role="tablist" aria-label={list.tabsLabel} className="flex w-full gap-2 border-b border-line">
        {TABS.map((tab) => {
          const on = tab === selected;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={tabId(tab)}
              aria-selected={on}
              aria-controls={PANEL_ID}
              tabIndex={on ? 0 : -1}
              onClick={() => select(tab, false)}
              onKeyDown={onKeyDown}
              className={
                on
                  ? "-mb-px inline-flex h-control cursor-pointer items-center rounded-none border-0 border-b-2 border-solid border-gold bg-transparent px-3 font-body text-label uppercase tracking-kicker text-teal ar:normal-case ar:tracking-normal"
                  : "-mb-px inline-flex h-control cursor-pointer items-center rounded-none border-0 border-b-2 border-solid border-transparent bg-transparent px-3 font-body text-label uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal"
              }
            >
              {list[tab]}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(selected)}
        tabIndex={shown.length === 0 ? 0 : undefined}
        className="flex w-full flex-col gap-4"
      >
        {shown.length === 0 ? (
          <p className="m-0 text-body text-muted">{list[EMPTY_KEY[selected]]}</p>
        ) : (
          shown.map((card) => <BookingCard key={card.reference} locale={locale} card={card} />)
        )}
      </div>
    </>
  );
}

function BookingCard({ locale, card }: { locale: DocumentLocale; card: GuestCard }) {
  const list = GUEST_BOOKINGS_COPY[locale];
  const status = JOURNEY_COPY[locale].bookingStatus;
  return (
    <article className="grid grid-cols-1 border border-line bg-surface md:grid-cols-3">
      <div className="relative aspect-video md:aspect-auto">
        {card.image ? (
          <img src={card.image.src} alt={card.image.alt} className="absolute inset-0 block h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-teal-tint" />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2 p-4 md:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-chip-dense shrink-0 items-center whitespace-nowrap rounded-none border border-teal px-2 font-body text-caption text-teal">
            {status[card.status]}
          </span>
          <span className="text-label text-ink">
            <span className="sr-only">{list.reference} </span>
            <Ltr>{card.reference}</Ltr>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-title font-normal text-teal">{card.title}</h2>
          <p className="m-0 text-label text-muted">{card.place}</p>
        </div>
        <p className="m-0 text-label text-ink">
          <Ltr>{card.dates}</Ltr>
        </p>
        <dl className="m-0 grid auto-cols-max gap-x-4 gap-y-1 border-t border-line pt-2 text-label tabular-nums">
          <dt className="col-start-1 text-muted">{list.total}</dt>
          <dd className="col-start-2 m-0 text-ink">
            <Ltr>{card.total}</Ltr>
          </dd>
          {typeof card.paid === "string" ? (
            <>
              <dt className="col-start-1 text-muted">{list.paid}</dt>
              <dd className="col-start-2 m-0 text-ink">
                <Ltr>{card.paid}</Ltr>
              </dd>
            </>
          ) : null}
          {card.stillDue ? (
            <>
              <dt className="col-start-1 text-muted">{list.stillDue}</dt>
              <dd className="col-start-2 m-0 text-ink">
                <Ltr>{card.stillDue}</Ltr>
              </dd>
            </>
          ) : (
            <dd className="col-span-2 col-start-1 m-0 text-ink">{list.nothingDue}</dd>
          )}
        </dl>
        {card.payBy ? (
          <p className="m-0 text-label text-ink">
            {fillNodes(status.payBy, { date: <Ltr>{card.payBy.date}</Ltr>, time: <Ltr>{card.payBy.time}</Ltr> })}
          </p>
        ) : null}
        <div className="pt-2">
          <LinkButton href={card.href}>{list.viewTrip}</LinkButton>
        </div>
      </div>
    </article>
  );
}

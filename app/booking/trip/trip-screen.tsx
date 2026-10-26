"use client";

// Plan 04-03 (signed 2026-10-25, Q-01 = B): /en|ar|es/booking/trip. A static page in the site's frame that talks only
// to POST /api/booking/quote (and, for the hold, /hold and /release through lib/booking/client.ts). The query is read
// in the browser (useSearchParams under Suspense); a link that is not exactly the six keys is the bad-link line. Every
// amount is a field of the server's answer, formatted by formatAed: nothing is computed here (D-52). The trip's
// inputs live in this tab's sessionStorage through lib/booking/trip-state.ts (Q-07); the link token never reaches a
// URL. No currency control (Q-03): every amount is AED.

import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { parseDate } from "@internationalized/date";
import { AddonsStep } from "../../../components/journey/addons-step";
import { JourneyCart } from "../../../components/journey/journey-cart";
import { StaySummaryStep } from "../../../components/journey/stay-summary-step";
import { TravellersStep } from "../../../components/journey/travellers-step";
import { TripLayout } from "../../../components/journey/trip-layout";
import type { StepNumber } from "../../../components/journey/step-rail";
import type { AddOnItem, CartLine } from "../../../components/journey/types";
import { PublicFrame, type PublicFrameLink } from "../../../components/site/public-frame";
import { Link } from "../../../components/ui/link";
import { PageShell } from "../../../components/ui/page-shell";
import { postQuote } from "../../../lib/booking/client";
import { formatBp, formatIsoDate } from "../../../lib/booking/trip-format";
import { TRIP_PATH, parseTripQuery, secondCityHref, tripLocaleHrefs, type TripQuery } from "../../../lib/booking/trip-link";
import {
  displayBreakdown,
  loadTripState,
  quoteBody,
  tripNeedsPickup,
  tripReducer,
  writeTripState,
  type TripState,
} from "../../../lib/booking/trip-state";
import { HOME_COPY } from "../../../lib/copy/home";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { SITE_FOOTER_COPY } from "../../../lib/copy/site-footer";
import { fill, formatGuestSummary } from "../../../lib/journey-format";
import { localeHrefs, localePath, siteHref, type Locale } from "../../../lib/locale-path";
import { formatAed } from "../../../lib/money/format";
import { stayRequestHref } from "../../../lib/whatsapp-request";

const PAGE_LINKS = [
  { key: "destinations", path: "/destinations" },
  { key: "experiences", path: "/experiences" },
  { key: "about", path: "/about" },
  { key: "contact", path: "/contact" },
] as const;

const NONE = "—";
const QUOTE_DEBOUNCE_MS = 300;

export function TripPage({ locale }: { locale: Locale }) {
  const nav = HOME_COPY[locale].nav;
  const copy = JOURNEY_COPY[locale];
  const pageLinks: PublicFrameLink[] = PAGE_LINKS.map(({ key, path }) => ({ label: nav[key], href: siteHref(locale, path) }));
  // The language control keeps the trip: the frame mounts once and takes the query's addresses when they are known.
  const [hrefs, setHrefs] = useState<Record<Locale, string>>(() => localeHrefs(TRIP_PATH));
  const onQuery = useCallback((q: TripQuery | null) => setHrefs(q ? tripLocaleHrefs(q) : localeHrefs(TRIP_PATH)), []);

  return (
    <PublicFrame
      locale={locale}
      currentPath={TRIP_PATH}
      localeHrefs={hrefs}
      links={pageLinks}
      footerLinks={pageLinks}
      footerCopy={SITE_FOOTER_COPY[locale]}
      labels={nav}
      whatsappClassName="bottom-dock md:bottom-4"
    >
      <main id="content">
        <PageShell className="py-12">
          <Suspense
            fallback={
              <div className="flex flex-col gap-6">
                <h1 className="m-0 font-display text-heading text-teal">{copy.trip.title}</h1>
                <p className="m-0 text-label text-muted">{copy.trip.loading}</p>
              </div>
            }
          >
            <TripScreen locale={locale} onQuery={onQuery} />
          </Suspense>
        </PageShell>
      </main>
    </PublicFrame>
  );
}

function TripScreen({ locale, onQuery }: { locale: Locale; onQuery: (q: TripQuery | null) => void }) {
  const params = useSearchParams();
  const search = params.toString();
  const query = useMemo(() => parseTripQuery(new URLSearchParams(search)), [search]);
  useEffect(() => onQuery(query), [query, onQuery]);
  const copy = JOURNEY_COPY[locale];

  if (!query) {
    return (
      <div className="flex flex-col items-start gap-6">
        <h1 className="m-0 font-display text-heading text-teal">{copy.trip.title}</h1>
        <p role="alert" className="m-0 text-body text-ink">
          {copy.trip.badLink}
        </p>
        <Link href={localePath(locale, "/private-stays")}>{copy.trip.badLinkAction}</Link>
      </div>
    );
  }
  return <Trip key={search} locale={locale} query={query} />;
}

/** Nights between two ISO dates (calendar days; not money). */
function nightsBetween(from: string, to: string): number {
  return parseDate(to).compare(parseDate(from));
}

function Trip({ locale, query }: { locale: Locale; query: TripQuery }) {
  const copy = JOURNEY_COPY[locale];
  const [state, dispatch] = useReducer(tripReducer, query, (q) => loadTripState(q));
  const [quoting, setQuoting] = useState(true);

  // Every change is kept for this tab (inputs and the hold record only; no amount, no terms box).
  useEffect(() => writeTripState(state), [state]);

  // The quote: on mount and on every add-on change, 300 ms debounced, the previous one aborted.
  const stateRef = useRef<TripState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const quoteKey = JSON.stringify(quoteBody(state, locale).addons);
  const firstQuote = useRef(true);
  useEffect(() => {
    const abort = new AbortController();
    setQuoting(true);
    const wait = firstQuote.current ? 0 : QUOTE_DEBOUNCE_MS;
    firstQuote.current = false;
    const timer = window.setTimeout(async () => {
      const answer = await postQuote(quoteBody(stateRef.current, locale), abort.signal);
      if ("aborted" in answer) return;
      dispatch({ type: "quoted", quote: answer });
      setQuoting(false);
    }, wait);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [quoteKey, locale]);

  const quote = state.quote;
  const price = displayBreakdown(state);
  const offers = useMemo(() => quote?.offers ?? [], [quote]);
  const offerName = useCallback((id: string) => offers.find((o) => o.id === id)?.name, [offers]);
  const stay = quote?.stay ?? null;
  const { from, to, adults, children, infants } = query;
  const guests = formatGuestSummary({ adults, children, infants }, locale, copy.guests.summary);
  const dates = `${formatIsoDate(from)} – ${formatIsoDate(to)}`;
  const nights = price?.nightCount ?? nightsBetween(from, to);

  const stayHref = localePath(locale, `/private-stays/${query.stay}`);
  const message = copy.summary.message;
  const whatsappHref = stayRequestHref(
    [
      fill(message.greeting, { title: stay?.title ?? query.stay, destination: stay?.destinationName ?? "" }),
      fill(message.dates, { from: formatIsoDate(from), to: formatIsoDate(to) }),
      ...(state.hold ? [fill(message.ref, { ref: state.hold.ref })] : []),
    ].join("\n"),
  );
  const secondCity = secondCityHref(
    { locale, title: stay?.title ?? query.stay, destinationName: stay?.destinationName ?? "", from, to, ref: state.hold?.ref ?? null },
    message,
  );
  const reasonLinks = { stay: stayHref, whatsapp: whatsappHref, startAgain: stayHref };

  const go = (step: StepNumber) => dispatch({ type: "go", step });
  const canContinue = Boolean(quote?.ok) && !state.closed;

  // ---- the cart, from the server's numbers only
  const lines: CartLine[] = (price?.lines ?? [])
    .filter((l) => l.quantity > 0)
    .map((l) => ({ id: l.id, name: offerName(l.id) ?? "", quantity: l.quantity, amount: formatAed(l.lineFils) }));
  const cartProps = {
    destinationName: stay?.destinationName ?? "",
    stay: {
      image: stay?.image ?? null,
      name: stay?.title ?? "",
      dates,
      guests,
      nights,
      amount: price ? formatAed(price.nightsFils) : NONE,
    },
    lines,
    inclusionsCount: quote?.inclusions.length ?? 0,
    subtotal: price ? formatAed(price.subtotalFils) : NONE,
    vat: price ? formatAed(price.vatFils) : NONE,
    vatLabel: price ? fill(copy.cart.vatRate, { rate: formatBp(price.vatBp) }) : undefined,
    total: price ? formatAed(price.grandFils) : NONE,
    locked: Boolean(state.hold),
    loading: quoting && !price,
    onRemove: (id: string) => dispatch({ type: "setAddon", id, qty: 0 }),
    copy,
    locale,
  };
  const next: Record<StepNumber, () => void> = {
    1: () => go(2),
    2: () => go(3),
    3: () => go(4),
    4: () => undefined,
  };
  const cart = <JourneyCart {...cartProps} onContinue={next[state.step]} variant="rail" className="w-full static md:w-rail md:sticky" />;
  const cartDock =
    state.step < 4 ? (
      <JourneyCart {...cartProps} onContinue={next[state.step]} variant="phone" continueDisabled={state.step === 1 && !canContinue} />
    ) : undefined;

  // ---- the steps
  const items: AddOnItem[] = offers.map((o) => ({
    id: o.id,
    kind: o.kind,
    region: o.isUae ? "uae" : undefined,
    name: o.name,
    image: o.image,
    unit: o.unit,
    price: formatAed(o.priceFils),
  }));

  let body: ReactNode = null;
  if (state.step === 1) {
    body = (
      <div className="flex flex-col gap-4">
        {quote ? null : <p className="m-0 text-label text-muted">{copy.trip.loading}</p>}
        <StaySummaryStep
          stay={stay ? { title: stay.title, destinationName: stay.destinationName, image: stay.image, dates, guests, nights } : null}
          reasons={quote?.reasons ?? []}
          reasonLinks={reasonLinks}
          changeHref={stayHref}
          secondCityHref={secondCity}
          onContinue={() => go(2)}
          continueDisabled={!canContinue}
          copy={copy}
          locale={locale}
        />
      </div>
    );
  } else if (state.step === 2) {
    body = (
      <AddonsStep
        items={items}
        quantities={state.addons}
        onChange={(id, qty) => dispatch({ type: "setAddon", id, qty })}
        guestsTotal={adults + children + infants}
        nights={nights}
        destinationName={stay?.destinationName ?? ""}
        inclusions={quote?.inclusions ?? []}
        loading={!quote}
        onBack={() => go(1)}
        onContinue={() => go(3)}
        copy={copy}
        locale={locale}
      />
    );
  } else {
    body = (
      <TravellersStep
        contact={state.contact}
        onContact={(patch) => dispatch({ type: "contact", patch })}
        bookerStays={state.bookerStays}
        onBookerStays={(stays) => dispatch({ type: "bookerStays", stays })}
        lines={state.travellers}
        onLine={(index, patch) => dispatch({ type: "traveller", index, patch })}
        needsPickup={tripNeedsPickup(state)}
        pickup={state.pickup}
        onPickup={(address) => dispatch({ type: "pickup", address })}
        errors={{}}
        onBack={() => go(2)}
        onContinue={() => go(4)}
        copy={copy}
      />
    );
  }

  return (
    <TripLayout title={copy.trip.title} step={state.step} onStepChange={go} copy={copy} cart={cart} cartDock={cartDock}>
      {body}
    </TripLayout>
  );
}

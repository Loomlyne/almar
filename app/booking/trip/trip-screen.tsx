"use client";

// Plan 04-03 (signed 2026-10-25, Q-01 = B): /en|ar|es/booking/trip. A static page in the site's frame that talks only
// to POST /api/booking/quote (and, for the hold, /hold and /release through lib/booking/client.ts). The query is read
// in the browser (useSearchParams under Suspense); a link that is not exactly the six keys is the bad-link line. Every
// amount is a field of the server's answer, formatted by formatAed: nothing is computed here (D-52). The trip's
// inputs live in this tab's sessionStorage through lib/booking/trip-state.ts (Q-07); the link token never reaches a
// URL. No currency control (Q-03): every amount is AED.
//
// Q-01 = B: deposit or full, the UAE airport and the terms box end Travellers; "Continue to request" checks them with the
// traveller fields, and entering Request without a hold places exactly one hold (the reducer's holdAttempt, guarded by
// a ref). While held the choices, the add-ons and every earlier step are locked: Change asks first, releases the hold,
// then applies the move (Q-08). Nothing re-holds by itself.
//
// Plan 04-06 (signed 2026-10-27): Send request posts `{ ref, t }` once (an in-flight guard plus the request phase of
// lib/booking/after-request.ts), reads the booking back through the view route for the sent state, and shows every
// refusal as a reason with a way on. A stored hold is checked with the server first on load (resume): nothing is
// quoted, held or requested before the view answers, and the stored end or the device clock never decides. The link
// token goes only into the POST bodies and the one booking-page href of the sent state (P6-14).

import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { parseDate } from "@internationalized/date";
import { AddonsStep } from "../../../components/journey/addons-step";
import { JourneyCart } from "../../../components/journey/journey-cart";
import { BookingReasons } from "../../../components/journey/booking-reasons";
import { RequestChoices, RequestStep } from "../../../components/journey/request-step";
import { RequestChecking, RequestElsewhere, RequestRetryNote, RequestSent } from "../../../components/journey/request-sent";
import { StaySummaryStep } from "../../../components/journey/stay-summary-step";
import { TravellersStep } from "../../../components/journey/travellers-step";
import { TripLayout } from "../../../components/journey/trip-layout";
import type { StepNumber } from "../../../components/journey/step-rail";
import type { AddOnItem, CartLine } from "../../../components/journey/types";
import { PublicFrame, type PublicFrameLink } from "../../../components/site/public-frame";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { Link } from "../../../components/ui/link";
import { PageShell } from "../../../components/ui/page-shell";
import {
  INITIAL_REQUEST_PHASE,
  holdEndNow,
  requestOutcome,
  requestPhaseReducer,
  resumeOutcome,
  sentFromRequest,
  type RequestAnswer,
  type RequestPhase,
  type RequestPhaseAction,
} from "../../../lib/booking/after-request";
import { postHold, postQuote, postRelease } from "../../../lib/booking/client";
import { bookingPagePath } from "../../../lib/booking/origin";
import { postRequest, postView } from "../../../lib/booking/request-client";
import { formatBp, formatIsoDate, uaeDateTime, windowParts } from "../../../lib/booking/trip-format";
import { TRIP_PATH, parseTripQuery, secondCityHref, tripLocaleHrefs, type TripQuery } from "../../../lib/booking/trip-link";
import {
  canRequest,
  displayBreakdown,
  holdAnswerIsCurrent,
  holdBody,
  initialTripState,
  quoteBody,
  readTripState,
  requestChoiceErrors,
  travellersErrors,
  tripNeedsPickup,
  tripReducer,
  TRIP_STATE_KEY,
  writeTripState,
  type TripMove,
  type TripState,
} from "../../../lib/booking/trip-state";
import type { BookingTermsLink, SiteLegalChrome } from "../../../lib/data/types";
import { HOME_COPY } from "../../../lib/copy/home";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { SITE_FOOTER_COPY } from "../../../lib/copy/site-footer";
import { fill, formatGuestSummary, formatPlural } from "../../../lib/journey-format";
import { localeHrefs, localePath, siteHref, type Locale } from "../../../lib/locale-path";
import { formatAed } from "../../../lib/money/format";
import { ALMAR_WHATSAPP_NUMBER, stayRequestHref } from "../../../lib/whatsapp-request";

const PAGE_LINKS = [
  { key: "destinations", path: "/destinations" },
  { key: "experiences", path: "/experiences" },
  { key: "about", path: "/about" },
  { key: "contact", path: "/contact" },
] as const;

const NONE = "—";
const QUOTE_DEBOUNCE_MS = 300;
/** The WhatsApp float's chat (components/ui/whatsapp.tsx), for the sent state's help line. */
const HELP_HREF = `https://wa.me/${ALMAR_WHATSAPP_NUMBER}`;
/** A retry and a failed check show this one reason (after-request.ts carries none for them). */
const UNAVAILABLE = [{ code: "unavailable" as const }];

export function TripPage({ locale, legal, termsLink = null }: { locale: Locale; legal?: SiteLegalChrome; termsLink?: BookingTermsLink | null }) {
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
      legal={legal}
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
            <TripScreen locale={locale} onQuery={onQuery} termsLink={termsLink} />
          </Suspense>
        </PageShell>
      </main>
    </PublicFrame>
  );
}

function TripScreen({ locale, onQuery, termsLink }: { locale: Locale; onQuery: (q: TripQuery | null) => void; termsLink: BookingTermsLink | null }) {
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
  return <Trip key={search} locale={locale} query={query} termsLink={termsLink} />;
}

/**
 * The stored trip of this tab as it is, its hold included (readTripState accepts only the exact shape). Unlike
 * loadTripState, a stored hold is never ended here by the stored end and the device clock: the view route decides
 * (resume, plan 04-06 P6-04).
 */
function restoreTrip(query: TripQuery): TripState {
  let text: string | null = null;
  try {
    text = typeof window === "undefined" ? null : window.sessionStorage.getItem(TRIP_STATE_KEY);
  } catch {
    text = null;
  }
  return readTripState(text, query) ?? initialTripState(query);
}

/** The pay-by line: bookingStatus.payBy with the UAE date and time kept left to right. */
function payByLine(template: string, at: { date: string; time: string }): ReactNode {
  return template
    .split(/\{(\w+)\}/g)
    .map((part, i) =>
      i % 2 === 1 ? (
        <bdi key={i} dir="ltr">
          {part === "date" ? at.date : part === "time" ? at.time : `{${part}}`}
        </bdi>
      ) : (
        part
      ),
    );
}

/** uaeDateTime of a deadline after-request.ts passed on (its shape), or null should it still not read. */
function deadlineParts(iso: string | null): { date: string; time: string } | null {
  if (iso === null) return null;
  try {
    return uaeDateTime(iso);
  } catch {
    return null;
  }
}

/** Nights between two ISO dates (calendar days; not money). */
function nightsBetween(from: string, to: string): number {
  return parseDate(to).compare(parseDate(from));
}

function Trip({ locale, query, termsLink }: { locale: Locale; query: TripQuery; termsLink: BookingTermsLink | null }) {
  const copy = JOURNEY_COPY[locale];
  const [state, dispatch] = useReducer(tripReducer, query, restoreTrip);
  // 04-06: the request phase beside the trip. A stored hold starts in `checking` (resume): the view answers first.
  const [phase, dispatchPhase] = useReducer(requestPhaseReducer, state.hold !== null, (stored: boolean) =>
    stored ? requestPhaseReducer(INITIAL_REQUEST_PHASE, { type: "resume" }) : INITIAL_REQUEST_PHASE,
  );
  // The phase as the hold timer's end and the send read it: equal to the current phase on each render, and moved at
  // once by applyPhase (the same pure reducer), so a timer tick between a dispatch and its render reads the new phase.
  const phaseRef = useRef<RequestPhase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const applyPhase = useCallback((action: RequestPhaseAction) => {
    phaseRef.current = requestPhaseReducer(phaseRef.current, action);
    dispatchPhase(action);
  }, []);
  // The stored hold of this load (resume and Check again use it), and the pair the booking-page href is built from:
  // the stored one after a refresh, the pair captured at Send on a fresh request.
  // One send at a time: set before the first await of a send, cleared when it ends (read by Change too).
  const sendingRef = useRef(false);
  const storedHold = useRef(state.hold);
  const [link, setLink] = useState<{ ref: string; t: string } | null>(() => (state.hold ? { ref: state.hold.ref, t: state.hold.linkToken } : null));
  // The server's end of a resumed hold (the view's holdExpiresAt), shown instead of the stored one. Keyed by the ref:
  // it applies to that hold only, never to a later hold placed after a Change (review 2026-10-27, finding 1).
  const [resumedEnd, setResumedEnd] = useState<{ ref: string; endsAt: string } | null>(null);
  const [quoting, setQuoting] = useState(true);
  // A hold refused with a changed price (settings_changed, deposit_unavailable, ...) asks for a fresh quote.
  const [requote, setRequote] = useState(0);
  // Change while held: the move waits for the guest's yes, then the release.
  const [pending, setPending] = useState<TripMove | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [releaseFailed, setReleaseFailed] = useState(false);

  // Every change is kept for this tab (inputs and the hold record only; no amount, no terms box).
  useEffect(() => writeTripState(state), [state]);

  // The quote: on mount and on every add-on change, 300 ms debounced, the previous one aborted.
  const stateRef = useRef<TripState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const quoted = quoteBody(state, locale);
  const quoteKey = JSON.stringify({ addons: quoted.addons, hold: quoted.hold?.ref ?? null, requote });
  const firstQuote = useRef(true);
  // Resume: nothing is quoted before the view of a stored hold answers, and nothing after a sent or moved-on request
  // (the cart keeps the booking's own numbers; review pass 2, finding 2).
  const checking = phase.kind === "checking" || phase.kind === "sent" || phase.kind === "elsewhere";
  useEffect(() => {
    if (checking) return;
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
  }, [quoteKey, locale, checking]);

  // Q-01 = B: one POST /api/booking/hold per entry into Request (or per retry), never a second for the same attempt.
  // While it is out (state.holdPending) the reducer refuses every input and step move. Each answer is tagged with the
  // attempt it was sent for: a held answer that is no longer current (another attempt, a stored hold, the page gone)
  // is never kept, and its hold is released at once.
  const holdSent = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (state.step !== 4 || state.hold || state.holdPending || state.holdAttempt === 0 || holdSent.current === state.holdAttempt) return;
    const body = holdBody(state, locale);
    if (!body) return;
    const attempt = state.holdAttempt;
    holdSent.current = attempt;
    dispatch({ type: "holdSent", attempt });
    void postHold(body).then(({ status, response }) => {
      const current = alive.current && holdAnswerIsCurrent(stateRef.current, attempt);
      if (response.ok) {
        if (current) dispatch({ type: "held", hold: response, attempt, receivedAtMs: Date.now() });
        else void postRelease({ ref: response.ref, t: response.linkToken });
        return;
      }
      if (!current) return;
      if (status === 503 && response.reasons.some((r) => r.code === "requests_closed")) dispatch({ type: "closed" });
      dispatch({ type: "refused", at: "hold", reasons: response.reasons, attempt });
      if (status === 409 && !response.reasons.some((r) => r.code === "sold_out" || r.code === "blocked")) setRequote((n) => n + 1);
    });
  }, [state, locale]);
  const holdBusy = state.holdPending;

  // Resume (P6-04): one view per check of the stored hold; Check again starts a new check. Held continues 04-03's
  // restore with the server's end; expired or unknown is 04-03's ended; the rest is the phase's.
  const viewFor = useRef<RequestPhase | null>(null);
  useEffect(() => {
    const hold = storedHold.current;
    if (phase.kind !== "checking" || phase.failed || !hold || viewFor.current === phase) return;
    viewFor.current = phase;
    void postView({ ref: hold.ref, t: hold.linkToken, locale }).then(({ status, json }) => {
      if (!alive.current) return;
      // The server's clock (device plus the stored offset), never the raw device clock (review finding 3).
      const outcome = resumeOutcome(status, json, Date.now() + hold.clockOffsetMs);
      if (outcome.kind === "held") setResumedEnd({ ref: hold.ref, endsAt: outcome.holdExpiresAt });
      if (outcome.kind === "ended") dispatch({ type: "ended" });
      applyPhase({ type: "resumed", outcome });
    });
  }, [phase, locale, applyPhase]);

  // Race: the hold timer's end while a request is in flight is held back (the server's answer decides), then applied
  // after a retry, refused or closed answer; a sent or moved-on request clears it.
  const holdEndedWhileSending = useRef(false);
  const onHoldEnd = useCallback(() => {
    if (!holdEndNow(phaseRef.current)) {
      holdEndedWhileSending.current = true;
      return;
    }
    dispatch({ type: "ended" });
  }, []);

  // The countdown's clock is the server's: the device clock plus the offset taken from the hold answer's serverNow.
  // After a resume the end is the view's.
  const liveHold =
    state.hold && resumedEnd && resumedEnd.ref === state.hold.ref ? { ...state.hold, holdExpiresAt: resumedEnd.endsAt } : state.hold;
  const clockOffset = state.hold?.clockOffsetMs ?? 0;
  const holdClock = useMemo(() => () => Date.now() + clockOffset, [clockOffset]);

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

  // A move the hold locks is asked first (Q-08); without a hold it applies at once; while a hold is being placed,
  // nothing moves.
  const move = (m: TripMove) => {
    // Nothing moves while a request is in flight either: every Change (the rail's and the step's) comes through here
    // (review pass 2, finding 1).
    if (state.holdPending || sendingRef.current || phaseRef.current.kind === "sending") return;
    if (state.hold && !(m.type === "go" && m.step === 4)) {
      setReleaseFailed(false);
      setPending(m);
      return;
    }
    dispatch(m);
  };
  const go = (step: StepNumber) => move({ type: "go", step });
  const confirmRelease = async () => {
    const hold = state.hold;
    if (!hold || !pending) return;
    setReleasing(true);
    const answer = await postRelease({ ref: hold.ref, t: hold.linkToken });
    setReleasing(false);
    if (answer.ok) {
      dispatch({ type: "released", next: pending });
    } else {
      setReleaseFailed(true);
    }
    setPending(null);
  };

  // Send request (04-06). One send at a time (sendingRef, set before the first await, plus the phase). The pair is
  // captured before the first await and is the only one this send uses: the hold can end or be cleared meanwhile.
  const requestTrip = useCallback(async () => {
    const hold = stateRef.current.hold;
    const kind = phaseRef.current.kind;
    if (sendingRef.current || !hold || (kind !== "idle" && kind !== "refused" && kind !== "retry")) return;
    const { ref, linkToken } = hold;
    sendingRef.current = true;
    holdEndedWhileSending.current = false;
    applyPhase({ type: "send" });
    dispatch({ type: "refused", at: "request", reasons: [] });
    try {
      const sent = await postRequest({ ref, t: linkToken });
      const outcome = requestOutcome(sent.status, sent.json);
      let result: RequestAnswer;
      if (outcome.kind === "sent") {
        // The amount and the plan come from the booking itself (P6-03); without the view, the request's own answer.
        const view = await postView({ ref, t: linkToken, locale });
        const read = resumeOutcome(view.status, view.json, Date.now());
        if (read.kind === "sent") result = { kind: "sent", summary: { ...read.summary, emailSent: outcome.emailSent } };
        else if (read.kind === "elsewhere") result = read;
        else result = { kind: "sent", summary: sentFromRequest(outcome) };
      } else {
        // Taken: the guest's own held nights are freed once (best effort), then 04-03's released.
        if (outcome.kind === "taken") await postRelease({ ref, t: linkToken });
        result = outcome;
      }
      if (!alive.current) return;
      const endedMeanwhile = holdEndedWhileSending.current;
      holdEndedWhileSending.current = false;
      setLink({ ref, t: linkToken });
      applyPhase({ type: "answer", result });
      switch (result.kind) {
        case "ended":
          dispatch({ type: "ended" });
          break;
        case "taken":
          dispatch({ type: "released" });
          dispatch({ type: "refused", at: "hold", reasons: result.reasons });
          break;
        case "closed":
          dispatch({ type: "closed" });
          dispatch({ type: "refused", at: "request", reasons: result.reasons });
          if (endedMeanwhile) dispatch({ type: "ended" });
          break;
        case "refused":
          dispatch({ type: "refused", at: "request", reasons: result.reasons });
          if (endedMeanwhile) dispatch({ type: "ended" });
          break;
        case "retry":
          dispatch({ type: "refused", at: "request", reasons: UNAVAILABLE });
          if (endedMeanwhile) dispatch({ type: "ended" });
          break;
        case "sent":
        case "elsewhere":
          // The server took the request before the hold ended; the stored hold stays, so a refresh resumes via view.
          break;
      }
    } finally {
      sendingRef.current = false;
    }
  }, [locale, applyPhase]);
  const canContinue = Boolean(quote?.ok) && !state.closed;

  // After Request (sent, moved on) and while a stored hold is checked, the step gives way to the after-request state;
  // then, and after a request that ended or was taken, the rail has no Change (nothing can be edited after Request;
  // the way on is the state's own link).
  const afterSteps = phase.kind === "checking" || phase.kind === "sent" || phase.kind === "elsewhere";
  const layoutStep: StepNumber = afterSteps ? 4 : state.step;
  const railLocked = afterSteps || phase.kind === "sending" || phase.kind === "ended" || phase.kind === "taken";

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
    planRows: price && state.step >= 3 ? planRows(state, price, copy) : undefined,
    // Held, or a hold being placed: no Remove.
    locked: Boolean(state.hold) || state.holdPending,
    loading: quoting && !price,
    onRemove: (id: string) => move({ type: "setAddon", id, qty: 0 }),
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
    layoutStep < 4 ? (
      <JourneyCart {...cartProps} onContinue={next[state.step]} variant="phone" continueDisabled={state.step === 1 && !canContinue} />
    ) : undefined;

  // ---- the steps
  const depositView =
    price && price.deposit
      ? {
          now: formatAed(price.deposit.dueNowFils),
          balance: formatAed(price.deposit.balanceFils),
          date: formatIsoDate(price.deposit.balanceDueDate),
        }
      : null;
  const items: AddOnItem[] = offers.map((o) => ({
    id: o.id,
    kind: o.kind,
    region: o.isUae ? "uae" : undefined,
    name: o.name,
    image: o.image,
    unit: o.unit,
    price: formatAed(o.priceFils),
  }));

  const a = copy.afterRequest;
  const bookingHref = (ref: string) => (link ? bookingPagePath(locale, link.ref, link.t) : bookingPagePath(locale, ref));

  let body: ReactNode = null;
  if (phase.kind === "checking") {
    body = (
      <RequestChecking
        copy={copy}
        failed={phase.failed}
        onRetry={() => applyPhase({ type: "resume" })}
        reasonsSlot={<BookingReasons reasons={UNAVAILABLE} copy={copy} locale={locale} links={reasonLinks} live="assertive" />}
      />
    );
  } else if (phase.kind === "sent") {
    const s = phase.summary;
    const at = deadlineParts(s.deadline);
    body = (
      <RequestSent
        reference={s.ref}
        planLabel={s.plan === "deposit" ? a.planDeposit : s.plan === "full" ? a.planFull : null}
        amountText={s.dueNowFils === null ? null : formatAed(s.dueNowFils)}
        deadlineText={at ? payByLine(copy.bookingStatus.payBy, at) : null}
        emailLine={s.emailSent === true ? "sent" : "page"}
        bookingHref={bookingHref(s.ref)}
        helpHref={HELP_HREF}
        copy={copy}
      />
    );
  } else if (phase.kind === "elsewhere") {
    body = <RequestElsewhere reference={phase.ref} bookingHref={bookingHref(phase.ref)} copy={copy} />;
  } else if (state.step === 1) {
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
  } else if (state.step === 3) {
    const errors = state.showErrors ? travellersErrors(state) : {};
    const choiceErrors = state.showErrors ? requestChoiceErrors(state) : {};
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
        errors={errors}
        showSummary={state.showErrors && (Object.keys(errors).length > 0 || Object.keys(choiceErrors).length > 0)}
        onBack={() => go(2)}
        onContinue={() => go(4)}
        choices={
          <RequestChoices
            plan={state.plan}
            onPlan={(plan) => move({ type: "plan", plan })}
            deposit={depositView}
            depositBlocked={price?.depositBlock ?? null}
            full={{ now: price ? formatAed(price.full.dueNowFils) : NONE }}
            airport={state.airport}
            onAirport={(airport) => move({ type: "airport", airport })}
            terms={state.terms}
            onTerms={(accepted) => move({ type: "terms", accepted })}
            errors={choiceErrors}
            copy={copy}
            locale={locale}
            termsLink={termsLink}
          />
        }
        copy={copy}
      />
    );
  } else {
    const hold = liveHold;
    const win = hold ? windowParts(hold.transferWindowMinutes) : null;
    const dueNow = price ? formatAed(state.plan === "deposit" && price.deposit ? price.deposit.dueNowFils : price.full.dueNowFils) : NONE;
    const refusal = releaseFailed ? { at: "request" as const, reasons: [{ code: "unavailable" as const }] } : state.refusal;
    // A retry: the reason sits under Send request (the refusal) and this note directly under the step. The step stays
    // at the same place in the tree with or without the note, so it never remounts (review finding 5).
    const retryNote = phase.kind === "retry" && hold && !state.ended && state.refusal?.at === "request";
    body = (
      <>
      <RequestStep
        plan={state.plan}
        deposit={depositView}
        full={{ now: price ? formatAed(price.full.dueNowFils) : NONE }}
        airport={state.airport}
        holdBusy={holdBusy}
        onHold={() => dispatch({ type: "retryHold" })}
        holdDisabled={holdBusy || state.closed || state.ended || phase.kind === "taken"}
        held={
          hold && win
            ? {
                ref: hold.ref,
                endsAt: hold.holdExpiresAt,
                dueNow,
                windowText: formatPlural(copy.request.window[win.unit], win.count, locale),
              }
            : null
        }
        onChange={() => {
          // No Change while a request is in flight: the server's answer decides first (review finding 4).
          if (sendingRef.current || phaseRef.current.kind === "sending") return;
          go(3);
        }}
        ended={state.ended}
        startAgainHref={stayHref}
        refusal={refusal}
        reasonLinks={reasonLinks}
        offerName={offerName}
        canRequest={canRequest({ ...state, hold: liveHold }, Date.now())}
        requestBusy={phase.kind === "sending"}
        onRequest={requestTrip}
        secondCityHref={secondCity}
        now={holdClock}
        onEnd={onHoldEnd}
        copy={copy}
        locale={locale}
        termsLink={termsLink}
      />
      {retryNote ? <RequestRetryNote text={a.retryNote} /> : null}
      </>
    );
  }

  const r = copy.request;
  return (
    <>
      {railLocked ? (
        <TripLayout title={copy.trip.title} step={layoutStep} copy={copy} cart={cart} cartDock={cartDock}>
          {body}
        </TripLayout>
      ) : (
        <TripLayout
          title={copy.trip.title}
          step={layoutStep}
          // No Change on the rail while a hold is being placed.
          onStepChange={state.holdPending ? undefined : go}
          copy={copy}
          cart={cart}
          cartDock={cartDock}
        >
          {body}
        </TripLayout>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={r.changeTitle}
        description={r.changeBody}
        confirmLabel={r.changeConfirm}
        cancelLabel={r.changeCancel}
        busy={releasing}
        onConfirm={() => void confirmRelease()}
      />
    </>
  );
}

/** The cart's rows after Total for the chosen plan, from the same fields as the choice cards. */
function planRows(state: TripState, price: NonNullable<ReturnType<typeof displayBreakdown>>, copy: (typeof JOURNEY_COPY)["en"]) {
  const c = copy.cart;
  if (state.plan === "deposit" && price.deposit) {
    return [
      { label: c.payFirst, amount: formatAed(price.deposit.dueNowFils) },
      { label: fill(c.balanceBy, { date: formatIsoDate(price.deposit.balanceDueDate) }), amount: formatAed(price.deposit.balanceFils) },
    ];
  }
  if (state.plan === "full") return [{ label: c.payFull, amount: formatAed(price.full.dueNowFils) }];
  return undefined;
}

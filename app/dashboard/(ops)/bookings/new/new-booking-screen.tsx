"use client";

import { parseDate, type CalendarDate } from "@internationalized/date";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale3, DestinationSummary, ListReply, SiteRequestSummary, StaySummary } from "../../../../../components/ops/api-types";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import type { DateRangeValue } from "../../../../../components/journey/date-range-panel";
import type { GuestCounts } from "../../../../../components/journey/guest-panel";
import { Button } from "../../../../../components/ui/button";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { BackChevron, LINK_BUTTON } from "../../../../../components/ui/link";
import { JOURNEY_COPY } from "../../../../../lib/copy/journey";
import { OPS_KIT_COPY, fillCopy } from "../../../../../lib/copy/ops-kit";
import { OPS_NEW_BOOKING_COPY, type OpsNewBookingCopy } from "../../../../../lib/copy/ops-new-booking";
import { dubaiToday } from "../../../../../lib/money/dates";
import { formatAed } from "../../../../../lib/money/format";
import type { AddOnOffering, Airport, BookingReason } from "../../../../../lib/booking/types";
import { parseAedAmount } from "../../../../../lib/ops/booking-rules";
import type {
  NewBookingAvailabilityAnswer,
  NewBookingCreateAnswer,
  NewBookingCreateBody,
  NewBookingQuoteAnswer,
  NewBookingQuoteBody,
} from "../../../../../lib/ops/new-booking-contract";
import {
  cleanEmail,
  createAllowed,
  guestProblems,
  holdFloorOk,
  holdIso,
  prefillFrom,
  stepOfField,
  type NewBookingStep,
} from "../../../../../lib/ops/new-booking-rules";
import { dayIn } from "../bookings-text";
import { ExtrasStep, GuestStep, PaymentStep, ReviewStep, StayStep, type GuestForm, type KindFilter, type ReviewRow, type StayChoice } from "./new-booking-steps";
import { BookingSummary, PhoneBar } from "./new-booking-summary";

// Plan 05-02 Task 3 (OPS-06): the owner's New booking screen. This file owns the state and the calls; the five steps and the
// summary only draw. Loaded in the browser only (new-booking-loader.tsx). Every amount comes from the server's quote; the
// browser sends no money, only choices. A real or TEST booking is one POST /api/ops/booking/create with a request id that
// changes only when the form does, so a lost answer retried unchanged replays the first booking and sends one mail.

const QUIET_MS = 300;
const SPAN_DAYS = 366;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALL = "all";
const STEPS: NewBookingStep[] = [1, 2, 3, 4, 5];
const STAY_REASONS = new Set(["below_min_nights", "over_max_guests", "dates_invalid", "stay_unavailable"]);
const PAYMENT_REASONS = new Set(["settings_missing", "settings_changed", "below_minimum_charge"]);

type Quote = { key: string; answer: NewBookingQuoteAnswer | null };
type Range = { blocked: string[]; taken: string[]; hasRate: boolean };
type Shown = Partial<Record<NewBookingStep, boolean>>;

function toDate(day: string): CalendarDate | null {
  try {
    return parseDate(day);
  } catch {
    return null;
  }
}

function chars(text: string): number {
  return [...text].length;
}

/** One quote reason or SQL refusal said in words, with its tokens. */
function sentence(copy: OpsNewBookingCopy, code: string, reason: BookingReason | null): string {
  const nights = (reason?.nights ?? []).map((night) => dayIn(night)).join(", ");
  const table = copy.problems as Record<string, string>;
  const unnamed = (code === "blocked" || code === "sold_out") && nights === "";
  const template = unnamed ? copy.problems.nightsUnnamed : Object.prototype.hasOwnProperty.call(table, code) ? table[code] : copy.problems.unavailable;
  return fillCopy(template, { nights, min: reason?.min ?? "", max: reason?.max ?? "" });
}

function focusLater(id: string | null) {
  if (id === null) return;
  window.setTimeout(() => document.getElementById(id)?.focus(), 0);
}

export function NewBookingScreen() {
  const locale = useDashboardLocale();
  const copy = OPS_NEW_BOOKING_COPY[locale];
  const journeyCopy = JOURNEY_COPY[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const router = useRouter();

  const [today] = useState(() => dubaiToday(new Date()));
  const todayDate = useMemo(() => parseDate(today), [today]);

  const [step, setStep] = useState<NewBookingStep>(1);
  const [shown, setShown] = useState<Shown>({});
  const [guest, setGuest] = useState<GuestForm>({ name: "", email: "", phone: "" });
  const [bookingLocale, setBookingLocale] = useState<Locale3 | null>(null);
  const [destination, setDestination] = useState(ALL);
  const [staySlug, setStaySlug] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangeValue>({ start: null, end: null });
  const [counts, setCounts] = useState<GuestCounts>({ adults: 1, children: 0, infants: 0 });
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [airport, setAirport] = useState<Airport | "none">("none");
  const [pickup, setPickup] = useState("");
  const [plan, setPlan] = useState<"deposit" | "full">("deposit");
  const [agreedOn, setAgreedOn] = useState(false);
  const [agreedAmount, setAgreedAmount] = useState("");
  const [agreedReason, setAgreedReason] = useState("");
  const [holdDate, setHoldDate] = useState("");
  const [holdTime, setHoldTime] = useState("");
  const [isTest, setIsTest] = useState(false);

  const [stays, setStays] = useState<StaySummary[]>([]);
  const [destinations, setDestinations] = useState<DestinationSummary[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [blockedDays, setBlockedDays] = useState<CalendarDate[]>([]);
  const [rangeInfo, setRangeInfo] = useState<{ key: string; info: Range | null } | null>(null);
  const [quoteState, setQuoteState] = useState<Quote | null>(null);
  const [offers, setOffers] = useState<AddOnOffering[]>([]);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // The fingerprint of a form the SQL refused as blocked or sold_out (a real reply): Create stays off for it.
  const [takenRefused, setTakenRefused] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const latestCalendar = useRef(0);
  const latestRange = useRef(0);
  const latestQuote = useRef(0);
  const attempt = useRef<{ id: string; fp: string } | null>(null);
  const moved = useRef(false);

  const lang: Locale3 = bookingLocale ?? locale;

  // ---- first loads: the request behind ?request=, the stays and the destinations

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("request");
    if (id === null || !UUID.test(id)) return;
    let live = true;
    void opsFetch<ListReply<SiteRequestSummary>>("/api/ops/requests", { kind: "all", handled: "all" }).then((reply) => {
      if (!live) return;
      const row = reply.ok ? reply.items.find((one) => one.id.toLowerCase() === id.toLowerCase()) : undefined;
      const fill = row ? prefillFrom(row, today) : null;
      if (!fill) {
        setQuiet(true);
        return;
      }
      setGuest({ name: fill.name, email: fill.email, phone: fill.phone });
      setBookingLocale(fill.locale);
      if (fill.adults !== null) setCounts({ adults: fill.adults, children: 0, infants: 0 });
      const start = fill.from === null ? null : toDate(fill.from);
      const end = fill.to === null ? null : toDate(fill.to);
      if (start && end) setRange({ start, end });
    });
    return () => {
      live = false;
    };
  }, [today]);

  useEffect(() => {
    let live = true;
    void opsFetch<ListReply<StaySummary>>("/api/ops/stays").then((reply) => {
      if (!live) return;
      if (reply.ok) setStays(reply.items.filter((one) => one.is_published));
      else setLoadError(true);
    });
    void opsFetch<ListReply<DestinationSummary>>("/api/ops/destinations").then((reply) => {
      if (live && reply.ok) setDestinations(reply.items.filter((one) => one.is_published));
    });
    return () => {
      live = false;
    };
  }, []);

  // ---- availability: a year ahead for the calendar, then the chosen range

  useEffect(() => {
    if (staySlug === null) {
      setBlockedDays([]);
      return;
    }
    const ticket = (latestCalendar.current += 1);
    void opsSend<NewBookingAvailabilityAnswer>("/api/ops/booking/availability", {
      stay: staySlug,
      from: today,
      to: todayDate.add({ days: SPAN_DAYS }).toString(),
    }).then((reply) => {
      if (ticket !== latestCalendar.current) return;
      if (!reply.ok) {
        setBlockedDays([]);
        return;
      }
      const days = [...reply.blocked, ...reply.taken].map(toDate).filter((day): day is CalendarDate => day !== null);
      setBlockedDays(days);
    });
  }, [staySlug, today, todayDate]);

  const from = range.start?.toString() ?? null;
  const to = range.end?.toString() ?? null;
  const rangeKey = staySlug !== null && from !== null && to !== null ? `${staySlug}|${from}|${to}` : "";

  useEffect(() => {
    if (rangeKey === "" || staySlug === null || from === null || to === null) return;
    const ticket = (latestRange.current += 1);
    void opsSend<NewBookingAvailabilityAnswer>("/api/ops/booking/availability", { stay: staySlug, from, to }).then((reply) => {
      if (ticket !== latestRange.current) return;
      setRangeInfo({ key: rangeKey, info: reply.ok ? { blocked: reply.blocked, taken: reply.taken, hasRate: reply.has_rate } : null });
    });
    // rangeKey carries stay, from and to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const rangeCurrent = rangeKey !== "" && rangeInfo?.key === rangeKey ? rangeInfo : null;
  const unavailableNights = rangeCurrent?.info ? [...new Set([...rangeCurrent.info.blocked, ...rangeCurrent.info.taken])].sort() : null;

  // ---- the quote: 300 ms of quiet, latest ticket wins, nothing stale shown

  const addons = Object.entries(picks)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ id, qty }));
  const agreedText = agreedOn && parseAedAmount(agreedAmount) !== null ? agreedAmount.trim() : null;
  const quoteBody: NewBookingQuoteBody | null =
    staySlug !== null && from !== null && to !== null
      ? { stay: staySlug, from, to, adults: counts.adults, children: counts.children, infants: counts.infants, addons, plan, locale, agreed_amount: agreedText }
      : null;
  const quoteKey = quoteBody === null ? "" : JSON.stringify(quoteBody);

  useEffect(() => {
    if (quoteBody === null) return;
    const ticket = (latestQuote.current += 1);
    const timer = window.setTimeout(() => {
      void opsSend<NewBookingQuoteAnswer>("/api/ops/booking/quote", quoteBody).then((reply) => {
        if (ticket !== latestQuote.current) return;
        if (reply.ok && reply.stay !== null) setOffers(reply.offers);
        setQuoteState({ key: quoteKey, answer: reply.ok ? reply : null });
      });
    }, QUIET_MS);
    return () => window.clearTimeout(timer);
    // quoteKey is the whole body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const quoteCurrent = quoteKey !== "" && quoteState?.key === quoteKey ? quoteState : null;
  const quote = quoteCurrent?.answer ?? null;
  const quoteFailed = quoteCurrent !== null && quoteCurrent.answer === null;
  const breakdown = quote?.breakdown ?? null;
  const reasons = quote?.reasons ?? [];

  const mustAgree = quote?.needs_agreed === true || rangeCurrent?.info?.hasRate === false;
  useEffect(() => {
    if (mustAgree) setAgreedOn(true);
  }, [mustAgree]);

  const depositRefused = reasons.some((r) => r.code === "deposit_unavailable");
  useEffect(() => {
    if (depositRefused && plan === "deposit") setPlan("full");
  }, [depositRefused, plan]);

  // ---- step changes: top of the page, focus on the step's heading

  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById("nb-step-heading")?.focus();
  }, [step]);

  // ---- rules, read from the current form

  const showAgreed = mustAgree || agreedOn;
  const needsPickup = offers.some((o) => o.isHomePickup && (picks[o.id] ?? 0) > 0);
  const gProb = guestProblems(guest);
  const amountProb = showAgreed && parseAedAmount(agreedAmount) === null;
  const reasonLen = chars(agreedReason.trim());
  const reasonProb = showAgreed && (reasonLen < 3 || reasonLen > 300);
  const holdValue = holdIso(holdDate, holdTime);
  // Both are UAE days as YYYY-MM-DD. A warning only: the owner may hold past the arrival (owner, 2026-10-31).
  const holdAfterArrival = holdValue !== null && from !== null && holdDate > from;
  const holdProblem = holdValue === null ? copy.payment.holdError : !holdFloorOk(holdValue, Date.now()) ? copy.payment.holdFloor : null;
  const pickupProb = needsPickup && (pickup.trim() === "" || chars(pickup.trim()) > 300);
  const staySet = staySlug !== null && from !== null && to !== null;
  const stayLines = reasons.filter((r) => STAY_REASONS.has(r.code)).map((r) => sentence(copy, r.code, r));
  const bodyNow = createBody();
  const fingerprint = bodyNow === null ? "" : JSON.stringify(bodyNow);
  // Blocked or booked nights stay a reason only for a retry of this very form (the owner's own hold may be what blocks them),
  // and not after a real reply said blocked or sold_out for it.
  const retrying = attempt.current !== null && attempt.current.fp === fingerprint && takenRefused !== fingerprint;
  const addonProb = reasons.some((r) => r.code === "addon_unavailable" || r.code === "addon_quantity");
  const stepOk: Record<NewBookingStep, boolean> = {
    1: Object.keys(gProb).length === 0,
    2: staySet && stayLines.length === 0 && (retrying || unavailableNights === null || unavailableNights.length === 0),
    3: !pickupProb && !addonProb,
    4: !amountProb && !reasonProb && holdProblem === null && !addonProb,
    5: true,
  };

  function firstFocus(target: NewBookingStep): string | null {
    if (target === 1) return gProb.name ? "nb-name" : gProb.email ? "nb-email" : gProb.phone ? "nb-phone" : null;
    if (target === 2) return "nb-stay";
    if (target === 3) return pickupProb ? "nb-pickup" : null;
    if (target === 4) return amountProb ? "nb-amount" : reasonProb ? "nb-reason" : holdProblem !== null ? (holdValue === null && holdDate === "" ? "nb-hold-date" : holdValue === null ? "nb-hold-time" : "nb-hold-date") : null;
    return null;
  }

  function go(target: NewBookingStep) {
    setRefusal(null);
    setStep(target);
  }

  function next() {
    setShown((old) => ({ ...old, [step]: true }));
    if (!stepOk[step]) {
      focusLater(firstFocus(step));
      return;
    }
    if (step < 5) go((step + 1) as NewBookingStep);
  }

  function back() {
    if (step > 1) go((step - 1) as NewBookingStep);
  }

  const gateLine =
    quote === null
      ? null
      : !quote.real_open && !quote.test_open
        ? copy.review.gateTest
        : !isTest && !quote.real_open
          ? copy.review.gateReal
          : null;
  const onlyTaken = reasons.every((r) => r.code === "blocked" || r.code === "sold_out");
  const blockingReasons = reasons.filter((r) => r.code !== "blocked" && r.code !== "sold_out");

  function createBody(): Omit<NewBookingCreateBody, "request_id"> | null {
    if (staySlug === null || from === null || to === null || holdValue === null) return null;
    return {
      stay: staySlug,
      from,
      to,
      adults: counts.adults,
      children: counts.children,
      infants: counts.infants,
      addons,
      plan,
      locale: lang,
      agreed_amount: agreedText,
      guest: { name: guest.name.trim(), email: cleanEmail(guest.email), phone: guest.phone.trim() },
      airport: airport === "none" ? null : airport,
      pickup_address: needsPickup ? pickup.trim() : null,
      hold_until: holdValue,
      is_test: isTest,
      agreed_reason: agreedText === null ? null : agreedReason.trim(),
    };
  }

  const canCreate =
    !busy &&
    quote !== null &&
    breakdown !== null &&
    blockingReasons.length === 0 &&
    (reasons.length === 0 || (onlyTaken && retrying)) &&
    bodyNow !== null &&
    createAllowed({ isTest, realOpen: quote.real_open, testOpen: quote.test_open });

  async function create() {
    if (busy) return;
    for (const target of [1, 2, 3, 4] as NewBookingStep[]) {
      if (!stepOk[target]) {
        setShown({ 1: true, 2: true, 3: true, 4: true });
        go(target);
        focusLater(firstFocus(target));
        return;
      }
    }
    const body = createBody();
    if (body === null || !canCreate) return;
    const fp = JSON.stringify(body);
    if (attempt.current === null || attempt.current.fp !== fp) attempt.current = { id: crypto.randomUUID(), fp };
    setBusy(true);
    setRefusal(null);
    // The price is asked again first: what is stored is the server's price at this moment, so a change is shown, not stored.
    if (quoteBody !== null && breakdown !== null) {
      latestQuote.current += 1;
      const fresh = await opsSend<NewBookingQuoteAnswer>("/api/ops/booking/quote", quoteBody);
      if (!fresh.ok || fresh.breakdown === null) {
        setBusy(false);
        setRefusal(copy.problems.quoteFailed);
        return;
      }
      setQuoteState({ key: quoteKey, answer: fresh });
      if (fresh.breakdown.grandFils !== breakdown.grandFils || fresh.breakdown.dueNowFils !== breakdown.dueNowFils) {
        setBusy(false);
        setRefusal(fillCopy(copy.problems.priceChanged, { amount: formatAed(fresh.breakdown.grandFils) }));
        return;
      }
      if (fresh.reasons.some((r) => r.code !== "blocked" && r.code !== "sold_out")) {
        setBusy(false);
        return;
      }
    }
    const reply = await opsSend<NewBookingCreateAnswer>("/api/ops/booking/create", { ...body, request_id: attempt.current.id });
    if (reply.ok) {
      router.replace(`/dashboard/bookings/detail?ref=${encodeURIComponent(reply.ref)}`);
      return;
    }
    setBusy(false);
    const detail = reply.error.detail as { reasons?: BookingReason[] } | null;
    const reason = detail && Array.isArray(detail.reasons) ? (detail.reasons.find((r) => r.code === reply.error.code) ?? null) : null;
    const code = reply.error.code;
    const known = Object.prototype.hasOwnProperty.call(copy.problems, code);
    const noReply = reply.status === 0 || code === "unavailable" || code === "network" || code === "timeout";
    setRefusal(noReply ? copy.problems.noAnswer : known ? sentence(copy, code, reason) : sentence(copy, "invalid", null));
    if (!noReply && (code === "blocked" || code === "sold_out")) setTakenRefused(fp);
    if (code === "settings_changed" || code === "settings_missing" || code === "requests_closed") {
      // So that "the price was refreshed" is true: ask for the quote again.
      latestQuote.current += 1;
      if (quoteBody !== null) {
        const again = await opsSend<NewBookingQuoteAnswer>("/api/ops/booking/quote", quoteBody);
        setQuoteState({ key: quoteKey, answer: again.ok ? again : null });
      }
    }
    if (code === "invalid" && reply.error.field) {
      setShown({ 1: true, 2: true, 3: true, 4: true });
      go(stepOfField(reply.error.field));
    }
  }

  function close() {
    const dirty =
      guest.name !== "" || guest.email !== "" || guest.phone !== "" || staySlug !== null || range.start !== null || addons.length > 0 || pickup !== "" || agreedAmount !== "" || agreedReason !== "" || holdDate !== "" || holdTime !== "";
    if (dirty) setAsking(true);
    else router.push("/dashboard/bookings");
  }

  // ---- what the steps show

  const offersById = new Map(offers.map((o) => [o.id, o]));
  const rowProblems: Record<string, string> = {};
  for (const r of reasons) {
    if ((r.code === "addon_unavailable" || r.code === "addon_quantity") && r.id) rowProblems[r.id] = sentence(copy, r.code, r);
  }
  const paymentLines = reasons.filter((r) => PAYMENT_REASONS.has(r.code)).map((r) => sentence(copy, r.code, r));
  for (const r of reasons) if (r.code === "addon_unavailable" || r.code === "addon_quantity") paymentLines.push(sentence(copy, r.code, r));
  if (quoteFailed) paymentLines.push(copy.problems.quoteFailed);

  const stayChoices: StayChoice[] = stays.map((one) => ({ slug: one.slug, title: one.title_en, destinationId: one.destination_id }));
  const destinationChoices = destinations.map((one) => ({
    id: one.id,
    name: (locale === "ar" ? one.name_ar : locale === "es" ? one.name_es : null) ?? one.name_en,
  }));
  const stayTitle = quote?.stay?.title ?? stays.find((one) => one.slug === staySlug)?.title_en ?? null;
  const datesText = from !== null && to !== null ? `${dayIn(from)} – ${dayIn(to)}` : null;
  const selected = Object.entries(picks)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${qty} × ${offersById.get(id)?.name ?? ""}`)
    .join(", ");
  const rows: ReviewRow[] = [
    {
      step: 1,
      label: copy.review.guest,
      value: (
        <>
          {guest.name.trim()}
          <br />
          <bdi dir="ltr">{cleanEmail(guest.email)}</bdi>
          <br />
          <bdi dir="ltr">{guest.phone.trim()}</bdi>
        </>
      ),
    },
    { step: 2, label: copy.review.stay, value: stayTitle ?? "" },
    { step: 2, label: copy.review.dates, value: datesText === null ? "" : <bdi dir="ltr">{datesText}</bdi> },
    { step: 2, label: copy.review.guests, value: fillCopy(copy.review.guestsLine, { adults: counts.adults, children: counts.children, infants: counts.infants }) },
    { step: 3, label: copy.review.extras, value: selected === "" ? "—" : selected },
    {
      step: 4,
      label: copy.review.payment,
      value: (
        <>
          {plan === "deposit" ? copy.review.depositLine : copy.review.fullLine}
          {agreedText !== null && breakdown ? (
            <>
              <br />
              {copy.review.agreedLabel} <bdi dir="ltr">{formatAed(breakdown.nightsFils)}</bdi>
            </>
          ) : null}
          {holdValue !== null ? (
            <>
              <br />
              {copy.review.holdLabel} <bdi dir="ltr">{`${dayIn(holdDate)} ${holdTime}`}</bdi>
            </>
          ) : null}
        </>
      ),
    },
  ];

  const barAction = (
    <Button onClick={step === 5 ? () => void create() : next} busy={step === 5 ? busy : undefined} disabled={step === 5 && !canCreate}>
      {step === 5 ? copy.review.create : copy.continue}
    </Button>
  );

  const names: Record<NewBookingStep, string> = {
    1: copy.steps.guest,
    2: copy.steps.stay,
    3: copy.steps.extras,
    4: copy.steps.payment,
    5: copy.steps.review,
  };

  function pick(id: string, qty: number) {
    setPicks((old) => {
      const nextPicks = { ...old };
      if (qty <= 0) delete nextPicks[id];
      else nextPicks[id] = qty;
      return nextPicks;
    });
  }

  /** Another stay (or none): what belonged to the old one goes. The dates stay unless a stay was already chosen (a request's dates). */
  function resetStay(slug: string | null) {
    if (slug === staySlug) return;
    if (staySlug !== null) setRange({ start: null, end: null });
    setStaySlug(slug);
    setPicks({});
    setOffers([]);
    setAgreedOn(false);
    setAgreedAmount("");
    setAgreedReason("");
    setQuoteState(null);
    setRangeInfo(null);
  }

  function chooseStay(slug: string) {
    resetStay(slug);
  }

  function chooseDestination(id: string) {
    setDestination(id);
    if (staySlug === null || id === ALL) return;
    const current = stays.find((one) => one.slug === staySlug);
    if (!current || current.destination_id !== id) {
      // The old stay is not in the new list: reset as a stay change does, and clear the dates with it.
      setRange({ start: null, end: null });
      resetStay(null);
    }
  }

  return (
    <div dir={dir} data-new-booking className="flex min-w-0 flex-col gap-4 pb-6 max-md:pb-2">
      <div className="flex flex-col gap-2">
        <button type="button" className={LINK_BUTTON} onClick={close}>
          <BackChevron />
          {copy.bookings}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 font-display text-heading font-normal text-teal">{copy.title}</h1>
          <Button variant="secondary" onClick={close}>
            {copy.close}
          </Button>
        </div>
      </div>

      <nav aria-label={copy.title}>
        <ol className="m-0 hidden list-none grid-cols-5 gap-0 p-0 md:grid">
          {STEPS.map((n) => (
            <li
              key={n}
              aria-current={n === step ? "step" : undefined}
              className={n === step ? "border-b-[3px] border-teal py-3 text-label font-bold text-teal" : "border-b border-line py-3 text-label text-muted"}
            >
              {n < step ? <span aria-hidden="true">✓ </span> : null}
              {names[n]}
            </li>
          ))}
        </ol>
        <div className="md:hidden">
          <div className="grid grid-cols-5 gap-1" aria-hidden="true">
            {STEPS.map((n) => (
              <span key={n} className={n <= step ? "h-[3px] bg-teal" : "h-[3px] bg-line"} />
            ))}
          </div>
          <p className="m-0 pt-2 text-label text-ink">{fillCopy(copy.stepOf, { n: step, name: names[step] })}</p>
        </div>
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          {step === 1 ? (
            <GuestStep
              copy={copy}
              dir={dir}
              guest={guest}
              onGuest={setGuest}
              bookingLocale={lang}
              onLocale={setBookingLocale}
              errors={shown[1] ? gProb : {}}
              quiet={quiet ? copy.requestUnread : null}
              onNext={next}
            />
          ) : null}
          {step === 2 ? (
            <StayStep
              copy={copy}
              dir={dir}
              locale={locale}
              journeyCopy={journeyCopy}
              destinations={destinationChoices}
              destination={destination}
              onDestination={chooseDestination}
              stays={stayChoices}
              staySlug={staySlug}
              onStay={chooseStay}
              range={range}
              onRange={setRange}
              today={todayDate}
              blocked={staySlug === null ? [] : blockedDays}
              counts={counts}
              onCounts={setCounts}
              availability={unavailableNights}
              availabilityError={rangeCurrent !== null && rangeCurrent.info === null}
              lines={stayLines}
              loadError={loadError ? copy.problems.loadFailed : null}
              onBack={back}
              onNext={next}
            />
          ) : null}
          {step === 3 ? (
            <ExtrasStep
              copy={copy}
              dir={dir}
              journeyCopy={journeyCopy}
              offers={offers}
              search={search}
              onSearch={setSearch}
              kind={kind}
              onKind={setKind}
              picks={picks}
              onPick={pick}
              rowProblems={rowProblems}
              removeWord={OPS_KIT_COPY[locale].remove}
              airport={airport}
              onAirport={setAirport}
              needsPickup={needsPickup}
              pickup={pickup}
              onPickup={setPickup}
              pickupError={shown[3] === true && pickupProb}
              onBack={back}
              onNext={next}
            />
          ) : null}
          {step === 4 ? (
            <PaymentStep
              copy={copy}
              dir={dir}
              mustAgree={mustAgree}
              agreedOn={agreedOn}
              onAgreedOn={setAgreedOn}
              agreedAmount={agreedAmount}
              onAgreedAmount={setAgreedAmount}
              agreedReason={agreedReason}
              onAgreedReason={setAgreedReason}
              amountError={shown[4] === true && amountProb}
              reasonError={shown[4] === true && reasonProb}
              plan={plan}
              onPlan={setPlan}
              breakdown={breakdown}
              holdDate={holdDate}
              onHoldDate={setHoldDate}
              holdTime={holdTime}
              onHoldTime={setHoldTime}
              holdProblem={shown[4] === true ? holdProblem : null}
              holdAfterArrival={holdAfterArrival}
              lines={paymentLines}
              onBack={back}
              onNext={next}
            />
          ) : null}
          {step === 5 ? (
            <ReviewStep
              copy={copy}
              dir={dir}
              rows={rows}
              onEdit={go}
              isTest={isTest}
              onTest={setIsTest}
              gateLine={gateLine}
              problem={refusal ?? (quoteFailed ? copy.problems.quoteFailed : null)}
              lines={(retrying ? blockingReasons : reasons).map((r) => sentence(copy, r.code, r))}
              busy={busy}
              canCreate={canCreate}
              onBack={back}
              onCreate={() => void create()}
            />
          ) : null}
        </div>
        <BookingSummary copy={copy} guestName={guest.name.trim()} stayTitle={stayTitle} datesText={datesText} breakdown={breakdown} />
      </div>

      <PhoneBar copy={copy} breakdown={breakdown} action={barAction} />

      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={copy.review.leaveTitle}
        description={copy.review.leaveText}
        confirmLabel={copy.review.leave}
        cancelLabel={copy.review.stayHere}
        onConfirm={() => router.push("/dashboard/bookings")}
      />
    </div>
  );
}

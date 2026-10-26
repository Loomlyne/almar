"use client";

// Plan 04-03 (signed 2026-10-25, Q-01 = B): the trip screens drawn from the real components for the pictures. Symbolic
// data only: "AED [AMOUNT]", "VAT [RATE]%", the fixture stay and add-ons, reference "ALMAR-XXXXXX", window "[N] hours".
// Each state keeps its own React state, so toggles answer in the harness. Not in tests/journey/matrix.ts (no baselines).

import { useState, type ReactNode } from "react";
import { AddonsStep } from "../../../components/journey/addons-step";
import { BookingReasons } from "../../../components/journey/booking-reasons";
import { JourneyCart } from "../../../components/journey/journey-cart";
import { RequestChoices, RequestStep, type TripPlanChoice } from "../../../components/journey/request-step";
import { StaySummaryStep } from "../../../components/journey/stay-summary-step";
import { TravellersStep, type TravellerErrorCode, type TravellersContact, type TravellersLine } from "../../../components/journey/travellers-step";
import { TripLayout } from "../../../components/journey/trip-layout";
import type { StepNumber } from "../../../components/journey/step-rail";
import type { AddOnItem, CartLine } from "../../../components/journey/types";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { StayBooking, StayBookingBar, StayBookingDock } from "../../../components/pages/stay-detail/booking";
import { pickStayJourneyCopy } from "../../../components/pages/stay-detail/booking-value";
import { JOURNEY_CHOICE_KEY, isoOf, serializeJourneyChoice } from "../../../lib/journey-choice";
import { STAY_DETAIL_COPY } from "../../../lib/copy/stay-detail";
import { SITE_FOOTER_COPY } from "../../../lib/copy/site-footer";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { Airport, BookingReason, ReasonCode } from "../../../lib/booking/types";
import type { DepositBlock } from "../../../lib/money/booking-price";
import { formatGuestSummary } from "../../../lib/journey-format";
import type { SceneContext, Scenes } from "../scene-types";

const REF = "ALMAR-XXXXXX";
const WINDOW = "[N] hours";
const NIGHTS = ["2026-10-12", "2026-10-13"];
const ENDS_AT = "2026-10-12T10:30:00Z";
// 29:41 left on the hold, every second of the shoot.
const FIXED_NOW = () => Date.parse("2026-10-12T10:00:19Z");
const LINKS = { stay: "/en/private-stays/getsemani-colonial-house", whatsapp: "https://wa.me/971563883302", startAgain: "/en/private-stays/getsemani-colonial-house" };
const noop = () => undefined;

function items(ctx: SceneContext): AddOnItem[] {
  const [pickup, vip, concierge, heritage] = [
    ctx.fixtures.addOns[0],
    ctx.fixtures.addOns[1],
    ctx.fixtures.addOns[2],
    ctx.fixtures.addOns[4],
  ];
  return [
    { ...pickup, price: ctx.fixtures.AMOUNT },
    { ...vip, price: ctx.fixtures.AMOUNT },
    { ...heritage, price: ctx.fixtures.AMOUNT },
    // One add-on without a picture: an empty frame, never an invented image.
    { ...concierge, image: null, price: ctx.fixtures.AMOUNT },
  ];
}

const START_QTY: Record<string, number> = { "home-pickup": 1, "heritage-tours": 2 };

function cartLines(ctx: SceneContext, qty: Record<string, number>): CartLine[] {
  return items(ctx)
    .filter((i) => (qty[i.id] ?? 0) > 0)
    .map((i) => ({ id: i.id, name: i.name, quantity: qty[i.id], amount: ctx.fixtures.AMOUNT }));
}

const GUESTS = { adults: 2, children: 1, infants: 1 };

type CartOptions = { lines?: CartLine[]; plan?: TripPlanChoice | null; locked?: boolean; loading?: boolean; stayOnly?: boolean; continueDisabled?: boolean };

function cartParts({ ctx, step, o }: { ctx: SceneContext; step: StepNumber; o: CartOptions }) {
  const f = ctx.fixtures;
  const c = ctx.copy.cart;
  const props = {
    destinationName: "Cartagena",
    stay: {
      image: f.stay.image,
      name: f.stay.name,
      dates: `${f.dates.startLabel} – ${f.dates.endLabel}`,
      guests: formatGuestSummary(GUESTS, ctx.locale, ctx.copy.guests.summary),
      nights: f.dates.nights,
      amount: f.AMOUNT,
    },
    lines: o.lines ?? [],
    inclusionsCount: o.stayOnly ? 0 : 4,
    subtotal: f.AMOUNT,
    vat: f.AMOUNT,
    total: f.AMOUNT,
    planRows:
      o.plan === "deposit"
        ? [
            { label: c.payFirst, amount: f.AMOUNT },
            { label: c.balanceBy.replace("{date}", "[DD/MM/YYYY]"), amount: f.AMOUNT },
          ]
        : o.plan === "full"
          ? [{ label: c.payFull, amount: f.AMOUNT }]
          : undefined,
    locked: o.locked,
    loading: o.loading,
    onRemove: noop,
    onContinue: noop,
    copy: ctx.copy,
    locale: ctx.locale,
  };
  return {
    rail: <JourneyCart {...props} variant="rail" className="w-full static md:w-rail md:sticky" />,
    dock: step < 4 ? <JourneyCart {...props} variant="phone" continueDisabled={o.continueDisabled} /> : undefined,
  };
}

function Page({ ctx, step, cart, children }: { ctx: SceneContext; step: StepNumber; cart: CartOptions; children: ReactNode }) {
  const c = cartParts({ ctx, step, o: cart });
  return (
    <div className="mx-auto w-full max-w-column px-4 py-8 md:px-8">
      <TripLayout title={ctx.copy.trip.title} step={step} onStepChange={noop} copy={ctx.copy} cart={c.rail} cartDock={c.dock}>
        {children}
      </TripLayout>
    </div>
  );
}

// ---- step 1

function Stay({ ctx, reasons = [], disabled = false, loading = false }: { ctx: SceneContext; reasons?: BookingReason[]; disabled?: boolean; loading?: boolean }) {
  const f = ctx.fixtures;
  return (
    <Page ctx={ctx} step={1} cart={{ stayOnly: true, loading, continueDisabled: disabled }}>
      <StaySummaryStep
        stay={{
          title: f.stay.name,
          destinationName: "Cartagena",
          image: f.stay.image,
          dates: `${f.dates.startLabel} – ${f.dates.endLabel}`,
          guests: formatGuestSummary(GUESTS, ctx.locale, ctx.copy.guests.summary),
          nights: f.dates.nights,
        }}
        reasons={reasons}
        reasonLinks={LINKS}
        changeHref={LINKS.stay}
        secondCityHref={LINKS.whatsapp}
        onContinue={noop}
        continueDisabled={disabled}
        copy={ctx.copy}
        locale={ctx.locale}
      />
    </Page>
  );
}

// ---- step 2

function Addons({ ctx }: { ctx: SceneContext }) {
  const [qty, setQty] = useState<Record<string, number>>(START_QTY);
  return (
    <Page ctx={ctx} step={2} cart={{ lines: cartLines(ctx, qty) }}>
      <AddonsStep
        items={items(ctx)}
        quantities={qty}
        onChange={(id, q) => setQty((prev) => ({ ...prev, [id]: q }))}
        guestsTotal={4}
        nights={ctx.fixtures.dates.nights}
        destinationName="Cartagena"
        inclusions={ctx.fixtures.inclusions.slice(0, 4)}
        onBack={noop}
        onContinue={noop}
        copy={ctx.copy}
        locale={ctx.locale}
      />
    </Page>
  );
}

// ---- step 3 (Q-01 = B: the choices end the step)

const EMPTY_CONTACT: TravellersContact = { name: "", email: "", phone: "", nationality: "", specialRequests: "", emergencyName: "", emergencyPhone: "" };
const LINES: TravellersLine[] = [
  { kind: "adult", fullName: "", age: "" },
  { kind: "adult", fullName: "", age: "" },
  { kind: "child", fullName: "", age: "" },
  { kind: "infant", fullName: "", age: "" },
];
const ALL_ERRORS: Record<string, TravellerErrorCode> = {
  "contact.name": "required",
  "contact.email": "email",
  "contact.phone": "phone",
  "contact.nationality": "tooLong",
  "contact.specialRequests": "tooLong",
  "contact.emergencyName": "tooLong",
  "contact.emergencyPhone": "phone",
  "travellers.1.fullName": "required",
  "travellers.2.fullName": "required",
  "travellers.2.age": "age",
  "travellers.3.fullName": "required",
  "travellers.3.age": "age",
  pickupAddress: "required",
};

type TravellersScene = {
  lines?: TravellersLine[];
  notStaying?: boolean;
  pickup?: boolean;
  errors?: boolean;
  plan?: TripPlanChoice | null;
  airport?: Airport | null;
  terms?: boolean;
  depositBlocked?: DepositBlock | null;
};

function Travellers({ ctx, o }: { ctx: SceneContext; o: TravellersScene }) {
  const f = ctx.fixtures;
  const [contact, setContact] = useState<TravellersContact>(EMPTY_CONTACT);
  const [lines, setLines] = useState<TravellersLine[]>(o.lines ?? LINES);
  const [stays, setStays] = useState(!o.notStaying);
  const [pickup, setPickup] = useState("");
  const [plan, setPlan] = useState<TripPlanChoice | null>(o.plan ?? null);
  const [airport, setAirport] = useState<Airport | null>(o.airport ?? null);
  const [terms, setTerms] = useState(o.terms ?? false);
  const blocked = o.depositBlocked ?? null;
  const qty = o.pickup ? START_QTY : { "heritage-tours": 2 };
  return (
    <Page ctx={ctx} step={3} cart={{ lines: cartLines(ctx, qty), plan }}>
      <TravellersStep
        contact={contact}
        onContact={(patch) => setContact((prev) => ({ ...prev, ...patch }))}
        bookerStays={stays}
        onBookerStays={setStays}
        lines={lines}
        onLine={(i, patch) => setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)))}
        needsPickup={Boolean(o.pickup)}
        pickup={pickup}
        onPickup={setPickup}
        errors={o.errors ? ALL_ERRORS : {}}
        showSummary={o.errors}
        onBack={noop}
        onContinue={noop}
        choices={
          <RequestChoices
            plan={plan}
            onPlan={setPlan}
            deposit={blocked ? null : { now: f.AMOUNT, balance: f.AMOUNT, date: "[DD/MM/YYYY]" }}
            depositBlocked={blocked}
            full={{ now: f.AMOUNT }}
            airport={airport}
            onAirport={setAirport}
            terms={terms}
            onTerms={setTerms}
            errors={o.errors ? { plan: true, airport: true, terms: true } : {}}
            copy={ctx.copy}
            locale={ctx.locale}
          />
        }
        copy={ctx.copy}
      />
    </Page>
  );
}

// ---- step 4

type RequestScene = {
  held?: boolean;
  plan?: TripPlanChoice;
  holdBusy?: boolean;
  holdDisabled?: boolean;
  ended?: boolean;
  refusal?: { at: "hold" | "request"; reasons: BookingReason[] };
  sending?: boolean;
  dialog?: boolean;
};

function Request({ ctx, o }: { ctx: SceneContext; o: RequestScene }) {
  const f = ctx.fixtures;
  const r = ctx.copy.request;
  const [dialog, setDialog] = useState(Boolean(o.dialog));
  const plan = o.plan ?? "full";
  return (
    <Page ctx={ctx} step={4} cart={{ lines: cartLines(ctx, START_QTY), plan: o.ended ? null : plan, locked: o.held }}>
      <RequestStep
        plan={plan}
        deposit={{ now: f.AMOUNT, balance: f.AMOUNT, date: "[DD/MM/YYYY]" }}
        full={{ now: f.AMOUNT }}
        airport="DXB"
        holdBusy={Boolean(o.holdBusy)}
        onHold={noop}
        holdDisabled={Boolean(o.holdDisabled)}
        held={o.held ? { ref: REF, endsAt: ENDS_AT, dueNow: f.AMOUNT, windowText: WINDOW } : null}
        onChange={() => setDialog(true)}
        ended={Boolean(o.ended)}
        startAgainHref={LINKS.stay}
        refusal={o.refusal ?? null}
        reasonLinks={LINKS}
        canRequest={o.held && !o.sending ? { ok: true } : { ok: false, reason: "no_hold" }}
        requestBusy={o.sending}
        onRequest={noop}
        secondCityHref={LINKS.whatsapp}
        now={FIXED_NOW}
        onEnd={noop}
        copy={ctx.copy}
        locale={ctx.locale}
      />
      <ConfirmDialog
        open={dialog}
        onOpenChange={setDialog}
        title={r.changeTitle}
        description={r.changeBody}
        confirmLabel={r.changeConfirm}
        cancelLabel={r.changeCancel}
        onConfirm={() => setDialog(false)}
      />
    </Page>
  );
}

// ---- every reason, for the copy review

const CODES: ReasonCode[] = [
  "stay_unavailable", "dates_invalid", "below_min_nights", "over_max_guests", "blocked", "sold_out", "no_rate",
  "addon_unavailable", "addon_quantity", "settings_missing", "settings_changed", "deposit_unavailable",
  "below_minimum_charge", "hold_limit", "hold_ending", "hold_ended", "not_payable", "nothing_due", "terms_required",
  "unavailable", "invalid", "requests_closed", "too_many_open",
];
const CAUSES: DepositBlock[] = ["too_close_to_arrival", "no_due_days", "zero_deposit", "balance_below_minimum"];

function ReasonsAll({ ctx }: { ctx: SceneContext }) {
  const all: BookingReason[] = [];
  for (const code of CODES) {
    if (code === "deposit_unavailable") for (const cause of CAUSES) all.push({ code, cause });
    else all.push({ code, min: 3, max: 6, nights: NIGHTS, id: "vip-airport-meet" });
  }
  const name = (id: string) => ctx.fixtures.addOns.find((a) => a.id === id)?.name;
  return (
    <div className="mx-auto flex w-full max-w-dialog flex-col gap-6 px-4 py-8">
      <BookingReasons reasons={all} copy={ctx.copy} locale={ctx.locale} links={LINKS} offerName={name} />
      <BookingReasons reasons={[{ code: "sold_out", nights: NIGHTS }, { code: "blocked", nights: NIGHTS }]} copy={ctx.copy} locale={ctx.locale} links={LINKS} at="hold" />
    </div>
  );
}

const TWO_ADULTS: TravellersLine[] = LINES.slice(0, 2);

// ---- Book on the stay page: the real booking island with fixture props (no Stay object, no price)

function Book({ ctx, dates, view }: { ctx: SceneContext; dates: boolean; view: "bar" | "sheet" | "dock" }) {
  // The bar reads the guest's stored choice on mount: give it dates a month ahead (never past, never blocked).
  useState(() => {
    const start = today(getLocalTimeZone()).add({ days: 30 });
    window.sessionStorage.setItem(
      JOURNEY_CHOICE_KEY,
      serializeJourneyChoice({
        destination_id: "cartagena",
        from: dates ? isoOf(start) : null,
        to: dates ? isoOf(start.add({ days: 5 })) : null,
        adults: 2,
        children: 1,
        infants: 1,
        guests_set: true,
      }),
    );
    return null;
  });
  const stayCopy = STAY_DETAIL_COPY[ctx.locale];
  return (
    <StayBooking
      locale={ctx.locale}
      staySlug="getsemani-colonial-house"
      destinationSlug="cartagena"
      destinationName="Cartagena"
      title={ctx.fixtures.stay.name}
      blockedDates={[]}
      copy={pickStayJourneyCopy(ctx.copy)}
      sampleNote={null}
      request={{
        pageUrl: `https://almarprivatejourney.com/${ctx.locale}/private-stays/getsemani-colonial-house`,
        copy: stayCopy.whatsapp,
        label: stayCopy.whatsapp.button,
        opensNote: SITE_FOOTER_COPY[ctx.locale].newTab,
      }}
      initialSheet={view === "sheet" ? { open: true, step: 3 } : undefined}
    >
      <div className="min-h-dvh bg-teal-tint">
        <div className="mx-auto w-full max-w-column px-4 pt-section md:px-8">
          <StayBookingBar />
        </div>
        {view === "dock" ? <StayBookingDock /> : null}
      </div>
    </StayBooking>
  );
}

export const scenes: Scenes = {
  stay: (ctx) => <Stay ctx={ctx} />,
  "stay-taken": (ctx) => <Stay ctx={ctx} disabled loading reasons={[{ code: "sold_out", nights: NIGHTS }, { code: "blocked", nights: NIGHTS }]} />,
  "stay-rules": (ctx) => <Stay ctx={ctx} disabled loading reasons={[{ code: "below_min_nights", min: 3 }, { code: "over_max_guests", max: 6 }]} />,
  "stay-setup": (ctx) => <Stay ctx={ctx} disabled loading reasons={[{ code: "no_rate" }, { code: "settings_missing" }]} />,
  "stay-closed": (ctx) => <Stay ctx={ctx} disabled reasons={[{ code: "requests_closed" }]} />,
  addons: (ctx) => <Addons ctx={ctx} />,
  travellers: (ctx) => <Travellers ctx={ctx} o={{}} />,
  "travellers-errors": (ctx) => <Travellers ctx={ctx} o={{ errors: true, pickup: true }} />,
  "travellers-not-staying": (ctx) => <Travellers ctx={ctx} o={{ notStaying: true }} />,
  "travellers-pickup": (ctx) => <Travellers ctx={ctx} o={{ pickup: true }} />,
  "request-choose": (ctx) => <Travellers ctx={ctx} o={{ plan: "deposit", airport: "DXB", terms: true }} />,
  "request-errors": (ctx) => <Travellers ctx={ctx} o={{ errors: true }} />,
  "request-deposit-close": (ctx) => <Travellers ctx={ctx} o={{ depositBlocked: "too_close_to_arrival" }} />,
  "request-deposit-unset": (ctx) => <Travellers ctx={ctx} o={{ depositBlocked: "no_due_days" }} />,
  "request-held": (ctx) => <Request ctx={ctx} o={{ held: true, plan: "full" }} />,
  "request-held-deposit": (ctx) => <Request ctx={ctx} o={{ held: true, plan: "deposit" }} />,
  "request-sending": (ctx) => <Request ctx={ctx} o={{ held: true, sending: true }} />,
  "request-taken": (ctx) => <Request ctx={ctx} o={{ refusal: { at: "hold", reasons: [{ code: "sold_out", nights: NIGHTS }] } }} />,
  "request-closed": (ctx) => <Request ctx={ctx} o={{ holdDisabled: true, refusal: { at: "hold", reasons: [{ code: "requests_closed" }] } }} />,
  "request-too-many": (ctx) => <Request ctx={ctx} o={{ held: true, refusal: { at: "request", reasons: [{ code: "too_many_open" }] } }} />,
  "request-change": (ctx) => <Request ctx={ctx} o={{ held: true, dialog: true }} />,
  "q01-b-travellers": (ctx) => <Travellers ctx={ctx} o={{ lines: TWO_ADULTS }} />,
  "q01-b-request-holding": (ctx) => <Request ctx={ctx} o={{ holdBusy: true }} />,
  "hold-ended": (ctx) => <Request ctx={ctx} o={{ ended: true }} />,
  "reasons-all": (ctx) => <ReasonsAll ctx={ctx} />,
  "book-bar": (ctx) => <Book ctx={ctx} dates view="bar" />,
  "book-bar-no-dates": (ctx) => <Book ctx={ctx} dates={false} view="bar" />,
  "book-sheet": (ctx) => <Book ctx={ctx} dates view="sheet" />,
  "book-dock": (ctx) => <Book ctx={ctx} dates view="dock" />,
};

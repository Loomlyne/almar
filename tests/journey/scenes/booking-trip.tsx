"use client";

import { useState, type ReactNode } from "react";
import { CalendarDate } from "@internationalized/date";
import { AddOnList, type AddOnFilter } from "../../../components/journey/add-on-row";
import { InclusionsList } from "../../../components/journey/inclusions-list";
import { JourneyBar } from "../../../components/journey/journey-bar";
import { JourneyCart } from "../../../components/journey/journey-cart";
import { PayStep, type PayPlan, type PayStepProps } from "../../../components/journey/pay-step";
import { StaySummaryStep } from "../../../components/journey/stay-summary-step";
import { StepRail, type StepNumber } from "../../../components/journey/step-rail";
import { TravellersStep } from "../../../components/journey/travellers-step";
import type {
  CartLine,
  JourneyValue,
  TravellerErrors,
  TravellersValue,
} from "../../../components/journey/types";
import { BookLink } from "../../../components/pages/stay-detail/book-link";
import { WhatsAppIcon } from "../../../components/icons/icons";
import { Button, LinkButton } from "../../../components/ui/button";
import { StickyDock } from "../../../components/ui/sticky-dock";
import type { Airport, BookingReason } from "../../../lib/booking/types";
import { STAY_DETAIL_COPY } from "../../../lib/copy/stay-detail";
import { fill, formatGuestSummary } from "../../../lib/journey-format";
import { stayRequestHref } from "../../../lib/whatsapp-request";
import type { Scenes, SceneContext } from "../scene-types";

// Plan 04-03, task 1: the screens the canvas does not have, drawn for the owner's signature. Symbolic data only:
// `AED [AMOUNT]`, `[DD/MM/YYYY]`, the fixture stay photo. Nothing here is mounted on a live page.

const DATES = "[DD/MM/YYYY] – [DD/MM/YYYY]";
const STAY_HREF = "/__harness?c=booking-trip&s=stay-ok&l=en";
const TODAY = new CalendarDate(2026, 9, 29);
// A fixed clock so the timer shows the same picture every time: the hold ends 29 minutes 41 seconds from "now".
const HOLD_END = "2026-10-11T12:30:00.000Z";
const NOW_HELD = Date.parse(HOLD_END) - (29 * 60 + 41) * 1000;
const NOW_ENDED = Date.parse(HOLD_END) + 5000;

const guestText = (ctx: SceneContext) =>
  formatGuestSummary(ctx.fixtures.guestsFamily, ctx.locale, ctx.copy.guests.summary);

function cartLines(ctx: SceneContext, quantities: Record<string, number>): CartLine[] {
  return ctx.fixtures.addOns
    .filter((item) => (quantities[item.id] ?? 0) > 0)
    .map((item) => ({ id: item.id, name: item.name, quantity: quantities[item.id], amount: ctx.fixtures.AMOUNT }));
}

const BASE_ADDONS: Record<string, number> = { "home-pickup": 1, "heritage-tours": 2 };

/** The trip page around a step: heading, StepRail, the step, the cart (rail from md, dock below). */
function TripFrame({
  ctx,
  step,
  children,
  cart = true,
  quantities = BASE_ADDONS,
}: {
  ctx: SceneContext;
  step: StepNumber;
  children: ReactNode;
  cart?: boolean;
  quantities?: Record<string, number>;
}) {
  const f = ctx.fixtures;
  const lines = cartLines(ctx, quantities);
  const cartProps = {
    destinationName: "Cartagena",
    stay: {
      image: f.stay.image,
      name: f.stay.name,
      dates: DATES,
      guests: guestText(ctx),
      nights: f.dates.nights,
      amount: f.AMOUNT,
    },
    lines,
    inclusionsCount: f.inclusions.length,
    subtotal: f.AMOUNT,
    vat: f.AMOUNT,
    total: f.AMOUNT,
    onRemove: () => undefined,
    onContinue: () => undefined,
    copy: ctx.copy,
    locale: ctx.locale,
  };
  return (
    <div data-testid="harness-trip" className="mx-auto w-full max-w-column px-4 py-8 md:px-8">
      <h1 className="m-0 mb-6 text-display">{ctx.copy.trip.title}</h1>
      <div className="mb-8 hidden md:block">
        <StepRail current={step} layout="rail" copy={ctx.copy} onChange={() => undefined} />
      </div>
      <div className="mb-8 md:hidden">
        <StepRail current={step} layout="phone" copy={ctx.copy} />
      </div>
      <div className="flex items-start gap-8">
        <div className="min-w-0 flex-1">{children}</div>
        {cart ? (
          <div className="hidden md:block">
            <JourneyCart {...cartProps} variant="rail" />
          </div>
        ) : null}
      </div>
      {cart ? (
        <div className="md:hidden">
          <div aria-hidden="true" className="h-dock" />
          <JourneyCart {...cartProps} variant="phone" />
        </div>
      ) : null}
    </div>
  );
}

function Stay({ ctx, reasons }: { ctx: SceneContext; reasons: BookingReason[] }) {
  const f = ctx.fixtures;
  return (
    <TripFrame ctx={ctx} step={1} cart={false}>
      <StaySummaryStep
        image={f.stay.image}
        title={f.stay.name}
        destinationName="Cartagena"
        dates={DATES}
        guests={guestText(ctx)}
        nights={f.dates.nights}
        stayHref={STAY_HREF}
        elsewhereHref={stayRequestHref(ctx.copy.trip.stay.elsewhereMessage)}
        reasons={reasons}
        onContinue={() => undefined}
        copy={ctx.copy}
        locale={ctx.locale}
      />
    </TripFrame>
  );
}

const SOLD = ["[DD/MM/YYYY]", "[DD/MM/YYYY]"];

function Addons({ ctx }: { ctx: SceneContext }) {
  const f = ctx.fixtures;
  const a = ctx.copy.addons;
  const [filter, setFilter] = useState<AddOnFilter>("all");
  // Home pickup starts added (D-48); the other UAE service, the airport meet, does not.
  const [q, setQ] = useState<Record<string, number>>({ "home-pickup": 1 });
  return (
    <TripFrame ctx={ctx} step={2} quantities={q}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="m-0">{a.title}</h2>
          <p className="m-0 text-body text-muted">{a.intro}</p>
        </div>
        <AddOnList
          items={f.addOns}
          quantities={q}
          onChange={(id, n) => setQ((prev) => ({ ...prev, [id]: n }))}
          guestsTotal={4}
          nights={f.dates.nights}
          destinationName="Cartagena"
          filter={filter}
          onFilterChange={setFilter}
          copy={ctx.copy}
        />
        <InclusionsList items={f.inclusions} locale={ctx.locale} copy={ctx.copy} />
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="lg">
            {a.back}
          </Button>
          <Button size="lg">{a.continue}</Button>
        </div>
      </div>
    </TripFrame>
  );
}

const EMPTY: TravellersValue = {
  name: "",
  email: "",
  phone: "",
  nationality: "",
  specialRequests: "",
  emergencyName: "",
  emergencyPhone: "",
  notStaying: false,
  lines: [
    { name: "", age: "" },
    { name: "", age: "" },
    { name: "", age: "" },
    { name: "", age: "" },
  ],
  pickupAddress: "",
};

const FILLED: TravellersValue = {
  ...EMPTY,
  name: "[Full name]",
  email: "[name@example.com]",
  phone: "[+000 000 0000]",
  lines: [
    { name: "[Full name]", age: "" },
    { name: "[Full name]", age: "" },
    { name: "[Full name]", age: "8" },
    { name: "[Full name]", age: "1" },
  ],
  pickupAddress: "[Street, area, city]",
};

const ERRORS: TravellerErrors = {
  "contact.name": "required",
  "contact.email": "email",
  "contact.phone": "phone",
  "travellers.0.fullName": "required",
  "travellers.2.age": "age",
  "travellers.3.fullName": "required",
};

function Travellers({
  ctx,
  initial,
  errors,
  needsPickup = false,
}: {
  ctx: SceneContext;
  initial: TravellersValue;
  errors?: TravellerErrors;
  needsPickup?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TripFrame ctx={ctx} step={3}>
      <TravellersStep
        guests={ctx.fixtures.guestsFamily}
        value={value}
        onChange={setValue}
        errors={errors}
        needsPickup={needsPickup}
        onBack={() => undefined}
        onContinue={() => undefined}
        copy={ctx.copy}
        locale={ctx.locale}
      />
    </TripFrame>
  );
}

// The 04-04 PaymentPanel is not on this base yet, so the picture draws the same parts: Stripe's card form as a framed
// box, the currency-choice row with its line, the Pay button and an error line. 04-06 mounts the real panel here.
const STUB: Record<"en" | "ar" | "es", { form: string; currency: string; pay: string; decline: string; busy: string; keep: string }> = {
  en: {
    form: "[Stripe payment form · card · Apple Pay]",
    currency: "Your bank card can be charged in your currency at Stripe's rate; ALMAR receives AED.",
    pay: "Pay {amount}",
    decline: "Your card was declined. Try another card or payment method.",
    busy: "Confirming your payment…",
    keep: "Keep this page open. Your bank may ask you to confirm.",
  },
  ar: {
    form: "[نموذج الدفع من Stripe · بطاقة · Apple Pay]",
    currency: "يمكن خصم المبلغ من بطاقتك المصرفية بعملتك وفق سعر Stripe؛ وتستلم ألمار المبلغ بالدرهم.",
    pay: "ادفع {amount}",
    decline: "تم رفض بطاقتك. جرّب بطاقة أخرى أو طريقة دفع أخرى.",
    busy: "جارٍ تأكيد الدفع…",
    keep: "أبقِ هذه الصفحة مفتوحة. قد يطلب منك مصرفك التأكيد.",
  },
  es: {
    form: "[Formulario de pago de Stripe · tarjeta · Apple Pay]",
    currency: "Tu tarjeta puede cobrarse en tu moneda al tipo de cambio de Stripe; ALMAR recibe AED.",
    pay: "Pagar {amount}",
    decline: "Tu tarjeta fue rechazada. Prueba otra tarjeta u otro método de pago.",
    busy: "Confirmando tu pago…",
    keep: "Mantén esta página abierta. Tu banco puede pedirte confirmar.",
  },
};

function StubPayment({ ctx, mode }: { ctx: SceneContext; mode: "ready" | "error" | "confirming" }) {
  const s = STUB[ctx.locale];
  return (
    <div className="flex flex-col gap-4" data-testid="payment-stub">
      <div className="flex min-h-48 items-center justify-center border border-dashed border-muted bg-surface p-6 text-center text-label text-muted">
        {s.form}
      </div>
      <p className="m-0 text-label text-muted">{s.currency}</p>
      <div className="flex flex-col gap-3">
        <Button size="lg" busy={mode === "confirming"} className="self-start">
          {mode === "confirming" ? s.busy : fill(s.pay, { amount: "AED [AMOUNT]" })}
        </Button>
        {mode === "error" ? (
          <p role="alert" className="m-0 text-label text-error">
            {s.decline}
          </p>
        ) : null}
        {mode === "confirming" ? <p className="m-0 text-label text-muted">{s.keep}</p> : null}
      </div>
    </div>
  );
}

function Pay({
  ctx,
  initial = {},
  area,
}: {
  ctx: SceneContext;
  initial?: Partial<PayStepProps> & { plan?: PayPlan | null; airport?: Airport | null; terms?: boolean };
  area?: "ready" | "error" | "confirming";
}) {
  const [plan, setPlan] = useState<PayPlan | null>(initial.plan ?? null);
  const [airport, setAirport] = useState<Airport | null>(initial.airport ?? null);
  const [terms, setTerms] = useState(initial.terms ?? false);
  const { plan: _p, airport: _a, terms: _t, ...rest } = initial;
  const f = ctx.fixtures;
  return (
    <TripFrame ctx={ctx} step={4}>
      <PayStep
        plan={plan}
        onPlanChange={setPlan}
        deposit={{ now: f.AMOUNT, balance: f.AMOUNT, date: "[DD/MM/YYYY]" }}
        depositBlock={null}
        full={{ now: f.AMOUNT }}
        airport={airport}
        onAirportChange={setAirport}
        termsAccepted={terms}
        onTermsChange={setTerms}
        stayHref={STAY_HREF}
        onBack={() => undefined}
        onContinue={() => undefined}
        paymentArea={area ? <StubPayment ctx={ctx} mode={area} /> : null}
        copy={ctx.copy}
        locale={ctx.locale}
        {...rest}
      />
    </TripFrame>
  );
}

const held = (ctx: SceneContext, area: "ready" | "error" | "confirming" | null, ended = false) => (
  <Pay
    ctx={ctx}
    initial={{
      plan: "deposit",
      airport: "DXB",
      terms: true,
      holdEndsAt: HOLD_END,
      getNow: () => (ended ? NOW_ENDED : NOW_HELD),
    }}
    area={area ?? undefined}
  />
);

// Book beside Request on WhatsApp, drawn on the real bar, sheet button and dock. The WhatsApp link is drawn secondary
// so Book is the one primary action; the stay page's own link changes to match in task 3 once this is signed.
function WhatsApp({ ctx, size }: { ctx: SceneContext; size: "bar-auto" | "lg" | "md" }) {
  return (
    <LinkButton
      href={stayRequestHref("[message]")}
      variant="secondary"
      size={size}
      className={size === "lg" ? "w-full whitespace-normal px-3 text-center tracking-normal" : undefined}
    >
      <WhatsAppIcon size={20} aria-hidden="true" />
      <span className={size === "md" ? "sr-only md:not-sr-only" : undefined}>{STAY_DETAIL_COPY[ctx.locale].whatsapp.button}</span>
    </LinkButton>
  );
}

function BookBar({ ctx, dates }: { ctx: SceneContext; dates: boolean }) {
  const value: JourneyValue = dates
    ? { ...ctx.fixtures.filledJourney, ...ctx.fixtures.guestsTwoAdults }
    : { ...ctx.fixtures.emptyJourney, destinationId: "cartagena" };
  return (
    <div className="flex flex-col gap-2">
      <JourneyBar
        size="hero"
        destinations={ctx.fixtures.destinations}
        value={value}
        onChange={() => undefined}
        copy={ctx.copy}
        locale={ctx.locale}
        today={TODAY}
        lockDestination
        lockStay={{ label: ctx.copy.steps.stay, value: ctx.fixtures.stay.name }}
        action={
          <div className="flex gap-3">
            <BookLink size="bar" href={dates ? "/booking/trip" : null} label={ctx.copy.trip.book.label} describedBy={dates ? undefined : "need-dates"} />
            <WhatsApp ctx={ctx} size="bar-auto" />
          </div>
        }
      />
      {dates ? null : (
        <p id="need-dates" role="status" className="m-0 text-label text-error">
          {ctx.copy.trip.book.needDates}
        </p>
      )}
    </div>
  );
}

function BookLinkScene({ ctx }: { ctx: SceneContext }) {
  const label = ctx.copy.trip.book.label;
  return (
    <div data-testid="harness-book-link" className="mx-auto flex w-full max-w-column flex-col gap-10 px-4 py-8 md:px-8">
      <div className="hidden flex-col gap-10 md:flex">
        <BookBar ctx={ctx} dates={false} />
        <BookBar ctx={ctx} dates />
      </div>
      <div className="flex flex-col gap-8 md:hidden">
        <div className="flex flex-col gap-3">
          <BookLink size="sheet" href={null} label={label} describedBy="need-dates-sheet" />
          <WhatsApp ctx={ctx} size="lg" />
          <p id="need-dates-sheet" role="status" className="m-0 text-label text-error">
            {ctx.copy.trip.book.needDates}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <BookLink size="sheet" href="/booking/trip" label={label} />
          <WhatsApp ctx={ctx} size="lg" />
        </div>
        <StickyDock
          summary={
            <>
              <span className="truncate text-body text-ink">{ctx.fixtures.stay.name}</span>
              <span className="truncate text-label text-muted">{DATES}</span>
            </>
          }
          action={
            <div className="flex gap-2">
              <BookLink size="dock" href="/booking/trip" label={label} />
              <WhatsApp ctx={ctx} size="md" />
            </div>
          }
        />
      </div>
    </div>
  );
}

export const scenes: Scenes = {
  "stay-ok": (ctx) => <Stay ctx={ctx} reasons={[]} />,
  "stay-reasons": (ctx) => (
    <Stay
      ctx={ctx}
      reasons={[
        { code: "sold_out", nights: SOLD },
        { code: "below_min_nights", min: 3 },
        { code: "over_max_guests", max: 3 },
      ]}
    />
  ),
  addons: (ctx) => <Addons ctx={ctx} />,
  "travellers-empty": (ctx) => <Travellers ctx={ctx} initial={EMPTY} />,
  "travellers-errors": (ctx) => <Travellers ctx={ctx} initial={{ ...EMPTY, notStaying: true }} errors={ERRORS} />,
  "travellers-pickup": (ctx) => <Travellers ctx={ctx} initial={FILLED} needsPickup />,
  "pay-choose": (ctx) => <Pay ctx={ctx} />,
  "pay-deposit-blocked": (ctx) => (
    <Pay
      ctx={ctx}
      initial={{ deposit: null, depositBlock: "too_close_to_arrival", balanceDueDays: 14, plan: "full" }}
    />
  ),
  "pay-errors": (ctx) => <Pay ctx={ctx} initial={{ errors: { plan: true, airport: true, terms: true } }} />,
  "pay-held": (ctx) => held(ctx, "ready"),
  "pay-held-error": (ctx) => held(ctx, "error"),
  "pay-confirming": (ctx) => held(ctx, "confirming"),
  "hold-ended": (ctx) => held(ctx, null, true),
  "book-link": (ctx) => <BookLinkScene ctx={ctx} />,
};

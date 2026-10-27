"use client";

// Plan 04-06 (signed 2026-10-27 as pictures/04-06/index.html): the trip page after Send request and after a refresh,
// drawn from the real components inside 04-03's TripLayout. Symbolic data only: "AED [AMOUNT]", "[DD/MM/YYYY]",
// "[HH:MM]", reference "ALMAR-7K3QH9", the fixture stay and add-ons; never a real price, date or person. The held,
// sending, too many, taken and ended states are 04-03's (tests/journey/scenes/booking-trip.tsx) and are not drawn here.
// RequestStep's props are copied from 04-03's scene, not imported. Not in tests/journey/matrix.ts (no baselines).

import { Fragment, type ReactNode } from "react";
import { BookingReasons } from "../../../components/journey/booking-reasons";
import { JourneyCart } from "../../../components/journey/journey-cart";
import { RequestStep, type TripPlanChoice } from "../../../components/journey/request-step";
import { RequestChecking, RequestElsewhere, RequestRetryNote, RequestSent } from "../../../components/journey/request-sent";
import { TripLayout } from "../../../components/journey/trip-layout";
import type { CartLine } from "../../../components/journey/types";
import type { BookingReason } from "../../../lib/booking/types";
import { formatGuestSummary } from "../../../lib/journey-format";
import type { SceneContext, Scenes } from "../scene-types";

const REF = "ALMAR-7K3QH9";
const WINDOW = "[N] hours";
const DATE = "[DD/MM/YYYY]";
const TIME = "[HH:MM]";
const ENDS_AT = "2026-10-12T10:30:00Z";
// 29:41 left on the hold, every second of the shoot.
const FIXED_NOW = () => Date.parse("2026-10-12T10:00:19Z");
const LINKS = { stay: "/en/private-stays/getsemani-colonial-house", whatsapp: "https://wa.me/971563883302", startAgain: "/en/private-stays/getsemani-colonial-house" };
const HELP = "https://wa.me/971563883302";
const GUESTS = { adults: 2, children: 1, infants: 1 };
const noop = () => undefined;

const bookingHref = (ctx: SceneContext) => `/${ctx.locale}/bookings/trip?ref=${REF}&t=[link-token]`;

function cartLines(ctx: SceneContext): CartLine[] {
  const [pickup, , , , heritage] = ctx.fixtures.addOns;
  return [
    { id: pickup.id, name: pickup.name, quantity: 1, amount: ctx.fixtures.AMOUNT },
    { id: heritage.id, name: heritage.name, quantity: 2, amount: ctx.fixtures.AMOUNT },
  ];
}

function Cart({ ctx, plan }: { ctx: SceneContext; plan: TripPlanChoice }) {
  const f = ctx.fixtures;
  const c = ctx.copy.cart;
  return (
    <JourneyCart
      destinationName="Cartagena"
      stay={{
        image: f.stay.image,
        name: f.stay.name,
        dates: `${f.dates.startLabel} – ${f.dates.endLabel}`,
        guests: formatGuestSummary(GUESTS, ctx.locale, ctx.copy.guests.summary),
        nights: f.dates.nights,
        amount: f.AMOUNT,
      }}
      lines={cartLines(ctx)}
      inclusionsCount={4}
      subtotal={f.AMOUNT}
      vat={f.AMOUNT}
      total={f.AMOUNT}
      planRows={
        plan === "deposit"
          ? [
              { label: c.payFirst, amount: f.AMOUNT },
              { label: c.balanceBy.replace("{date}", DATE), amount: f.AMOUNT },
            ]
          : [{ label: c.payFull, amount: f.AMOUNT }]
      }
      locked
      onRemove={noop}
      onContinue={noop}
      copy={ctx.copy}
      locale={ctx.locale}
      variant="rail"
      className="w-full static md:w-rail md:sticky"
    />
  );
}

/** The trip page frame at step 4. `rail`: the held step keeps Change; the after-request states have none (the screen). */
function Page({ ctx, plan, rail, children }: { ctx: SceneContext; plan: TripPlanChoice; rail: boolean; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-column px-4 py-8 md:px-8">
      <TripLayout title={ctx.copy.trip.title} step={4} onStepChange={rail ? noop : undefined} copy={ctx.copy} cart={<Cart ctx={ctx} plan={plan} />}>
        {children}
      </TripLayout>
    </div>
  );
}

/** bookingStatus.payBy with the symbolic date and time kept left to right (the screen fills uaeDateTime's parts). */
function payBy(ctx: SceneContext): ReactNode {
  const parts = ctx.copy.bookingStatus.payBy.split(/\{(\w+)\}/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <bdi key={i} dir="ltr">
        {part === "date" ? DATE : part === "time" ? TIME : `{${part}}`}
      </bdi>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

// ---- 04-03's held Request step (closed, retry)

function Held({ ctx, reasons, closed, retryNote }: { ctx: SceneContext; reasons: BookingReason[]; closed: boolean; retryNote: boolean }) {
  const f = ctx.fixtures;
  return (
    <Page ctx={ctx} plan="deposit" rail>
      <RequestStep
        plan="deposit"
        deposit={{ now: f.AMOUNT, balance: f.AMOUNT, date: DATE }}
        full={{ now: f.AMOUNT }}
        airport="DXB"
        holdBusy={false}
        onHold={noop}
        holdDisabled={false}
        held={{ ref: REF, endsAt: ENDS_AT, dueNow: f.AMOUNT, windowText: WINDOW }}
        onChange={noop}
        ended={false}
        startAgainHref={LINKS.stay}
        refusal={{ at: "request", reasons }}
        reasonLinks={LINKS}
        canRequest={closed ? { ok: false, reason: "requests_closed" } : { ok: true }}
        onRequest={noop}
        secondCityHref={LINKS.whatsapp}
        now={FIXED_NOW}
        onEnd={noop}
        copy={ctx.copy}
        locale={ctx.locale}
      />
      {retryNote ? <RequestRetryNote text={ctx.copy.afterRequest.retryNote} /> : null}
    </Page>
  );
}

// ---- the after-request states

function Sent({ ctx, plan, amount, emailLine }: { ctx: SceneContext; plan: TripPlanChoice; amount: boolean; emailLine: "sent" | "page" }) {
  const a = ctx.copy.afterRequest;
  return (
    <Page ctx={ctx} plan={plan} rail={false}>
      <RequestSent
        reference={REF}
        planLabel={amount ? (plan === "deposit" ? a.planDeposit : a.planFull) : null}
        amountText={amount ? ctx.fixtures.AMOUNT : null}
        deadlineText={payBy(ctx)}
        emailLine={emailLine}
        bookingHref={bookingHref(ctx)}
        helpHref={HELP}
        copy={ctx.copy}
      />
    </Page>
  );
}

function Checking({ ctx, failed }: { ctx: SceneContext; failed: boolean }) {
  return (
    <Page ctx={ctx} plan="deposit" rail={false}>
      <RequestChecking
        copy={ctx.copy}
        failed={failed}
        onRetry={noop}
        reasonsSlot={<BookingReasons reasons={[{ code: "unavailable" }]} copy={ctx.copy} locale={ctx.locale} links={LINKS} live="assertive" />}
      />
    </Page>
  );
}

function Elsewhere({ ctx }: { ctx: SceneContext }) {
  return (
    <Page ctx={ctx} plan="deposit" rail={false}>
      <RequestElsewhere reference={REF} bookingHref={bookingHref(ctx)} copy={ctx.copy} />
    </Page>
  );
}

export const scenes: Scenes = {
  sent: (ctx) => <Sent ctx={ctx} plan="deposit" amount emailLine="sent" />,
  "sent-no-amount": (ctx) => <Sent ctx={ctx} plan="deposit" amount={false} emailLine="sent" />,
  closed: (ctx) => <Held ctx={ctx} reasons={[{ code: "requests_closed" }]} closed retryNote={false} />,
  retry: (ctx) => <Held ctx={ctx} reasons={[{ code: "unavailable" }]} closed={false} retryNote />,
  checking: (ctx) => <Checking ctx={ctx} failed={false} />,
  "checking-failed": (ctx) => <Checking ctx={ctx} failed />,
  "resumed-sent": (ctx) => <Sent ctx={ctx} plan="full" amount emailLine="page" />,
  "resumed-elsewhere": (ctx) => <Elsewhere ctx={ctx} />,
};

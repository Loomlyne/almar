"use client";

import { Fragment, useId, type ReactNode } from "react";
import type { Airport, BookingReason } from "../../lib/booking/types";
import type { DepositBlock } from "../../lib/money/booking-price";
import { fill, formatPlural } from "../../lib/journey-format";
import { cn } from "../../lib/cn";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { ToggleCardGroup, type ToggleCardOption } from "../ui/toggle-card";
import { BookingReasons } from "./booking-reasons";
import { HoldTimer } from "./hold-timer";
import type { JourneyCopy, Locale } from "./types";

export type PayPlan = "deposit" | "full";

export type PayStepProps = {
  plan: PayPlan | null;
  onPlanChange: (plan: PayPlan) => void;
  /** The server's deposit option, as display strings. Null when the deposit is blocked. The page adds nothing (D-52). */
  deposit: { now: string; balance: string; date: string } | null;
  /** Why the deposit is not offered (B-21), from the quote. Null when it is offered. */
  depositBlock: DepositBlock | null;
  /** The balance-due days (N), when the server tells the page; the "within N days" sentence needs it. */
  balanceDueDays?: number | null;
  full: { now: string };
  airport: Airport | null;
  onAirportChange: (airport: Airport) => void;
  termsAccepted: boolean;
  onTermsChange: (accepted: boolean) => void;
  /** The booking terms page. Null until the owner supplies the text: the link then shows as [Booking terms] with no address. */
  termsHref?: string | null;
  /** Which choices still need an answer after Continue was pressed. */
  errors?: { plan?: boolean; airport?: boolean; terms?: boolean };
  /** The refusals from the hold request (409, 429), shown with the way back. */
  reasons?: BookingReason[];
  stayHref: string;
  busy?: boolean;
  onBack: () => void;
  onContinue: () => void;
  /** Set once the hold is placed: the server's end time. */
  holdEndsAt?: string | null;
  getNow?: () => number;
  onHoldEnd?: () => void;
  /** The Payment Element and its Pay button. 04-06 mounts it here; null until then. */
  paymentArea?: ReactNode;
  copy: JourneyCopy;
  locale: Locale;
  className?: string;
};

const AIRPORTS: Airport[] = ["DXB", "AUH", "SHJ"];

function depositReason(block: DepositBlock, days: number | null | undefined, copy: JourneyCopy, locale: Locale): string {
  const p = copy.pay;
  if (block === "too_close_to_arrival") {
    return typeof days === "number" ? formatPlural(p.blockedSoon, days, locale) : p.blockedSoonUnknown;
  }
  return p.blockedOther;
}

/** Step 4: deposit or full, UAE airport, terms, the hold and its timer, then the payment area (PAY-01, PAY-03, B-09, B-21). */
export function PayStep({
  plan,
  onPlanChange,
  deposit,
  depositBlock,
  balanceDueDays,
  full,
  airport,
  onAirportChange,
  termsAccepted,
  onTermsChange,
  termsHref = null,
  errors = {},
  reasons = [],
  stayHref,
  busy = false,
  onBack,
  onContinue,
  holdEndsAt = null,
  getNow,
  onHoldEnd,
  paymentArea = null,
  copy,
  locale,
  className,
}: PayStepProps) {
  const p = copy.pay;
  const uid = useId();
  const planLabel = `${uid}-plan`;
  const airportLabel = `${uid}-airport`;
  const termsErrorId = `${uid}-terms-error`;
  const held = holdEndsAt !== null;

  const blocked = deposit === null || depositBlock !== null;
  const planOptions: ToggleCardOption[] = [
    {
      value: "deposit",
      title: p.deposit,
      detail: blocked ? depositReason(depositBlock ?? "zero_deposit", balanceDueDays, copy, locale) : undefined,
      amount: !blocked && deposit ? fill(p.depositDetail, { now: deposit.now, balance: deposit.balance, date: deposit.date }) : undefined,
      disabled: blocked,
    },
    { value: "full", title: p.full, amount: fill(p.fullDetail, { total: full.now }) },
  ];
  const airportOptions: ToggleCardOption[] = AIRPORTS.map((code) => ({ value: code, title: p.airports[code] }));

  const [termsBefore, termsAfter] = p.termsLabel.split("{terms}");
  const termsText = termsHref ? (
    <a href={termsHref} className="text-teal underline decoration-gold decoration-1 underline-offset-4">
      {p.termsLink}
    </a>
  ) : (
    <span className="text-teal">{p.termsLink}</span>
  );

  return (
    <section aria-labelledby={`${uid}-title`} className={cn("flex flex-col gap-8", className)}>
      <h2 id={`${uid}-title`} className="m-0">
        {held ? p.held : p.title}
      </h2>

      <div className="flex flex-col gap-3">
        <h3 id={planLabel} className="m-0 font-display text-title text-teal">
          {p.planLabel}
        </h3>
        <ToggleCardGroup
          labelId={planLabel}
          value={plan}
          onChange={(v) => onPlanChange(v as PayPlan)}
          options={planOptions}
          error={errors.plan ? p.choice.error : undefined}
          className="md:grid-cols-2"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 id={airportLabel} className="m-0 font-display text-title text-teal">
            {p.airportLabel}
          </h3>
          <p className="m-0 text-label text-muted">{p.airportHint}</p>
        </div>
        <ToggleCardGroup
          labelId={airportLabel}
          value={airport}
          onChange={(v) => onAirportChange(v as Airport)}
          options={airportOptions}
          error={errors.airport ? p.airport.error : undefined}
          className="md:grid-cols-3"
        />
        <p className="m-0 text-label text-muted">{p.airportReturn}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Checkbox
          checked={termsAccepted}
          onChange={(e) => onTermsChange(e.target.checked)}
          aria-invalid={errors.terms || undefined}
          aria-describedby={errors.terms ? termsErrorId : undefined}
          label={
            <Fragment>
              {termsBefore}
              {termsText}
              {termsAfter}
            </Fragment>
          }
        />
        {errors.terms ? (
          <p id={termsErrorId} role="alert" className="m-0 text-label text-error">
            {p.termsError}
          </p>
        ) : null}
      </div>

      {reasons.length > 0 ? <BookingReasons reasons={reasons} backHref={stayHref} copy={copy} locale={locale} /> : null}

      {held && holdEndsAt ? (
        <div className="flex flex-col gap-6">
          <HoldTimer endsAt={holdEndsAt} restartHref={stayHref} onEnd={onHoldEnd} getNow={getNow} copy={copy} locale={locale} />
          {paymentArea}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-label text-muted">{p.holdNote}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="lg" onClick={onBack}>
              {p.back}
            </Button>
            <Button size="lg" onClick={onContinue} busy={busy}>
              {p.continue}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

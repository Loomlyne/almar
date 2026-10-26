import { Fragment, useId, type ReactNode } from "react";
import type { DepositBlock } from "../../lib/money/booking-price";
import type { Airport, BookingReason } from "../../lib/booking/types";
import { AlertCircleIcon, CheckIcon } from "../icons/icons";
import { Button, LinkButton } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Link } from "../ui/link";
import { ToggleCardGroup } from "../ui/toggle-card";
import { BookingReasons, type BookingReasonLinks } from "./booking-reasons";
import { HoldTimer } from "./hold-timer";
import type { JourneyCopy, Locale } from "./types";

// Plan 04-03 (signed 2026-10-25, Q-01 = B). RequestChoices (deposit or full, the UAE airport, the terms box) ends the
// Travellers step; RequestStep is step 4: the hold is placed as it opens ("Holding your dates…"), a refused hold shows
// its reasons with "Hold my dates" as the retry, and once held the choices are read-only with Change (the screen asks
// before it releases: Q-08), the countdown, What happens next (Q-10) and Send request. Every amount, date and window
// arrives as a display string; no card form, no coupon, no bank detail (B-26). Square toggle cards, never radios.

export type TripPlanChoice = "deposit" | "full";

export type RequestChoicesProps = {
  plan: TripPlanChoice | null;
  onPlan: (plan: TripPlanChoice) => void;
  /** The deposit as the server priced it, or null when there is none. */
  deposit: { now: string; balance: string; date: string } | null;
  depositBlocked: DepositBlock | null;
  full: { now: string };
  airport: Airport | null;
  onAirport: (airport: Airport) => void;
  terms: boolean;
  onTerms: (accepted: boolean) => void;
  errors: { plan?: boolean; airport?: boolean; terms?: boolean };
  copy: JourneyCopy;
  locale: Locale;
};

const AIRPORTS: Airport[] = ["DXB", "AUH", "SHJ"];
const GROUP_HEAD = "m-0 mb-2 text-body text-ink";

function fillNodes(template: string, slots: Record<string, ReactNode>): ReactNode {
  return template
    .split(/\{(\w+)\}/g)
    .map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{slots[part] ?? `{${part}}`}</Fragment> : part));
}

const ltr = (text: string) => <bdi dir="ltr">{text}</bdi>;

function depositDetail(copy: JourneyCopy, d: { now: string; balance: string; date: string }): ReactNode {
  return fillNodes(copy.request.depositDetail, { now: ltr(d.now), balance: ltr(d.balance), date: ltr(d.date) });
}

function fullDetail(copy: JourneyCopy, f: { now: string }): ReactNode {
  return fillNodes(copy.request.fullDetail, { now: ltr(f.now) });
}

function ErrorLine({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="m-0 mt-2 flex items-center gap-2 text-label text-error">
      <AlertCircleIcon size={20} className="shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function RequestChoices({
  plan,
  onPlan,
  deposit,
  depositBlocked,
  full,
  airport,
  onAirport,
  terms,
  onTerms,
  errors,
  copy,
}: RequestChoicesProps) {
  const r = copy.request;
  const ids = useId();
  const payId = `${ids}-pay`;
  const airportId = `${ids}-airport`;
  const termsErrorId = `${ids}-terms-error`;
  const depositOff = deposit === null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 id={payId} className={GROUP_HEAD}>
          {r.paymentHeading}
        </h3>
        <ToggleCardGroup
          labelId={payId}
          value={plan === "deposit" && depositOff ? null : plan}
          onChange={(v) => onPlan(v as TripPlanChoice)}
          error={errors.plan ? copy.pay.choice.error : undefined}
          options={[
            {
              value: "deposit",
              title: r.deposit,
              detail: depositOff
                ? r.depositUnavailable[depositBlocked ?? "no_due_days"]
                : depositDetail(copy, deposit),
              disabled: depositOff,
            },
            { value: "full", title: r.full, detail: fullDetail(copy, full) },
          ]}
        />
      </div>
      <div>
        <h3 id={airportId} className={GROUP_HEAD}>
          {r.airportHeading}
        </h3>
        <ToggleCardGroup
          labelId={airportId}
          value={airport}
          onChange={(v) => onAirport(v as Airport)}
          error={errors.airport ? copy.pay.airport.error : undefined}
          options={AIRPORTS.map((code) => ({ value: code, title: r.airports[code] }))}
        />
        <p className="m-0 mt-2 text-label text-muted">{r.returnSame}</p>
      </div>
      <div>
        <Checkbox
          label={r.terms}
          checked={terms}
          onChange={(e) => onTerms(e.target.checked)}
          aria-invalid={errors.terms || undefined}
          aria-describedby={errors.terms ? termsErrorId : undefined}
        />
        {errors.terms ? <ErrorLine id={termsErrorId}>{copy.pay.terms.error}</ErrorLine> : null}
      </div>
      <p className="m-0 text-label text-muted">{r.windowNote}</p>
    </div>
  );
}

export type RequestStepProps = {
  plan: TripPlanChoice | null;
  deposit: RequestChoicesProps["deposit"];
  full: RequestChoicesProps["full"];
  airport: Airport | null;
  /** The hold is being placed (the step's opening, or a retry). */
  holdBusy: boolean;
  /** The retry after a refused or failed hold. */
  onHold: () => void;
  holdDisabled: boolean;
  held: {
    ref: string;
    endsAt: string;
    /** The amount of the first transfer ("AED 1,050.00"). */
    dueNow: string;
    /** "35 minutes", "2 hours", "1 day". */
    windowText: string;
  } | null;
  /** Change on the read-only choices: the screen asks, releases, then reopens Travellers. */
  onChange: () => void;
  ended: boolean;
  startAgainHref: string;
  /** The refusal of the last hold ("hold") or request ("request"). */
  refusal: { at: "hold" | "request"; reasons: BookingReason[] } | null;
  reasonLinks: BookingReasonLinks;
  offerName?: (id: string) => string | undefined;
  canRequest: { ok: true } | { ok: false; reason: string };
  requestBusy?: boolean;
  onRequest: () => void;
  secondCityHref: string;
  now?: () => number;
  onEnd: () => void;
  copy: JourneyCopy;
  locale: Locale;
};

export function RequestStep(props: RequestStepProps) {
  const { held, ended, copy } = props;
  const r = copy.request;
  return (
    <section className="@container flex flex-col gap-6" aria-labelledby="trip-step-request">
      <h2 id="trip-step-request" className="m-0 font-display text-title text-teal">
        {copy.trip.stepTitle.request}
      </h2>
      {ended ? (
        <div role="alert" className="flex flex-col items-start gap-3 border border-error border-s-4 bg-surface p-4">
          <p className="m-0 text-body text-ink">{r.ended}</p>
          <LinkButton href={props.startAgainHref}>{r.startAgain}</LinkButton>
        </div>
      ) : held ? (
        <Held {...props} held={held} />
      ) : (
        <Placing {...props} />
      )}
    </section>
  );
}

function Placing({ holdBusy, onHold, holdDisabled, refusal, reasonLinks, offerName, copy, locale }: RequestStepProps) {
  const r = copy.request;
  return (
    <div className="flex flex-col gap-4">
      {holdBusy ? (
        <p role="status" className="m-0 flex items-center gap-3 bg-teal-tint p-4 text-label text-teal">
          <span aria-hidden="true" className="size-4 shrink-0 border border-teal motion-safe:animate-spin" />
          <span>{r.holding}</span>
        </p>
      ) : (
        <>
          {refusal && refusal.at === "hold" ? (
            <BookingReasons
              reasons={refusal.reasons}
              copy={copy}
              locale={locale}
              links={reasonLinks}
              offerName={offerName}
              at="hold"
              live="assertive"
            />
          ) : null}
          <div className="flex">
            <Button onClick={onHold} disabled={holdDisabled}>
              {r.hold}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Held({
  held,
  plan,
  deposit,
  full,
  airport,
  onChange,
  refusal,
  reasonLinks,
  offerName,
  canRequest,
  requestBusy = false,
  onRequest,
  secondCityHref,
  now,
  onEnd,
  copy,
  locale,
}: RequestStepProps & { held: NonNullable<RequestStepProps["held"]> }) {
  const r = copy.request;
  const steps: ReactNode[] = [
    r.nextSend,
    r.nextEmail,
    fillNodes(r.nextTransfer, { amount: ltr(held.dueNow), window: held.windowText, ref: ltr(held.ref) }),
    r.nextReceipt,
    r.nextWithdraw,
  ];
  const deposited = plan === "deposit" && deposit !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 bg-teal-tint px-6 py-4 text-teal">
        <h3 className="m-0 font-display text-title">{r.heldTitle}</h3>
        <HoldTimer endsAt={held.endsAt} now={now} onEnd={onEnd} copy={copy} className="font-display text-heading" />
      </div>

      <div className="flex flex-col gap-3 border border-line bg-surface p-4">
        <div className="flex justify-end">
          <Button variant="ghost" className="px-4" onClick={onChange}>
            {r.change}
          </Button>
        </div>
        <dl className="m-0 grid grid-cols-1 gap-3 @lg:grid-cols-3 @lg:gap-x-4">
          <dt className="text-caption text-muted @lg:text-label">{r.paymentHeading}</dt>
          <dd className="m-0 flex flex-col @lg:col-span-2">
            <span className="font-display text-title text-teal">{deposited ? r.deposit : r.full}</span>
            <span className="text-label text-muted">
              {deposited && deposit ? depositDetail(copy, deposit) : fullDetail(copy, full)}
            </span>
          </dd>
          <dt className="text-caption text-muted @lg:text-label">{r.airportHeading}</dt>
          <dd className="m-0 flex flex-col @lg:col-span-2">
            <span>{airport ? r.airports[airport] : null}</span>
            <span className="text-label text-muted">{r.returnSame}</span>
          </dd>
          <dt className="sr-only">{r.terms}</dt>
          <dd className="m-0 flex items-center gap-2 text-ink @lg:col-span-2 @lg:col-start-2">
            <span aria-hidden="true" className="inline-grid size-5 shrink-0 place-items-center bg-teal text-ivory">
              <CheckIcon size={16} />
            </span>
            <span>{r.terms}</span>
          </dd>
        </dl>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="m-0 font-display text-title text-teal">{r.nextHeading}</h3>
        <ol className="m-0 p-0 list-none flex flex-col gap-3">
          {steps.map((line, i) => (
            <li key={i} className="flex gap-2 border-s-2 border-gold ps-3 text-body text-ink">
              <span className="tabular-nums">{i + 1}.</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col items-start gap-2">
        <Button onClick={onRequest} disabled={!canRequest.ok} busy={requestBusy}>
          {requestBusy ? r.sending : r.send}
        </Button>
        {refusal && refusal.at === "request" ? (
          <BookingReasons
            reasons={refusal.reasons}
            copy={copy}
            locale={locale}
            links={reasonLinks}
            offerName={offerName}
            live="assertive"
            className="self-stretch"
          />
        ) : null}
      </div>

      <p className="m-0 text-label">
        <Link href={secondCityHref} target="_blank" rel="noopener noreferrer">
          {copy.summary.secondCity}
        </Link>
      </p>
    </div>
  );
}

"use client";

import type { CalendarDate } from "@internationalized/date";
import type { ReactNode } from "react";
import type { Locale3 } from "../../../../../components/ops/api-types";
import { DateRangePanel, type DateRangeValue } from "../../../../../components/journey/date-range-panel";
import { GuestPanel, type GuestCounts } from "../../../../../components/journey/guest-panel";
import type { JourneyCopy } from "../../../../../components/journey/types";
import { Button } from "../../../../../components/ui/button";
import { Checkbox } from "../../../../../components/ui/checkbox";
import { Chip } from "../../../../../components/ui/chip";
import { Field } from "../../../../../components/ui/field";
import { LINK_BUTTON } from "../../../../../components/ui/link";
import { Select, type SelectOption } from "../../../../../components/ui/select";
import { Stepper } from "../../../../../components/ui/stepper";
import { ToggleCard } from "../../../../../components/ui/toggle-card";
import type { OpsNewBookingCopy } from "../../../../../lib/copy/ops-new-booking";
import { fillCopy } from "../../../../../lib/copy/ops-kit";
import { formatAed } from "../../../../../lib/money/format";
import type { AddOnOffering, Airport } from "../../../../../lib/booking/types";
import type { OwnerBreakdown } from "../../../../../lib/ops/new-booking-contract";
import type { NewBookingStep } from "../../../../../lib/ops/new-booking-rules";
import { dayIn } from "../bookings-text";

// Plan 05-02 Task 3: the five steps of New booking, each a pure props component (state lives in new-booking-screen.tsx). Every
// amount shown is the server's (the quote's breakdown or an offer's price); nothing is added up here. Square corners, teal
// primary, no radio controls (ToggleCard is aria-pressed), no underlined text. Browser-only chunk: reached through the loader.

export type GuestForm = { name: string; email: string; phone: string };

type Common = { copy: OpsNewBookingCopy; dir: "ltr" | "rtl" };

const SECTION = "grid gap-4 border border-line bg-surface p-4 md:p-6";
const HEADING = "m-0 font-display text-title font-normal text-teal outline-none";
const ERROR = "m-0 text-label text-error";

/** The step's heading: scroll and focus land here on each step change (id nb-step-heading). */
function StepHeading({ children }: { children: ReactNode }) {
  return (
    <h2 id="nb-step-heading" tabIndex={-1} className={HEADING}>
      {children}
    </h2>
  );
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className={ERROR}>
      {children}
    </p>
  );
}

/** Back and Continue. On a phone the bar at the bottom carries Continue, so the in-step one is hidden there. */
function Nav({ copy, onBack, onNext, nextLabel, busy, disabled }: { copy: OpsNewBookingCopy; onBack?: () => void; onNext: () => void; nextLabel?: string; busy?: boolean; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onBack ? (
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          {copy.back}
        </Button>
      ) : null}
      <Button className="max-md:hidden" onClick={onNext} busy={busy} disabled={disabled}>
        {nextLabel ?? copy.continue}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------
// 1. Guest
// ------------------------------------------------------------------------------------------------------------

export function GuestStep({
  copy,
  dir,
  guest,
  onGuest,
  bookingLocale,
  onLocale,
  errors,
  quiet,
  onNext,
}: Common & {
  guest: GuestForm;
  onGuest: (next: GuestForm) => void;
  bookingLocale: Locale3;
  onLocale: (next: Locale3) => void;
  errors: { name?: boolean; email?: boolean; phone?: boolean };
  /** The one quiet line when a request could not be read. */
  quiet: string | null;
  onNext: () => void;
}) {
  const g = copy.guest;
  const languages: SelectOption[] = [
    { value: "en", label: g.languages.en },
    { value: "ar", label: g.languages.ar },
    { value: "es", label: g.languages.es },
  ];
  return (
    <section className={SECTION} aria-labelledby="nb-step-heading">
      <StepHeading>{g.heading}</StepHeading>
      {quiet ? <p className="m-0 text-label text-muted">{quiet}</p> : null}
      <Field
        id="nb-name"
        label={g.name}
        className="max-w-none md:max-w-96"
        autoComplete="off"
        maxLength={120}
        value={guest.name}
        error={errors.name ? g.nameError : undefined}
        onChange={(event) => onGuest({ ...guest, name: event.target.value })}
      />
      <Field
        id="nb-email"
        label={g.email}
        className="max-w-none md:max-w-96"
        type="email"
        dir="ltr"
        autoComplete="off"
        value={guest.email}
        error={errors.email ? g.emailError : undefined}
        onChange={(event) => onGuest({ ...guest, email: event.target.value })}
      />
      <Field
        id="nb-phone"
        label={g.phone}
        className="max-w-none md:max-w-96"
        type="tel"
        dir="ltr"
        autoComplete="off"
        value={guest.phone}
        error={errors.phone ? g.phoneError : undefined}
        onChange={(event) => onGuest({ ...guest, phone: event.target.value })}
      />
      <div className="grid gap-2">
        <span id="nb-language-label" className="text-label text-ink">
          {g.language}
        </span>
        <Select
          id="nb-language"
          value={bookingLocale}
          options={languages}
          dir={dir}
          label={`${g.language}: {name}`}
          describedBy="nb-language-hint"
          onChange={(next) => onLocale(next === "ar" || next === "es" ? next : "en")}
        />
        <p id="nb-language-hint" className="m-0 text-label text-muted">
          {g.languageHint}
        </p>
      </div>
      <Nav copy={copy} onNext={onNext} />
    </section>
  );
}

// ------------------------------------------------------------------------------------------------------------
// 2. Stay and dates
// ------------------------------------------------------------------------------------------------------------

export type StayChoice = { slug: string; title: string; destinationId: string };

export function StayStep({
  copy,
  dir,
  locale,
  journeyCopy,
  destinations,
  destination,
  onDestination,
  stays,
  staySlug,
  onStay,
  range,
  onRange,
  today,
  blocked,
  counts,
  onCounts,
  availability,
  availabilityError,
  lines,
  loadError,
  onBack,
  onNext,
}: Common & {
  locale: Locale3;
  journeyCopy: JourneyCopy;
  destinations: { id: string; name: string }[];
  destination: string;
  onDestination: (next: string) => void;
  stays: StayChoice[];
  staySlug: string | null;
  onStay: (next: string) => void;
  range: DateRangeValue;
  onRange: (next: DateRangeValue) => void;
  today: CalendarDate;
  blocked: CalendarDate[];
  counts: GuestCounts;
  onCounts: (next: GuestCounts) => void;
  /** The nights not available in the chosen range (blocked or booked); null while no range is complete. */
  availability: string[] | null;
  availabilityError: boolean;
  /** The quote's reasons that belong here, already said in words. */
  lines: string[];
  loadError: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const s = copy.stay;
  const destinationOptions: SelectOption[] = [{ value: "all", label: s.all }, ...destinations.map((d) => ({ value: d.id, label: d.name }))];
  const stayOptions: SelectOption[] = stays
    .filter((one) => destination === "all" || one.destinationId === destination)
    .map((one) => ({ value: one.slug, label: one.title }));
  const unavailable = availability !== null && availability.length > 0;
  return (
    <section className={SECTION} aria-labelledby="nb-step-heading">
      <StepHeading>{s.heading}</StepHeading>
      {loadError ? <Problem>{loadError}</Problem> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <span className="text-label text-ink">{s.destinations}</span>
          <Select
            id="nb-destination"
            value={destination}
            options={destinationOptions}
            dir={dir}
            label={`${s.destinations}: {name}`}
            onChange={onDestination}
          />
        </div>
        <div className="grid gap-2">
          <span className="text-label text-ink">{s.stays}</span>
          <Select
            id="nb-stay"
            value={staySlug}
            options={stayOptions}
            dir={dir}
            placeholder={s.choose}
            label={`${s.stays}: {name}`}
            onChange={onStay}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <span className="text-label text-ink">{s.dates}</span>
        <DateRangePanel
          value={range}
          onChange={onRange}
          onDone={() => undefined}
          onClear={() => onRange({ start: null, end: null })}
          locale={locale}
          copy={journeyCopy}
          months={1}
          today={today}
          blocked={blocked}
          footer={false}
          endOnBlocked
          className="max-w-full border border-line shadow-none"
        />
        <span className="inline-flex items-center gap-2 text-caption text-muted">
          <span aria-hidden="true" className="inline-flex size-6 items-center justify-center border border-line bg-surface line-through">
            1
          </span>
          {s.legend}
        </span>
      </div>
      <div className="grid gap-2">
        <span className="text-label text-ink">{s.guests}</span>
        <GuestPanel counts={counts} onChange={onCounts} onDone={() => undefined} footer={false} locale={locale} copy={journeyCopy} className="max-w-full border border-line shadow-none" />
      </div>
      <div className="grid gap-1" aria-live="polite">
        <span className="text-label text-ink">{s.availability}</span>
        {availabilityError ? (
          <Problem>{copy.problems.unavailable}</Problem>
        ) : availability === null ? (
          <p className="m-0 text-label text-muted">{s.choose}</p>
        ) : unavailable ? (
          <p className={ERROR}>{fillCopy(s.unavailable, { nights: availability.map((night) => dayIn(night)).join(", ") })}</p>
        ) : (
          <p className="m-0 text-label font-bold text-teal">{s.available}</p>
        )}
        {lines.map((line) => (
          <p key={line} className={ERROR}>
            {line}
          </p>
        ))}
      </div>
      <Nav copy={copy} onBack={onBack} onNext={onNext} />
    </section>
  );
}

// ------------------------------------------------------------------------------------------------------------
// 3. Extras
// ------------------------------------------------------------------------------------------------------------

export type KindFilter = "all" | "experience" | "service";

export function ExtrasStep({
  copy,
  dir,
  journeyCopy,
  offers,
  search,
  onSearch,
  kind,
  onKind,
  picks,
  onPick,
  rowProblems,
  removeWord,
  airport,
  onAirport,
  needsPickup,
  pickup,
  onPickup,
  pickupError,
  onBack,
  onNext,
}: Common & {
  journeyCopy: JourneyCopy;
  offers: AddOnOffering[];
  search: string;
  onSearch: (next: string) => void;
  kind: KindFilter;
  onKind: (next: KindFilter) => void;
  picks: Record<string, number>;
  onPick: (id: string, qty: number) => void;
  /** Offer id to the sentence the quote gave for it. */
  rowProblems: Record<string, string>;
  /** The word for taking an extra off (the kit's Remove), for the stepper's accessible name. */
  removeWord: string;
  airport: Airport | "none";
  onAirport: (next: Airport | "none") => void;
  needsPickup: boolean;
  pickup: string;
  onPickup: (next: string) => void;
  pickupError: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const x = copy.extras;
  const needle = search.trim().toLowerCase();
  const shown = offers.filter((o) => (kind === "all" || o.kind === kind) && (needle === "" || o.name.toLowerCase().includes(needle)));
  const airportOptions: SelectOption[] = [
    { value: "none", label: x.noAirport },
    { value: "DXB", label: x.airports.DXB },
    { value: "AUH", label: x.airports.AUH },
    { value: "SHJ", label: x.airports.SHJ },
  ];
  const filters: { value: KindFilter; label: string }[] = [
    { value: "all", label: x.all },
    { value: "experience", label: x.experiences },
    { value: "service", label: x.services },
  ];
  return (
    <section className={SECTION} aria-labelledby="nb-step-heading">
      <StepHeading>{x.heading}</StepHeading>
      <Field id="nb-extras-search" label={x.search} search type="search" autoComplete="off" value={search} onChange={(event) => onSearch(event.target.value)} />
      <div className="flex flex-wrap gap-2" role="group" aria-label={x.heading}>
        {filters.map((f) => (
          <Chip key={f.value} on={kind === f.value} onClick={() => onKind(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <ul className="m-0 grid list-none gap-0 p-0">
        {shown.length === 0 ? <li className="py-3 text-label text-muted">{x.nothing}</li> : null}
        {shown.map((offer) => {
          const qty = picks[offer.id] ?? 0;
          return (
            <li key={offer.id} className="grid gap-2 border-b border-line py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid min-w-0 gap-1">
                  <span className="text-body text-ink">{offer.name}</span>
                  <span className="text-caption text-muted">
                    {offer.kind === "experience" ? x.experience : x.service} · <bdi dir="ltr" className="tabular-nums">{formatAed(offer.priceFils)}</bdi> {journeyCopy.addons.unit[offer.unit]}
                  </span>
                </div>
                {qty === 0 ? (
                  <Button variant="secondary" onClick={() => onPick(offer.id, 1)}>
                    {x.add}
                  </Button>
                ) : (
                  <Stepper value={qty} min={0} max={99} onChange={(next) => onPick(offer.id, next)} addLabel={`${x.add}: ${offer.name}`} removeLabel={`${removeWord}: ${offer.name}`} />
                )}
              </div>
              {rowProblems[offer.id] ? <Problem>{rowProblems[offer.id]}</Problem> : null}
            </li>
          );
        })}
      </ul>
      <div className="grid gap-2">
        <span className="text-label text-ink">{x.airport}</span>
        <Select
          id="nb-airport"
          value={airport}
          options={airportOptions}
          dir={dir}
          label={`${x.airport}: {name}`}
          onChange={(next) => onAirport(next === "DXB" || next === "AUH" || next === "SHJ" ? next : "none")}
        />
      </div>
      {needsPickup ? (
        <Field
          id="nb-pickup"
          label={x.pickup}
          className="max-w-none md:max-w-96"
          autoComplete="off"
          maxLength={300}
          value={pickup}
          error={pickupError ? x.pickupError : undefined}
          onChange={(event) => onPickup(event.target.value)}
        />
      ) : null}
      <Nav copy={copy} onBack={onBack} onNext={onNext} />
    </section>
  );
}

// ------------------------------------------------------------------------------------------------------------
// 4. Payment
// ------------------------------------------------------------------------------------------------------------

export function PaymentStep({
  copy,
  mustAgree,
  agreedOn,
  onAgreedOn,
  agreedAmount,
  onAgreedAmount,
  agreedReason,
  onAgreedReason,
  amountError,
  reasonError,
  plan,
  onPlan,
  breakdown,
  holdDate,
  onHoldDate,
  holdTime,
  onHoldTime,
  holdProblem,
  lines,
  onBack,
  onNext,
}: Common & {
  /** The stay has no rate for these nights: the agreed price is required and cannot be switched off. */
  mustAgree: boolean;
  agreedOn: boolean;
  onAgreedOn: (next: boolean) => void;
  agreedAmount: string;
  onAgreedAmount: (next: string) => void;
  agreedReason: string;
  onAgreedReason: (next: string) => void;
  amountError: boolean;
  reasonError: boolean;
  plan: "deposit" | "full";
  onPlan: (next: "deposit" | "full") => void;
  breakdown: OwnerBreakdown | null;
  holdDate: string;
  onHoldDate: (next: string) => void;
  holdTime: string;
  onHoldTime: (next: string) => void;
  holdProblem: string | null;
  lines: string[];
  onBack: () => void;
  onNext: () => void;
}) {
  const p = copy.payment;
  const showAgreed = mustAgree || agreedOn;
  const depositClosed = breakdown !== null && breakdown.deposit === null;
  const depositWhy = breakdown?.depositBlock === "no_due_days" ? p.depositClosed : p.depositUnavailable;
  return (
    <section className={SECTION} aria-labelledby="nb-step-heading">
      <StepHeading>{p.agreedTitle}</StepHeading>
      {mustAgree ? (
        <p className="m-0 text-label text-ink">{p.noRate}</p>
      ) : (
        <Checkbox label={p.agreedToggle} checked={agreedOn} onChange={(event) => onAgreedOn(event.target.checked)} />
      )}
      {showAgreed ? (
        <div className="grid gap-4">
          <Field
            id="nb-amount"
            label={p.agreedAmount}
            hint={p.agreedHint}
            className="max-w-none md:max-w-96"
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            value={agreedAmount}
            error={amountError ? p.amountError : undefined}
            onChange={(event) => onAgreedAmount(event.target.value)}
          />
          <Field
            id="nb-reason"
            label={p.reason}
            hint={p.reasonHint}
            className="max-w-none md:max-w-96"
            multiline
            maxLength={300}
            value={agreedReason}
            error={reasonError ? p.reasonError : undefined}
            onChange={(event) => onAgreedReason(event.target.value)}
          />
        </div>
      ) : null}
      {lines.map((line) => (
        <Problem key={line}>{line}</Problem>
      ))}
      <h3 id="nb-plan-label" className="m-0 font-display text-title font-normal text-teal">
        {p.plan}
      </h3>
      <div role="group" aria-labelledby="nb-plan-label" className="grid gap-3 md:grid-cols-2">
        <ToggleCard
          pressed={plan === "deposit" && !depositClosed}
          onPress={() => onPlan("deposit")}
          disabled={depositClosed}
          title={p.deposit}
          detail={
            depositClosed ? (
              depositWhy
            ) : breakdown?.deposit ? (
              <>
                {p.balanceBy} <bdi dir="ltr">{dayIn(breakdown.deposit.balanceDueDate)}</bdi>
              </>
            ) : undefined
          }
          amount={breakdown?.deposit ? <bdi dir="ltr">{formatAed(breakdown.deposit.dueNowFils)}</bdi> : undefined}
        />
        <ToggleCard
          pressed={plan === "full" || depositClosed}
          onPress={() => onPlan("full")}
          title={p.full}
          amount={breakdown ? <bdi dir="ltr">{formatAed(breakdown.full.dueNowFils)}</bdi> : undefined}
        />
      </div>
      <h3 className="m-0 font-display text-title font-normal text-teal">{p.holdTitle}</h3>
      <div className="flex flex-wrap items-start gap-4">
        <Field id="nb-hold-date" label={p.holdDate} className="w-48 max-w-full" type="date" dir="ltr" value={holdDate} onChange={(event) => onHoldDate(event.target.value)} />
        <Field id="nb-hold-time" label={p.holdTime} className="w-40 max-w-full" type="time" dir="ltr" value={holdTime} onChange={(event) => onHoldTime(event.target.value)} />
      </div>
      <p className="m-0 text-label text-muted">{p.holdHint}</p>
      {holdProblem ? <Problem>{holdProblem}</Problem> : null}
      <Nav copy={copy} onBack={onBack} onNext={onNext} />
    </section>
  );
}

// ------------------------------------------------------------------------------------------------------------
// 5. Review
// ------------------------------------------------------------------------------------------------------------

export type ReviewRow = { step: NewBookingStep; label: string; value: ReactNode };

export function ReviewStep({
  copy,
  rows,
  onEdit,
  isTest,
  onTest,
  gateLine,
  problem,
  lines,
  busy,
  canCreate,
  onBack,
  onCreate,
}: Common & {
  rows: ReviewRow[];
  onEdit: (step: NewBookingStep) => void;
  isTest: boolean;
  onTest: (next: boolean) => void;
  /** Why Create is off at the gate, or null. */
  gateLine: string | null;
  /** The sentence for the last refusal, or null. */
  problem: string | null;
  /** The quote's reasons that stop Create, said in words. */
  lines: string[];
  busy: boolean;
  canCreate: boolean;
  onBack: () => void;
  onCreate: () => void;
}) {
  const r = copy.review;
  return (
    <section className={SECTION} aria-labelledby="nb-step-heading">
      <StepHeading>{r.heading}</StepHeading>
      <dl className="m-0 grid gap-0">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-3">
            <dt className="w-32 shrink-0 text-label text-muted">{row.label}</dt>
            <dd className="m-0 min-w-0 flex-1 break-words text-body text-ink">{row.value}</dd>
            <button type="button" className={LINK_BUTTON} onClick={() => onEdit(row.step)}>
              {copy.edit}
            </button>
          </div>
        ))}
      </dl>
      <p className="m-0 text-label text-ink">{r.emailLine}</p>
      <div className="grid gap-1">
        <Checkbox label={r.test} checked={isTest} onChange={(event) => onTest(event.target.checked)} />
        <p className="m-0 text-label text-muted">{r.testHint}</p>
      </div>
      {gateLine ? <Problem>{gateLine}</Problem> : null}
      {lines.map((line) => (
        <Problem key={line}>{line}</Problem>
      ))}
      {problem ? <Problem>{problem}</Problem> : null}
      <Nav copy={copy} onBack={onBack} onNext={onCreate} nextLabel={r.create} busy={busy} disabled={!canCreate} />
    </section>
  );
}

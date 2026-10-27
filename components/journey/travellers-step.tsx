import type { ReactNode } from "react";
import type { TravellerInput } from "../../lib/booking/types";
import { fill } from "../../lib/journey-format";
import { AlertCircleIcon } from "../icons/icons";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";
import type { JourneyCopy } from "./types";

// Plan 04-03 (signed 2026-10-25), step 3: who is booking, one line per guest, the pickup address when home pickup is
// in the cart (one address, used for the return too: Q-04), then, under Q-01 = B, the payment, airport and terms
// choices (the `choices` slot) before "Continue to request". Props in, callbacks out: nothing is checked or sent
// here; the errors arrive keyed by the hold body's dotted paths (contact.name, travellers.2.age, pickupAddress).

export type TravellerErrorCode = "required" | "email" | "phone" | "tooLong" | "age";

export type TravellersContact = {
  name: string;
  email: string;
  phone: string;
  nationality: string;
  specialRequests: string;
  emergencyName: string;
  emergencyPhone: string;
};

export type TravellersLine = { kind: TravellerInput["kind"]; fullName: string; age: string };

export type TravellersStepProps = {
  contact: TravellersContact;
  onContact: (patch: Partial<TravellersContact>) => void;
  bookerStays: boolean;
  onBookerStays: (stays: boolean) => void;
  lines: TravellersLine[];
  onLine: (index: number, patch: { fullName?: string; age?: string }) => void;
  needsPickup: boolean;
  pickup: string;
  onPickup: (address: string) => void;
  errors: Record<string, TravellerErrorCode>;
  /** The role="alert" summary line: Continue found errors (here or in the choices). */
  showSummary?: boolean;
  onBack: () => void;
  onContinue: () => void;
  /** Q-01 = B: the Request choices, drawn after the pickup block and before the buttons. */
  choices?: ReactNode;
  /** Below md the cart dock's Continue replaces this one. */
  hideContinueOnPhone?: boolean;
  copy: JourneyCopy;
};

const H3 = "m-0 font-display text-title text-teal";

export function TravellersStep({
  contact,
  onContact,
  bookerStays,
  onBookerStays,
  lines,
  onLine,
  needsPickup,
  pickup,
  onPickup,
  errors,
  showSummary = false,
  onBack,
  onContinue,
  choices,
  hideContinueOnPhone = true,
  copy,
}: TravellersStepProps) {
  const t = copy.travellers;
  const err = (key: string) => {
    const code = errors[key];
    return code ? t.errors[code] : undefined;
  };
  const optional = (label: string) => `${label} (${t.optional})`;

  const counters = { adult: 0, child: 0, infant: 0 };
  const lineLabel = (kind: TravellersLine["kind"]) => {
    counters[kind] += 1;
    const template = kind === "adult" ? t.adultLine : kind === "child" ? t.childLine : t.infantLine;
    return fill(template, { n: counters[kind] });
  };

  return (
    <section className="@container flex flex-col gap-6" aria-labelledby="trip-step-travellers">
      <h2 id="trip-step-travellers" className="m-0 font-display text-title text-teal">
        {copy.trip.stepTitle.travellers}
      </h2>

      <div className="flex flex-col gap-4">
        <h3 className={H3}>{t.booker}</h3>
        <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
          <Field
            id="trip-contact-name"
            label={t.name}
            required
            autoComplete="name"
            value={contact.name}
            onChange={(e) => onContact({ name: e.target.value })}
            error={err("contact.name")}
            className="max-w-none"
          />
          <Field
            id="trip-contact-email"
            label={t.email}
            required
            type="email"
            autoComplete="email"
            dir="ltr"
            value={contact.email}
            onChange={(e) => onContact({ email: e.target.value })}
            error={err("contact.email")}
            className="max-w-none"
          />
          <Field
            id="trip-contact-phone"
            label={t.phone}
            required
            type="tel"
            autoComplete="tel"
            dir="ltr"
            value={contact.phone}
            onChange={(e) => onContact({ phone: e.target.value })}
            error={err("contact.phone")}
            className="max-w-none"
          />
          <Field
            id="trip-contact-nationality"
            label={optional(t.nationality)}
            autoComplete="country-name"
            value={contact.nationality}
            onChange={(e) => onContact({ nationality: e.target.value })}
            error={err("contact.nationality")}
            className="max-w-none"
          />
        </div>
        <Field
          id="trip-contact-special"
          multiline
          label={optional(t.specialRequests)}
          value={contact.specialRequests}
          onChange={(e) => onContact({ specialRequests: e.target.value })}
          error={err("contact.specialRequests")}
          className="max-w-none"
        />
        <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
          <Field
            id="trip-contact-emergency-name"
            label={optional(t.emergencyName)}
            value={contact.emergencyName}
            onChange={(e) => onContact({ emergencyName: e.target.value })}
            error={err("contact.emergencyName")}
            className="max-w-none"
          />
          <Field
            id="trip-contact-emergency-phone"
            label={optional(t.emergencyPhone)}
            type="tel"
            dir="ltr"
            value={contact.emergencyPhone}
            onChange={(e) => onContact({ emergencyPhone: e.target.value })}
            error={err("contact.emergencyPhone")}
            className="max-w-none"
          />
        </div>
      </div>

      <Checkbox label={t.notStaying} checked={!bookerStays} onChange={(e) => onBookerStays(!e.target.checked)} />

      <div className="flex flex-col gap-4">
        <h3 className={H3}>{t.guestsHeading}</h3>
        {lines.map((line, i) => {
          const label = lineLabel(line.kind);
          // While the booker stays, line 1 is their own: it shows the name typed above (the state copies it).
          const own = i === 0 && bookerStays && line.kind === "adult";
          return (
            <div key={i} className="flex flex-col gap-4 border border-line bg-surface p-4 @lg:flex-row @lg:items-start">
              <h4 className="m-0 shrink-0 text-label text-ink @lg:w-24 @lg:pt-3">{label}</h4>
              <Field
                id={`trip-traveller-${i}-name`}
                label={t.fullName}
                required
                readOnly={own}
                aria-readonly={own || undefined}
                value={line.fullName}
                onChange={(e) => onLine(i, { fullName: e.target.value })}
                error={own ? undefined : err(`travellers.${i}.fullName`)}
                className="max-w-none flex-1"
              />
              {line.kind === "adult" ? null : (
                <Field
                  id={`trip-traveller-${i}-age`}
                  label={t.age}
                  required
                  inputMode="numeric"
                  maxLength={2}
                  dir="ltr"
                  value={line.age}
                  onChange={(e) => onLine(i, { age: e.target.value })}
                  hint={line.kind === "child" ? t.childAgeHint : t.infantAgeHint}
                  error={err(`travellers.${i}.age`)}
                  className="max-w-none flex-1"
                />
              )}
            </div>
          );
        })}
      </div>

      {needsPickup ? (
        <div className="flex flex-col gap-2">
          <h3 className={H3}>{t.pickupHeading}</h3>
          <Field
            id="trip-pickup"
            label={t.pickupHeading}
            required
            autoComplete="street-address"
            value={pickup}
            onChange={(e) => onPickup(e.target.value)}
            hint={t.pickupHint}
            error={err("pickupAddress")}
            className="max-w-none"
          />
        </div>
      ) : null}

      {choices ? <div className="flex flex-col gap-6 border-t border-line pt-4">{choices}</div> : null}

      {showSummary ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-label text-error">
          <AlertCircleIcon size={20} className="shrink-0" />
          <span>{t.errors.summary}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="ghost" onClick={onBack}>
          {t.back}
        </Button>
        <Button onClick={onContinue} className={hideContinueOnPhone ? "hidden md:inline-flex" : undefined}>
          {t.continue}
        </Button>
      </div>
    </section>
  );
}

"use client";

import { useId, type ReactNode } from "react";
import { fill } from "../../lib/journey-format";
import { cn } from "../../lib/cn";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";
import type { JourneyCopy, Locale, TravellerErrors, TravellersValue } from "./types";

export type TravellersStepProps = {
  guests: { adults: number; children: number; infants: number };
  value: TravellersValue;
  onChange: (value: TravellersValue) => void;
  /** Field errors from the page's own validation (the server's rules, run on the client). */
  errors?: TravellerErrors;
  /** True when a home-pickup add-on is in the cart (B-11): the pickup address block shows. */
  needsPickup: boolean;
  onBack: () => void;
  onContinue: () => void;
  copy: JourneyCopy;
  locale: Locale;
  className?: string;
};

type Kind = "adult" | "child" | "infant";

/** The kind of guest line i: adults first, then children, then infants. */
function kindOf(i: number, g: TravellersStepProps["guests"]): { kind: Kind; n: number } {
  if (i < g.adults) return { kind: "adult", n: i + 1 };
  if (i < g.adults + g.children) return { kind: "child", n: i - g.adults + 1 };
  return { kind: "infant", n: i - g.adults - g.children + 1 };
}

/** Step 3: who is travelling. One block for the booker, one line per guest, one pickup address when it is needed. */
export function TravellersStep({
  guests,
  value,
  onChange,
  errors = {},
  needsPickup,
  onBack,
  onContinue,
  copy,
  locale,
  className,
}: TravellersStepProps) {
  const t = copy.trip.travellers;
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const total = guests.adults + guests.children + guests.infants;
  const set = <K extends keyof TravellersValue>(key: K, next: TravellersValue[K]) => onChange({ ...value, [key]: next });
  const setLine = (i: number, patch: Partial<TravellersValue["lines"][number]>) =>
    set(
      "lines",
      value.lines.map((line, at) => (at === i ? { ...line, ...patch } : line)),
    );
  const opt = (label: string) => fill(t.optionalLabel, { label });

  const message = (key: string, ageRange?: { min: number; max: number }): ReactNode => {
    const code = errors[key];
    if (!code) return undefined;
    if (code === "age" && ageRange) return fill(t.errors.age, ageRange);
    if (code === "email") return t.errors.email;
    if (code === "phone") return t.errors.phone;
    return t.errors.required;
  };

  return (
    <section aria-labelledby={id("title")} className={cn("flex flex-col gap-8", className)}>
      <div className="flex flex-col gap-2">
        <h2 id={id("title")} className="m-0">
          {t.title}
        </h2>
        <p className="m-0 text-body text-muted">{t.intro}</p>
        <p className="m-0 text-caption text-muted">{t.requiredNote}</p>
      </div>

      <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="mb-4 p-0 font-display text-title text-teal">{t.booker.title}</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id={id("name")}
            label={t.booker.name}
            required
            autoComplete="name"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            error={message("contact.name")}
            className="max-w-none"
          />
          <Field
            id={id("email")}
            label={t.booker.email}
            required
            type="email"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            value={value.email}
            onChange={(e) => set("email", e.target.value)}
            error={message("contact.email")}
            className="max-w-none"
          />
          <Field
            id={id("phone")}
            label={t.booker.phone}
            required
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            dir="ltr"
            value={value.phone}
            onChange={(e) => set("phone", e.target.value)}
            error={message("contact.phone")}
            className="max-w-none"
          />
          <Field
            id={id("nationality")}
            label={opt(t.booker.nationality)}
            autoComplete="country-name"
            value={value.nationality}
            onChange={(e) => set("nationality", e.target.value)}
            error={message("contact.nationality")}
            className="max-w-none"
          />
          <Field
            id={id("emergencyName")}
            label={opt(t.booker.emergencyName)}
            value={value.emergencyName}
            onChange={(e) => set("emergencyName", e.target.value)}
            error={message("contact.emergencyName")}
            className="max-w-none"
          />
          <Field
            id={id("emergencyPhone")}
            label={opt(t.booker.emergencyPhone)}
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={value.emergencyPhone}
            onChange={(e) => set("emergencyPhone", e.target.value)}
            error={message("contact.emergencyPhone")}
            className="max-w-none"
          />
        </div>
        <Field
          id={id("requests")}
          label={opt(t.booker.requests)}
          multiline
          value={value.specialRequests}
          onChange={(e) => set("specialRequests", e.target.value)}
          error={message("contact.specialRequests")}
          className="max-w-none"
        />
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="mb-4 p-0 font-display text-title text-teal">{t.guests.title}</legend>
        <Checkbox
          label={t.booker.notStaying}
          checked={value.notStaying}
          onChange={(e) => set("notStaying", e.target.checked)}
          className="self-start"
        />
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {Array.from({ length: total }, (_, i) => {
            const { kind, n } = kindOf(i, guests);
            const line = value.lines[i] ?? { name: "", age: "" };
            const isBookerLine = i === 0 && !value.notStaying;
            const range = kind === "child" ? { min: 3, max: 12 } : { min: 0, max: 2 };
            const title = fill(kind === "adult" ? t.guests.adult : kind === "child" ? t.guests.child : t.guests.infant, { n });
            return (
              <li key={i} className="flex flex-col gap-3 border-t border-line pt-4">
                <p className="m-0 text-label text-muted">
                  {title}
                  {isBookerLine ? ` · ${t.guests.you}` : ""}
                </p>
                <div className={cn("grid gap-4", kind === "adult" ? "" : "sm:grid-cols-[1fr_8rem]")}>
                  <Field
                    id={id(`line-${i}`)}
                    label={i === 0 && value.notStaying ? t.guests.stayingName : t.guests.name}
                    required
                    value={line.name}
                    onChange={(e) => setLine(i, { name: e.target.value })}
                    error={message(`travellers.${i}.fullName`)}
                    className="max-w-none"
                  />
                  {kind === "adult" ? null : (
                    <Field
                      id={id(`age-${i}`)}
                      label={t.guests.age}
                      required
                      inputMode="numeric"
                      hint={<bdi dir="ltr">{kind === "child" ? t.guests.childHint : t.guests.infantHint}</bdi>}
                      value={line.age}
                      onChange={(e) => setLine(i, { age: e.target.value })}
                      error={message(`travellers.${i}.age`, range)}
                      className="max-w-none"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </fieldset>

      {needsPickup ? (
        <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
          <Field
            id={id("pickup")}
            label={`${t.pickup.label} · ${t.pickup.hint}`}
            required
            multiline
            autoComplete="street-address"
            value={value.pickupAddress}
            onChange={(e) => set("pickupAddress", e.target.value)}
            error={message("pickupAddress")}
            className="max-w-none"
          />
        </fieldset>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="lg" onClick={onBack}>
          {t.back}
        </Button>
        <Button size="lg" onClick={onContinue}>
          {t.continue}
        </Button>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SiteRequestsCopy } from "../../../lib/copy/site-requests";
import { localeDir, type Locale } from "../../../lib/locale-path";
import { REQUEST_FIELD as F, UAE_AIRPORTS, validateSiteRequest, type RequestErrorCode, type RequestErrors } from "../../../lib/site-requests/validate";
import { Button } from "../../ui/button";
import { Field } from "../../ui/field";
import { Select } from "../../ui/select";
import { FORM_BOX, FailedLine, MESSAGE, RequestHoneypots, addHoneypots, postRequest, serverErrors, useMounted } from "../request-form-parts";

// The Plan with us form (plan 06-05, SITE-04, F-10; pictures/06-05 plan-*). The rules of components/pages/contact/inquiry-form.tsx:
// nothing in the served HTML, the 11 traps, idle / sending / sent / failed, the first bad field takes focus, the one validator
// before posting, the server's errors mapped back. No price and no pay control: the signed line says so. Dates are the two
// signed From and To fields; Destination and Arriving at are the kit Select with a sentinel for "Not sure yet" and "Not decided",
// which send nothing (memory "select empty value").

const NONE = "none";
const ORDER = ["destination", "from", "to", "guests", "budget", "airport", "notes", "name", "email", "phone"] as const;
type Key = (typeof ORDER)[number];
const id = (key: Key) => `plan-${key}`;
const CAPS: Partial<Record<Key, number>> = { destination: 120, budget: 120, notes: 2000, name: 120, email: 254 };
type Status = "idle" | "sending" | "sent" | "failed";

export type PlanFormProps = {
  locale: Locale;
  copy: SiteRequestsCopy;
  /** The published destinations of this language, from the build. */
  destinations: readonly string[];
  /** The contact form's signed line for a value over its cap: `{max}`. */
  tooLong: string;
  email: string;
  mailto: string;
  whatsappHref: string;
  newTabLabel: string;
};

export function PlanForm({ locale, copy, destinations, tooLong, email, mailto, whatsappHref, newTabLabel }: PlanFormProps) {
  const mounted = useMounted();
  const p = copy.plan;
  const [values, setValues] = useState({ destination: NONE, from: "", to: "", guests: "", budget: "", airport: NONE, notes: "", name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<RequestErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const sending = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const sentLine = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (status === "sent") sentLine.current?.focus();
  }, [status]);

  if (!mounted) return null;

  const set = (key: Key, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _gone, ...rest } = e;
      return rest;
    });
  };

  const showErrors = (found: RequestErrors) => {
    setErrors(found);
    const first = ORDER.find((key) => found[key]);
    if (first) document.getElementById(id(first))?.focus();
  };

  function message(key: Key): string | undefined {
    const code: RequestErrorCode | undefined = errors[key];
    if (!code) return undefined;
    const cap = CAPS[key];
    if (code === "tooLong" && cap) return tooLong.replace("{max}", String(cap));
    switch (key) {
      case "name":
        return p.err.name;
      case "email":
        return code === "required" ? p.err.email : p.err.emailBad;
      case "phone":
        return p.err.phone;
      case "guests":
        return p.err.guests;
      case "from":
      case "to":
        return p.err.dates;
      default:
        return undefined;
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current) return;
    setStatus((s) => (s === "failed" ? "idle" : s));

    const body = new URLSearchParams();
    body.set(F.kind, "plan");
    body.set(F.locale, locale);
    body.set(F.name, values.name);
    body.set(F.email, values.email);
    body.set(F.phone, values.phone);
    if (values.destination !== NONE) body.set(F.destination, values.destination);
    body.set(F.from, values.from);
    body.set(F.to, values.to);
    body.set(F.guests, values.guests);
    body.set(F.budget, values.budget);
    if (values.airport !== NONE) body.set(F.airport, values.airport);
    body.set(F.tripNotes, values.notes);

    const checked = validateSiteRequest("plan", body);
    if (!checked.ok) {
      showErrors(checked.errors);
      return;
    }
    setErrors({});
    addHoneypots(body, form);

    sending.current = true;
    setStatus("sending");
    const reply = await postRequest("/api/requests", body);
    sending.current = false;
    if (reply?.status === 200 && reply.body?.ok === true) {
      setStatus("sent");
      return;
    }
    const found = reply?.status === 400 ? serverErrors(reply.body) : null;
    if (found) {
      setStatus("idle");
      showErrors(found);
      return;
    }
    setStatus("failed");
  };

  if (status === "sent") {
    return (
      <div className="grid gap-4">
        <p ref={sentLine} role="status" tabIndex={-1} className={MESSAGE}>
          {p.sent}
        </p>
        <p className="m-0 max-w-md border-t border-gold pt-3 text-body text-muted">{p.noPay}</p>
      </div>
    );
  }

  const busy = status === "sending";
  const dir = localeDir(locale);
  const destinationOptions = [{ value: NONE, label: p.notSure }, ...destinations.map((name) => ({ value: name, label: name }))];
  const airportOptions = [...UAE_AIRPORTS.map((code, at) => ({ value: code, label: p.airports[at] ?? code })), { value: NONE, label: p.airports[3] ?? "" }];

  return (
    <div className="grid gap-4">
      {status === "failed" ? <FailedLine template={copy.failed} whatsappWord={copy.whatsappWord} email={email} mailto={mailto} whatsappHref={whatsappHref} newTabLabel={newTabLabel} /> : null}
      <form ref={form} method="post" action="/api/requests" noValidate aria-label={p.title} className={FORM_BOX} onSubmit={onSubmit}>
        <div className="grid gap-2">
          <label className="field-label text-label text-ink" htmlFor={id("destination")}>
            {p.destination}
          </label>
          <Select id={id("destination")} value={values.destination} options={destinationOptions} onChange={(next) => set("destination", next)} label={`${p.destination}: {name}`} dir={dir} className="w-full" />
        </div>
        <div role="group" aria-labelledby="plan-dates" className="grid gap-2">
          <p id="plan-dates" className="m-0 text-label text-ink">
            {p.dates}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id={id("from")} name={F.from} label={p.from} type="date" className="max-w-none" value={values.from} onChange={(e) => set("from", e.target.value)} error={message("from")} />
            <Field id={id("to")} name={F.to} label={p.to} type="date" className="max-w-none" value={values.to} onChange={(e) => set("to", e.target.value)} error={message("to")} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id={id("guests")} name={F.guests} label={p.guests} inputMode="numeric" autoComplete="off" maxLength={3} className="max-w-none" value={values.guests} onChange={(e) => set("guests", e.target.value)} error={message("guests")} />
          <Field id={id("budget")} name={F.budget} label={`${p.budget} (${p.budgetHint})`} autoComplete="off" maxLength={120} className="max-w-none" value={values.budget} onChange={(e) => set("budget", e.target.value)} error={message("budget")} />
        </div>
        <div className="grid gap-2">
          <label className="field-label text-label text-ink" htmlFor={id("airport")}>
            {p.airport}
          </label>
          <Select id={id("airport")} value={values.airport} options={airportOptions} onChange={(next) => set("airport", next)} label={`${p.airport}: {name}`} dir={dir} className="w-full" />
        </div>
        <Field id={id("notes")} name={F.tripNotes} label={p.notes} multiline maxLength={2000} className="max-w-none" value={values.notes} onChange={(e) => set("notes", e.target.value)} error={message("notes")} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field id={id("name")} name={F.name} label={p.name} required autoComplete="name" maxLength={120} className="max-w-none" value={values.name} onChange={(e) => set("name", e.target.value)} error={message("name")} />
          <Field id={id("email")} name={F.email} label={p.email} type="email" dir="ltr" required autoComplete="email" maxLength={254} className="max-w-none" value={values.email} onChange={(e) => set("email", e.target.value)} error={message("email")} />
        </div>
        <Field id={id("phone")} name={F.phone} label={p.phone} type="tel" dir="ltr" autoComplete="tel" maxLength={20} className="max-w-none" value={values.phone} onChange={(e) => set("phone", e.target.value)} error={message("phone")} />
        <RequestHoneypots />
        <p className="m-0 border-t border-gold pt-3 text-body text-muted">{p.noPay}</p>
        <div>
          <Button type="submit" busy={busy}>
            {busy ? p.sending : p.send}
          </Button>
        </div>
      </form>
    </div>
  );
}

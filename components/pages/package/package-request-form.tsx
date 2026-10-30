"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { cn } from "../../../lib/cn";
import type { PackagePageCopy } from "../../../lib/copy/package-page";
import type { Locale } from "../../../lib/locale-path";
import { PACKAGE_REQUEST_FIELD as F, parsePackageRequest } from "../../../lib/site-requests/package";
import type { RequestErrorCode, RequestErrors } from "../../../lib/site-requests/validate";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Field } from "../../ui/field";
import { FORM_BOX, MESSAGE, MESSAGE_BAD, RequestHoneypots, addHoneypots, postRequest, serverErrors, useMounted } from "../request-form-parts";

// Request this journey (plan 06-06, BOOK-05, F-01; pictures/06-06 request-*), on the rules of 06-05's forms: nothing in the served
// HTML, the 11 traps, one urlencoded POST to /api/requests, the one validator before posting, the server's errors mapped back,
// the first bad field takes focus. Idle, sending, sent (the line replaces the form and takes focus), field errors, limited (429),
// failed (anything else). A refusal never shows the received line; what the guest typed stays. No amount, card or pay word.
//
// Cities are square boxes from the package's own cities, all ticked at the start, and map to the `cities` payload key (signed
// decision 3); no legs, no field. The leave-before-arrive error sits under Arrive, as drawn.

/** The fields that show an error, in the drawn order. A server refusal on any other key (a city the page no longer has) is the failed line. */
const ORDER = ["from", "guests", "notes", "name", "email", "phone"] as const;
type Key = (typeof ORDER)[number];
type Status = "idle" | "sending" | "sent" | "limited" | "failed";

/** Leave before arrive comes back on `to`; the one date error is drawn on Arrive. */
function drawnErrors(found: RequestErrors): RequestErrors {
  const { to, ...rest } = found;
  return to && !rest.from ? { ...rest, from: to } : rest;
}

export function PackageRequestForm({ tierSlug, cities, copy, locale }: { tierSlug: string; cities: readonly string[]; copy: PackagePageCopy; locale: Locale }) {
  const mounted = useMounted();
  const uid = useId();
  const id = (key: string) => `${uid}-package-${key}`;
  const [values, setValues] = useState({ from: "", to: "", guests: "", notes: "", name: "", email: "", phone: "" });
  const [ticked, setTicked] = useState<readonly string[]>(cities);
  const [errors, setErrors] = useState<RequestErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const sending = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const sentLine = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (status === "sent") sentLine.current?.focus();
  }, [status]);

  if (!mounted) return null;

  const set = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    const name = key === "to" ? "from" : key;
    setErrors((e) => {
      if (!e[name]) return e;
      const { [name]: _gone, ...rest } = e;
      return rest;
    });
  };

  /** True when an error landed on a field of this form. */
  const showErrors = (found: RequestErrors): boolean => {
    const drawn = drawnErrors(found);
    const first = ORDER.find((key) => drawn[key]);
    if (!first) return false;
    setErrors(drawn);
    document.getElementById(id(first))?.focus();
    return true;
  };

  function message(key: Key): string | undefined {
    const code: RequestErrorCode | undefined = errors[key];
    if (!code) return undefined;
    switch (key) {
      case "from":
        return copy.err.dates;
      case "guests":
        return copy.err.guests;
      case "notes":
        return copy.err.long;
      case "email":
        return code === "required" ? copy.err.required : copy.err.email;
      case "phone":
        return copy.err.phone;
      default:
        return copy.err.required;
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current) return;
    setStatus("idle");

    const body = new URLSearchParams();
    body.set(F.kind, "package");
    body.set(F.locale, locale);
    body.set(F.tier, tierSlug);
    body.set(F.from, values.from);
    body.set(F.to, values.to);
    body.set(F.guests, values.guests);
    for (const city of ticked) body.append(F.cities, city);
    body.set(F.notes, values.notes);
    body.set(F.name, values.name);
    body.set(F.email, values.email);
    body.set(F.phone, values.phone);

    const checked = parsePackageRequest(body, { allowedCities: cities });
    if (!checked.ok) {
      if (!showErrors(checked.errors)) setStatus("failed");
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
    if (reply?.status === 429) {
      setStatus("limited");
      return;
    }
    const found = reply?.status === 400 ? serverErrors(reply.body) : null;
    if (found && showErrors(found)) {
      setStatus("idle");
      return;
    }
    setStatus("failed");
  };

  if (status === "sent") {
    return (
      <p ref={sentLine} role="status" tabIndex={-1} className={MESSAGE}>
        {copy.sent}
      </p>
    );
  }

  const busy = status === "sending";
  const refused = status === "failed" ? copy.failed : status === "limited" ? copy.limited : null;

  return (
    <>
      {refused ? (
        <p role="alert" className={MESSAGE_BAD}>
          {refused}
        </p>
      ) : null}
      <form ref={form} method="post" action="/api/requests" noValidate aria-label={copy.reqHeading} className={cn(FORM_BOX, "max-w-220")} onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id={id("from")} name={F.from} label={copy.arrive} type="date" className="max-w-none" value={values.from} onChange={(e) => set("from", e.target.value)} error={message("from")} />
          <Field id={id("to")} name={F.to} label={copy.leave} type="date" className="max-w-none" value={values.to} onChange={(e) => set("to", e.target.value)} />
        </div>
        <Field id={id("guests")} name={F.guests} label={copy.guests} inputMode="numeric" autoComplete="off" maxLength={3} className="max-w-none" value={values.guests} onChange={(e) => set("guests", e.target.value)} error={message("guests")} />
        {cities.length > 0 ? (
          <div role="group" aria-labelledby={id("cities")} className="grid gap-2">
            <p id={id("cities")} className="m-0 text-label text-ink">
              {copy.cities}
            </p>
            {/* A long route takes columns on a wide screen rather than a very long form. */}
            <div className={cities.length > 6 ? "grid gap-1 md:grid-cols-2 lg:grid-cols-3" : "grid gap-1"}>
              {cities.map((city) => (
                <Checkbox
                  key={city}
                  name={F.cities}
                  value={city}
                  className="w-full gap-3"
                  label={city}
                  checked={ticked.includes(city)}
                  onChange={(event) => setTicked((was) => (event.target.checked ? cities.filter((one) => was.includes(one) || one === city) : was.filter((one) => one !== city)))}
                />
              ))}
            </div>
          </div>
        ) : null}
        <Field id={id("notes")} name={F.notes} label={copy.notes} multiline maxLength={2000} className="max-w-none" value={values.notes} onChange={(e) => set("notes", e.target.value)} error={message("notes")} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field id={id("name")} name={F.name} label={copy.name} required autoComplete="name" maxLength={120} className="max-w-none" value={values.name} onChange={(e) => set("name", e.target.value)} error={message("name")} />
          <Field id={id("email")} name={F.email} label={copy.email} type="email" dir="ltr" required autoComplete="email" maxLength={254} className="max-w-none" value={values.email} onChange={(e) => set("email", e.target.value)} error={message("email")} />
        </div>
        <Field id={id("phone")} name={F.phone} label={copy.phone} type="tel" dir="ltr" autoComplete="tel" maxLength={20} className="max-w-none" value={values.phone} onChange={(e) => set("phone", e.target.value)} error={message("phone")} />
        <RequestHoneypots />
        <div>
          <Button type="submit" busy={busy}>
            {busy ? copy.sending : copy.send}
          </Button>
        </div>
      </form>
    </>
  );
}

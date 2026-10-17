"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  HONEYPOT_FIELDS,
  INQUIRY_FIELD,
  INQUIRY_LIMITS,
  JOURNEY_TYPES,
  validateInquiry,
  type InquiryErrorCode,
  type InquiryErrors,
} from "../../../lib/contact-inquiry";
import { cn } from "../../../lib/cn";
import type { InquiryFormCopy } from "../../../lib/copy/contact-page";
import { localeDir, type Locale } from "../../../lib/locale-path";
import { Button, LinkButton } from "../../ui/button";
import { Field } from "../../ui/field";
import { Link } from "../../ui/link";
import { Reveal, revealProps } from "../../ui/reveal";
import { Select } from "../../ui/select";

// The Contact page's inquiry form (phase 3.3 plan 26; the signed part B pictures, s3-pictures/partb-states.*): the
// framed box in the end column of [data-contact-columns], posting to POST /api/contact. Both exports render nothing on
// the server and on the first client render (a mounted flag set in an effect), so the served HTML holds no form and a
// visitor without JavaScript never meets a control that cannot work; the details' own links stay for them.
//
// States: idle, sending (the submit button busy, its label `sending`), sent (one status line replaces the whole box,
// `Message on WhatsApp` included), failed (one alert line above the buttons, every value kept). The rules are
// lib/contact-inquiry.ts's, the same the route runs. Motion is job 11's Reveal: the box is a row (A7), each button a
// button (A6); the engine picks up elements added after load.

const BOX = "border border-teal p-6 md:p-12";
/** Job 11's A7 on the box (a div, not <Reveal>, because the box needs a ref). */
const ROW = revealProps("row");
const ERROR = "m-0 text-label field-error text-error";
const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;
const TIMEOUT_MS = 20_000;

type FieldKey = Exclude<keyof typeof INQUIRY_FIELD, "locale">;
type Values = { name: string; phone: string; email: string; journeyType: string | null; details: string };
type Status = "idle" | "sending" | "sent" | "failed";

/** Field order on screen: the first bad one takes focus. */
const ORDER: readonly FieldKey[] = ["name", "phone", "email", "journeyType", "details"];
const ID: Record<FieldKey, string> = {
  name: "inquiry-name",
  phone: "inquiry-phone",
  email: "inquiry-email",
  journeyType: "inquiry-type",
  details: "inquiry-details",
};
const CODES: readonly InquiryErrorCode[] = ["required", "invalid", "tooLong"];

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function NewTab({ label }: { label: string }) {
  return <span className="sr-only"> {label}</span>;
}

/** The message under a bad field, from the signed copy. */
function errorText(field: FieldKey, code: InquiryErrorCode, copy: InquiryFormCopy): string {
  const e = copy.errors;
  if (code === "tooLong" && field !== "journeyType") return e.tooLong.replace("{max}", String(INQUIRY_LIMITS[field]));
  switch (field) {
    case "name":
      return e.nameRequired;
    case "phone":
      return e.phoneInvalid;
    case "email":
      return code === "required" ? e.emailRequired : e.emailInvalid;
    case "journeyType":
      return e.journeyTypeRequired;
    case "details":
      return e.detailsRequired;
  }
}

/** The server's `errors` map, keeping only known fields and codes. */
function serverErrors(body: unknown): InquiryErrors | null {
  if (!body || typeof body !== "object" || !("errors" in body)) return null;
  const raw = (body as { errors: unknown }).errors;
  if (!raw || typeof raw !== "object") return null;
  const out: InquiryErrors = {};
  for (const field of ORDER) {
    const code = (raw as Record<string, unknown>)[field];
    if (typeof code === "string" && (CODES as readonly string[]).includes(code)) out[field] = code as InquiryErrorCode;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** `template` with `{email}` and `{whatsapp}` replaced by the given nodes. */
function fill(template: string, slots: Record<"email" | "whatsapp", ReactNode>): ReactNode[] {
  return template.split(/\{(email|whatsapp)\}/).map((part, i) => (i % 2 === 1 ? <span key={i}>{slots[part as "email" | "whatsapp"]}</span> : part));
}

export type InquiryFormProps = {
  locale: Locale;
  copy: InquiryFormCopy;
  /** `Message on WhatsApp` (the page's whatsappCta). */
  whatsappCta: string;
  /** The screen-reader suffix of a link that opens a new tab. */
  newTabLabel: string;
  /** contactLinks().whatsappMessage: wa.me with the page language's sentence. */
  whatsappHref: string;
  /** contactLinks().mailto. */
  mailto: string;
  /** The address the failed line shows. */
  email: string;
};

export function InquiryForm({ locale, copy, whatsappCta, newTabLabel, whatsappHref, mailto, email }: InquiryFormProps) {
  const mounted = useMounted();
  const [values, setValues] = useState<Values>({ name: "", phone: "", email: "", journeyType: null, details: "" });
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const sending = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const sentLine = useRef<HTMLParagraphElement>(null);

  // `Start Your Inquiry` on another page load (or a shared link) arrives with #inquiry before the box exists.
  useEffect(() => {
    if (mounted && window.location.hash === "#inquiry") box.current?.scrollIntoView({ block: "start" });
  }, [mounted]);

  useEffect(() => {
    if (status === "sent") sentLine.current?.focus();
  }, [status]);

  if (!mounted) return null;

  const set = (field: FieldKey, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const showErrors = (found: InquiryErrors) => {
    setErrors(found);
    const first = ORDER.find((f) => found[f]);
    if (first) document.getElementById(ID[first])?.focus();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current) return;
    setStatus((s) => (s === "failed" ? "idle" : s));

    const checked = validateInquiry({ ...values, locale });
    if (!checked.ok) {
      showErrors(checked.errors);
      return;
    }
    setErrors({});

    const body = new URLSearchParams();
    body.set(INQUIRY_FIELD.name, values.name);
    body.set(INQUIRY_FIELD.phone, values.phone);
    body.set(INQUIRY_FIELD.email, values.email);
    body.set(INQUIRY_FIELD.journeyType, values.journeyType ?? "");
    body.set(INQUIRY_FIELD.details, values.details);
    body.set(INQUIRY_FIELD.locale, locale);
    for (const trap of HONEYPOT_FIELDS) {
      const input = form.current?.elements.namedItem(trap);
      body.set(trap, input instanceof HTMLInputElement ? input.value : "");
    }

    sending.current = true;
    setStatus("sending");
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
    let next: Status = "failed";
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
        signal: abort.signal,
      });
      const json: unknown = await res.json().catch(() => null);
      if (res.status === 200 && json && typeof json === "object" && (json as { ok?: unknown }).ok === true) {
        next = "sent";
      } else if (res.status === 400) {
        const found = serverErrors(json);
        if (found) {
          next = "idle";
          showErrors(found);
        }
      }
    } catch {
      next = "failed";
    } finally {
      window.clearTimeout(timer);
      sending.current = false;
    }
    setStatus(next);
  };

  if (status === "sent") {
    return (
      <div id="inquiry" ref={box} {...ROW} className={cn(ROW.className, BOX, "grid min-h-80 content-center")}>
        <h2 id="inquiry-heading" className="sr-only">
          {copy.heading}
        </h2>
        <p ref={sentLine} role="status" tabIndex={-1} className="m-0 font-display text-title text-teal">
          {copy.sent}
        </p>
      </div>
    );
  }

  const busy = status === "sending";
  const message = (field: FieldKey) => {
    const code = errors[field];
    return code ? errorText(field, code, copy) : undefined;
  };
  const typeError = message("journeyType");
  const options = JOURNEY_TYPES.map((value) => ({ value, label: copy.journeyTypes[value] }));

  return (
    <div id="inquiry" ref={box} {...ROW} className={cn(ROW.className, BOX)}>
      <h2 id="inquiry-heading" className="sr-only">
        {copy.heading}
      </h2>
      <form
        ref={form}
        method="post"
        action="/api/contact"
        noValidate
        aria-labelledby="inquiry-heading"
        className="grid content-start gap-6"
        onSubmit={onSubmit}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Field
            id={ID.name}
            name={INQUIRY_FIELD.name}
            label={copy.name}
            required
            autoComplete="name"
            maxLength={INQUIRY_LIMITS.name}
            className="max-w-none"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            error={message("name")}
          />
          <Field
            id={ID.phone}
            name={INQUIRY_FIELD.phone}
            label={copy.phone}
            type="tel"
            dir="ltr"
            autoComplete="tel"
            maxLength={INQUIRY_LIMITS.phone}
            className="max-w-none"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            error={message("phone")}
          />
        </div>
        <Field
          id={ID.email}
          name={INQUIRY_FIELD.email}
          label={copy.email}
          type="email"
          dir="ltr"
          required
          autoComplete="email"
          maxLength={INQUIRY_LIMITS.email}
          className="max-w-none"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          error={message("email")}
        />
        <div className="grid gap-2">
          <label className="field-label text-label text-ink" htmlFor={ID.journeyType}>
            {copy.journeyType}
            <span className="text-ink" aria-hidden="true">
              {" "}
              *
            </span>
          </label>
          <Select
            id={ID.journeyType}
            value={values.journeyType}
            options={options}
            onChange={(next) => set("journeyType", next)}
            label={`${copy.journeyType}: {name}`}
            placeholder={copy.journeyTypePlaceholder}
            dir={localeDir(locale)}
            className="w-full"
            required
            invalid={Boolean(typeError)}
            describedBy={typeError ? `${ID.journeyType}-message` : undefined}
          />
          {typeError ? (
            <p id={`${ID.journeyType}-message`} className={ERROR}>
              {typeError}
            </p>
          ) : null}
        </div>
        <Field
          id={ID.details}
          name={INQUIRY_FIELD.details}
          label={copy.details}
          multiline
          required
          maxLength={INQUIRY_LIMITS.details}
          className="max-w-none"
          value={values.details}
          onChange={(e) => set("details", e.target.value)}
          error={message("details")}
        />
        {/* The live form's 11 spam traps: out of sight, out of the tab order and the accessibility tree. */}
        <div aria-hidden="true" className="sr-only">
          {HONEYPOT_FIELDS.map((trap) => (
            <input
              key={trap}
              type="text"
              name={trap}
              tabIndex={-1}
              autoComplete="one-time-code"
              defaultValue=""
              data-1p-ignore=""
              data-lpignore="true"
              data-bwignore="true"
              data-form-type="other"
            />
          ))}
        </div>
        {status === "failed" ? (
          <p role="alert" className="m-0 border-s-2 border-error ps-3 text-label text-error">
            {fill(copy.failed, {
              email: (
                <Link inline href={mailto}>
                  <bdi>{email}</bdi>
                </Link>
              ),
              whatsapp: (
                <Link inline href={whatsappHref} {...NEW_TAB}>
                  {copy.whatsappWord}
                  <NewTab label={newTabLabel} />
                </Link>
              ),
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Reveal kind="button">
            <Button type="submit" busy={busy}>
              {busy ? copy.sending : copy.submit}
            </Button>
          </Reveal>
          <Reveal kind="button">
            <LinkButton variant="outline" href={whatsappHref} {...NEW_TAB}>
              {whatsappCta}
              <NewTab label={newTabLabel} />
            </LinkButton>
          </Reveal>
        </div>
      </form>
    </div>
  );
}

/** `Start Your Inquiry`: job 11's outlined button as a link to the form box. Rendered only after hydration, as the box. */
export function InquiryStart({ label }: { label: string }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return (
    <Reveal kind="button">
      <LinkButton variant="outline" href="#inquiry">
        {label}
      </LinkButton>
    </Reveal>
  );
}

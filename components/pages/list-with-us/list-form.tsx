"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SiteRequestsCopy } from "../../../lib/copy/site-requests";
import type { Locale } from "../../../lib/locale-path";
import { REQUEST_FIELD as F, validateSiteRequest, type RequestErrorCode, type RequestErrors } from "../../../lib/site-requests/validate";
import { Button } from "../../ui/button";
import { Field } from "../../ui/field";
import { FORM_BOX, FailedLine, MESSAGE, RequestHoneypots, addHoneypots, postRequest, serverErrors, useMounted } from "../request-form-parts";

// The List with us form (plan 06-05, SITE-05; pictures/06-05 list-*): reached from the footer only, no partner login. The rules
// of components/pages/contact/inquiry-form.tsx. Property type is free text (signed 2026-10-30).

const ORDER = ["name", "email", "phone", "property_type", "city", "message"] as const;
type Key = (typeof ORDER)[number];
const id = (key: Key) => `list-${key}`;
const CAPS: Partial<Record<Key, number>> = { name: 120, email: 254, property_type: 80, city: 120, message: 2000 };
type Status = "idle" | "sending" | "sent" | "failed";

export type ListFormProps = {
  locale: Locale;
  copy: SiteRequestsCopy;
  /** The contact form's signed line for a value over its cap: `{max}`. */
  tooLong: string;
  email: string;
  mailto: string;
  whatsappHref: string;
  newTabLabel: string;
};

export function ListForm({ locale, copy, tooLong, email, mailto, whatsappHref, newTabLabel }: ListFormProps) {
  const mounted = useMounted();
  const p = copy.list;
  const [values, setValues] = useState({ name: "", email: "", phone: "", property_type: "", city: "", message: "" });
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
      case "property_type":
        return p.err.propType;
      case "city":
        return p.err.city;
      case "message":
        return p.err.message;
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current) return;
    setStatus((s) => (s === "failed" ? "idle" : s));

    const body = new URLSearchParams();
    body.set(F.kind, "list");
    body.set(F.locale, locale);
    body.set(F.name, values.name);
    body.set(F.email, values.email);
    body.set(F.phone, values.phone);
    body.set(F.propertyType, values.property_type);
    body.set(F.city, values.city);
    body.set(F.propertyDetails, values.message);

    const checked = validateSiteRequest("list", body);
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
      <p ref={sentLine} role="status" tabIndex={-1} className={MESSAGE}>
        {p.sent}
      </p>
    );
  }

  const busy = status === "sending";

  return (
    <div className="grid gap-4">
      {status === "failed" ? <FailedLine template={copy.failed} whatsappWord={copy.whatsappWord} email={email} mailto={mailto} whatsappHref={whatsappHref} newTabLabel={newTabLabel} /> : null}
      <form ref={form} method="post" action="/api/requests" noValidate aria-label={p.title} className={FORM_BOX} onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id={id("name")} name={F.name} label={p.name} required autoComplete="name" maxLength={120} className="max-w-none" value={values.name} onChange={(e) => set("name", e.target.value)} error={message("name")} />
          <Field id={id("email")} name={F.email} label={p.email} type="email" dir="ltr" required autoComplete="email" maxLength={254} className="max-w-none" value={values.email} onChange={(e) => set("email", e.target.value)} error={message("email")} />
        </div>
        <Field id={id("phone")} name={F.phone} label={p.phone} type="tel" dir="ltr" autoComplete="tel" maxLength={20} className="max-w-none" value={values.phone} onChange={(e) => set("phone", e.target.value)} error={message("phone")} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field id={id("property_type")} name={F.propertyType} label={p.propType} required autoComplete="off" maxLength={80} className="max-w-none" value={values.property_type} onChange={(e) => set("property_type", e.target.value)} error={message("property_type")} />
          <Field id={id("city")} name={F.city} label={p.city} required autoComplete="off" maxLength={120} className="max-w-none" value={values.city} onChange={(e) => set("city", e.target.value)} error={message("city")} />
        </div>
        <Field id={id("message")} name={F.propertyDetails} label={p.message} multiline required maxLength={2000} className="max-w-none" value={values.message} onChange={(e) => set("message", e.target.value)} error={message("message")} />
        <RequestHoneypots />
        <div>
          <Button type="submit" busy={busy}>
            {busy ? p.sending : p.send}
          </Button>
        </div>
      </form>
    </div>
  );
}

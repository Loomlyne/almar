"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronIcon } from "../../icons/icons";
import { cn } from "../../../lib/cn";
import type { SiteRequestsCopy } from "../../../lib/copy/site-requests";
import type { Locale } from "../../../lib/locale-path";
import { SLOT_TAGS, dateLabel, groupSlots, isTimeZone, localDay, timeLabel, type GroupedSlot } from "../../../lib/site-requests/slots";
import { REQUEST_FIELD as F, validateSiteRequest, type RequestErrorCode, type RequestErrors } from "../../../lib/site-requests/validate";
import { Button, LinkButton } from "../../ui/button";
import { Field } from "../../ui/field";
import { PageShell } from "../../ui/page-shell";
import { FORM_BOX, FailedLine, MESSAGE, MESSAGE_BAD, RequestHoneypots, addHoneypots, postRequest, serverErrors, useMounted } from "../request-form-parts";

// The 30-minute consultation on Contact (plan 06-05, SITE-06, SITE-03, F-04; pictures/06-05 consult-*). Nothing in the served
// HTML. After mount it reads the guest's zone and asks GET /api/consult/slots for the shown month: times in her zone with Dubai
// beside each. While the owner has not filled notice and horizon the answer is `open: false`: the closed line and WhatsApp, no
// calendar and no number. A slots call that fails shows the same (the WhatsApp link works and nothing is invented). Days and
// slots are toggle buttons (aria-pressed), never radios. Two guests on one slot: POST /api/consult/book answers 409 and the other
// is told the time was just taken and sees fresh slots; too soon, too far and outside hours say the same line, as signed.

const DAY_MS = 86400000;
const MAX_WINDOW_DAYS = 31;
const ORDER = ["name", "email", "phone", "notes"] as const;
type Key = (typeof ORDER)[number];
const id = (key: Key) => `consult-${key}`;
const CAPS: Partial<Record<Key, number>> = { name: 120, email: 254, notes: 2000 };
/** How far ahead the month arrows go: the horizon's own upper bound (365 days) never leaves the server, this is only a stop. */
const MAX_MONTHS_AHEAD = 13;

type Month = { year: number; month: number };
type Status = "loading" | "closed" | "open";
type Booked = { start: string; phone: string; emailed: boolean };

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const monthKey = ({ year, month }: Month) => `${year}-${String(month + 1).padStart(2, "0")}`;
const addMonths = ({ year, month }: Month, by: number): Month => {
  const at = new Date(Date.UTC(year, month + by, 1));
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() };
};

/**
 * The month's slots. A slot's Dubai date can be the day before or after the guest's, so one day is read on each side; a route
 * call covers at most 31 days, so a long month takes two calls. Null when a call failed.
 */
async function readMonth({ year, month }: Month): Promise<{ open: boolean; slots: string[] } | null> {
  const from = Date.UTC(year, month, 1) - DAY_MS;
  const to = Date.UTC(year, month + 1, 0) + DAY_MS;
  const slots: string[] = [];
  let open = false;
  try {
    for (let start = from; start <= to; start += (MAX_WINDOW_DAYS + 1) * DAY_MS) {
      const end = Math.min(start + MAX_WINDOW_DAYS * DAY_MS, to);
      const res = await fetch(`/api/consult/slots?from=${iso(start)}&to=${iso(end)}`, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const json = (await res.json()) as { open?: unknown; slots?: unknown };
      if (json.open !== true) return { open: false, slots: [] };
      open = true;
      if (Array.isArray(json.slots)) slots.push(...json.slots.filter((slot): slot is string => typeof slot === "string"));
    }
  } catch {
    return null;
  }
  return { open, slots };
}

function fillNodes(template: string, slots: Record<string, ReactNode>): ReactNode[] {
  return template.split(/\{(\w+)\}/).map((part, i) => (i % 2 === 1 ? <span key={i}>{slots[part] ?? part}</span> : part));
}

export type ConsultationBookingProps = {
  locale: Locale;
  copy: SiteRequestsCopy;
  /** `Message on WhatsApp` (the Contact page's whatsappCta). */
  whatsappCta: string;
  tooLong: string;
  email: string;
  mailto: string;
  whatsappHref: string;
  newTabLabel: string;
};

export function ConsultationBooking({ locale, copy, whatsappCta, tooLong, email, mailto, whatsappHref, newTabLabel }: ConsultationBookingProps) {
  const mounted = useMounted();
  const c = copy.c;
  const err = copy.plan.err;
  const [zone, setZone] = useState("Asia/Dubai");
  const [first, setFirst] = useState<Month | null>(null);
  const [shown, setShown] = useState<Month | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [slots, setSlots] = useState<string[]>([]);
  // The month `slots` belong to: while another one is read, its times are not judged from the last month's.
  const [slotsFor, setSlotsFor] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const [values, setValues] = useState({ name: "", email: "", phone: "", notes: "" });
  const [errors, setErrors] = useState<RequestErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const sending = useRef(false);
  const reading = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  const line = useRef<HTMLParagraphElement>(null);

  // The guest's zone and this month, once in the browser.
  useEffect(() => {
    if (!mounted) return;
    const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const next = guess && isTimeZone(guess) ? guess : "Asia/Dubai";
    setZone(next);
    const [year, month] = localDay(new Date().toISOString(), next).split("-").map(Number);
    const here = { year: year ?? 2026, month: (month ?? 1) - 1 };
    setFirst(here);
    setShown(here);
    if (window.location.hash === "#consultation") document.getElementById("consultation")?.scrollIntoView({ block: "start" });
  }, [mounted]);

  async function load(month: Month): Promise<void> {
    const mine = ++reading.current;
    // One quiet second try: a blip must not read as "not open yet".
    const answer = (await readMonth(month)) ?? (await readMonth(month));
    if (mine !== reading.current) return;
    if (!answer || !answer.open) {
      setStatus("closed");
      setSlots([]);
      return;
    }
    setStatus("open");
    setSlots(answer.slots);
    setSlotsFor(monthKey(month));
  }

  useEffect(() => {
    if (shown) void load(shown);
  }, [shown]);

  useEffect(() => {
    if (booked || notice) line.current?.focus();
  }, [booked, notice]);

  if (!mounted) return null;

  const days = shown ? groupSlots(slots, zone, locale).filter((group) => group.day.startsWith(`${monthKey(shown)}-`)) : [];
  const chosenDay = days.find((group) => group.day === day) ?? null;
  const chosenSlot: GroupedSlot | null = chosenDay?.slots.find((one) => one.start === slot) ?? null;

  const set = (key: Key, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _gone, ...rest } = e;
      return rest;
    });
  };

  function move(by: number) {
    if (!shown) return;
    setShown(addMonths(shown, by));
    setDay(null);
    setSlot(null);
    setNotice(false);
  }

  function message(key: Key): string | undefined {
    const code: RequestErrorCode | undefined = errors[key];
    if (!code) return undefined;
    const cap = CAPS[key];
    if (code === "tooLong" && cap) return tooLong.replace("{max}", String(cap));
    if (key === "name") return err.name;
    if (key === "email") return code === "required" ? err.email : err.emailBad;
    if (key === "phone") return err.phone;
    return undefined;
  }

  const showErrors = (found: RequestErrors) => {
    setErrors(found);
    const bad = ORDER.find((key) => found[key]);
    if (bad) document.getElementById(id(bad))?.focus();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current || !slot) return;
    setFailed(false);

    const body = new URLSearchParams();
    body.set(F.locale, locale);
    body.set(F.name, values.name);
    body.set(F.email, values.email);
    body.set(F.phone, values.phone);
    body.set(F.callNotes, values.notes);
    body.set(F.slot, slot);
    body.set(F.timeZone, zone);

    const checked = validateSiteRequest("consultation", body);
    if (!checked.ok) {
      showErrors(checked.errors);
      return;
    }
    setErrors({});
    addHoneypots(body, form);

    sending.current = true;
    setBusy(true);
    const reply = await postRequest("/api/consult/book", body);
    sending.current = false;
    setBusy(false);

    if (reply?.status === 200 && reply.body?.ok === true) {
      setBooked({ start: slot, phone: String(checked.payload.phone ?? ""), emailed: reply.body.emailed === true });
      return;
    }
    if (reply?.status === 409) {
      const reason = reply.body?.reason;
      setSlot(null);
      if (reason === "closed") setStatus("closed");
      else setNotice(true);
      if (shown) void load(shown);
      return;
    }
    const found = reply?.status === 400 ? serverErrors(reply.body) : null;
    if (found) {
      showErrors(found);
      return;
    }
    setFailed(true);
  };

  let inner: ReactNode = null;
  if (booked) {
    const local = timeLabel(booked.start, zone, locale);
    inner = (
      <>
        <p ref={line} role="status" tabIndex={-1} className={MESSAGE}>
          {fillNodes(c.booked, {
            date: dateLabel(booked.start, zone, locale),
            local,
            dubai: timeLabel(booked.start, "Asia/Dubai", locale),
            phone: <bdi dir="ltr">{booked.phone}</bdi>,
          })}
        </p>
        {booked.emailed ? null : (
          <p role="alert" className={MESSAGE_BAD}>
            {c.emailFailed}
          </p>
        )}
      </>
    );
  } else if (status === "closed") {
    inner = (
      <>
        <p role="status" className={MESSAGE}>
          {c.closed}
        </p>
        <div>
          <LinkButton variant="outline" href={whatsappHref} target="_blank" rel="noopener noreferrer">
            {whatsappCta}
            <span className="sr-only"> {newTabLabel}</span>
          </LinkButton>
        </div>
      </>
    );
  } else if (status === "open" && shown) {
    const tag = SLOT_TAGS[locale];
    const monday = Date.UTC(2026, 10, 2);
    const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" }).format(monday + i * DAY_MS));
    const lead = (new Date(Date.UTC(shown.year, shown.month, 1)).getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(shown.year, shown.month + 1, 0)).getUTCDate();
    const atFirst = first !== null && monthKey(shown) <= monthKey(first);
    const atLast = first !== null && monthKey(shown) >= monthKey(addMonths(first, MAX_MONTHS_AHEAD));
    const free = new Set(days.map((group) => group.day));
    const arrow = "inline-flex size-control shrink-0 cursor-pointer items-center justify-center rounded-none border border-teal bg-surface p-0 text-teal disabled:cursor-default disabled:border-line disabled:text-muted";

    const calendar = (
      <div className="grid gap-3">
        <div className="flex max-w-105 items-center justify-between gap-2">
          <button type="button" className={arrow} aria-label={c.prev} disabled={atFirst} onClick={() => move(-1)}>
            <ChevronIcon size={16} className="-scale-x-100 rtl:scale-x-100" />
          </button>
          <p className="m-0 font-display text-title text-teal">{new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(shown.year, shown.month, 1))}</p>
          <button type="button" className={arrow} aria-label={c.next} disabled={atLast} onClick={() => move(1)}>
            <ChevronIcon size={16} className="rtl:-scale-x-100" />
          </button>
        </div>
        <div role="group" aria-label={c.chooseDay} className="grid max-w-105 grid-cols-7 gap-1">
          {weekdays.map((name) => (
            <span key={name} aria-hidden="true" className="py-1 text-center text-caption text-muted">
              {name}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`lead-${i}`} aria-hidden="true" />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const date = `${monthKey(shown)}-${String(i + 1).padStart(2, "0")}`;
            const on = date === day;
            const open = free.has(date);
            return (
              <button
                key={date}
                type="button"
                aria-pressed={on}
                disabled={!open}
                onClick={() => {
                  setDay(date);
                  setSlot(null);
                  setNotice(false);
                }}
                className={cn(
                  "min-h-control rounded-none border p-0 text-center font-body text-label tabular-nums",
                  open ? "cursor-pointer border-line border-b-3 border-b-teal bg-surface text-ink" : "cursor-default border-transparent bg-transparent text-muted",
                  on && "border-teal bg-teal-tint font-bold shadow-selected",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    );

    const zoneLine = c.zone.replace("{zone}", zone);
    const times = slotsFor !== monthKey(shown) ? null : chosenDay ? (
      <div className="grid gap-3">
        <p className="m-0 text-label text-muted">
          {dateLabel(chosenDay.slots[0]!.start, zone, locale, false)} · {zoneLine}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {chosenDay.slots.map((one) => {
            const on = one.start === slot;
            return (
              <button
                key={one.start}
                type="button"
                aria-pressed={on}
                aria-label={one.dubai ? c.slotName.replace("{local}", one.local).replace("{dubai}", one.dubai) : `${one.local} ${c.yourTime}`}
                onClick={() => {
                  setSlot(one.start);
                  setNotice(false);
                }}
                className={cn(
                  "flex min-h-14 cursor-pointer flex-col justify-center rounded-none border bg-surface px-3 py-1 text-start font-body text-body",
                  on ? "border-teal text-teal shadow-selected" : "border-line text-ink",
                )}
              >
                <span>{one.local}</span>
                {one.dubai ? <small className="text-caption text-muted">{c.dubai.replace("{time}", one.dubai)}</small> : null}
              </button>
            );
          })}
        </div>
      </div>
    ) : days.length > 0 ? (
      <p className="m-0 text-label text-muted">
        {c.chooseDay} · {zoneLine}
      </p>
    ) : (
      <div className="grid justify-items-start gap-4">
        <p role="status" className={MESSAGE}>
          {c.noTimes}
        </p>
        <Button variant="secondary" disabled={atLast} onClick={() => move(1)}>
          {c.next}
        </Button>
      </div>
    );

    const bookForm = chosenSlot ? (
      <form ref={form} method="post" action="/api/consult/book" noValidate aria-label={c.heading} className={FORM_BOX} onSubmit={onSubmit}>
        <p className="m-0 border border-line border-s-3 border-s-gold bg-surface px-4 py-3 text-body text-ink">
          <b>{c.selected}:</b> {dateLabel(chosenSlot.start, zone, locale, false)}, {chosenSlot.local} {c.yourTime}
          {chosenSlot.dubai ? ` · ${c.dubai.replace("{time}", chosenSlot.dubai)}` : ""}
        </p>
        {failed ? <FailedLine template={copy.failed} whatsappWord={copy.whatsappWord} email={email} mailto={mailto} whatsappHref={whatsappHref} newTabLabel={newTabLabel} /> : null}
        <Field id={id("name")} name={F.name} label={c.name} required autoComplete="name" maxLength={120} className="max-w-none" value={values.name} onChange={(e) => set("name", e.target.value)} error={message("name")} />
        <Field id={id("email")} name={F.email} label={c.email} type="email" dir="ltr" required autoComplete="email" maxLength={254} className="max-w-none" value={values.email} onChange={(e) => set("email", e.target.value)} error={message("email")} />
        <Field id={id("phone")} name={F.phone} label={c.phone} type="tel" dir="ltr" required autoComplete="tel" maxLength={20} className="max-w-none" value={values.phone} onChange={(e) => set("phone", e.target.value)} error={message("phone")} />
        <Field id={id("notes")} name={F.callNotes} label={c.message} multiline maxLength={2000} className="max-w-none" value={values.notes} onChange={(e) => set("notes", e.target.value)} error={message("notes")} />
        <RequestHoneypots />
        <div>
          <Button type="submit" busy={busy}>
            {c.book}
          </Button>
        </div>
      </form>
    ) : null;

    inner = (
      <>
        {notice ? (
          <p ref={line} role="alert" tabIndex={-1} className={MESSAGE_BAD}>
            {c.taken}
          </p>
        ) : null}
        {bookForm ? (
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <div className="grid gap-6">
              {calendar}
              {times}
            </div>
            {bookForm}
          </div>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-2">
            {calendar}
            {times}
          </div>
        )}
      </>
    );
  }

  return (
    <PageShell className="py-16 md:py-section">
      <section id="consultation" aria-labelledby="consultation-heading" className="grid scroll-mt-16 gap-6">
        <h2 id="consultation-heading" className="m-0 font-display text-heading font-normal text-teal md:text-display">
          {c.heading}
        </h2>
        <p className="m-0 max-w-md text-body text-ink">{c.intro}</p>
        {inner}
      </section>
    </PageShell>
  );
}

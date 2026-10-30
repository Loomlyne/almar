"use client";

import { CalendarDate, parseDate } from "@internationalized/date";
import { useEffect, useId, useRef, useState } from "react";
import type { ConsultSetup, DetailReply, Locale3, OpsError, WriteResult } from "../../../../../components/ops/api-types";
import { backGuards } from "../../../../../components/ops/back-guard";
import { errorText } from "../../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { Button } from "../../../../../components/ui/button";
import { CalendarPanel } from "../../../../../components/ui/calendar";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { Select } from "../../../../../components/ui/select";
import { asciiDigits } from "../../../../../lib/contact-inquiry";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_REQUESTS_COPY } from "../../../../../lib/copy/ops-requests";
import { dubaiToday } from "../../../../../lib/ops/validate-posts";

// Content -> Consultation (plan 06-05, F-04; pictures/06-05 consult-editor-*): weekly hours in Dubai time in 30-minute steps, days
// off, minimum notice and booking horizon. Notice and horizon start empty while null and nothing fills them: the calendar on
// Contact stays closed until the owner types both (F-04). A new range starts with no time chosen, so no hour is invented. Save
// sends only what changed; the public slots follow on the next request, with no site rebuild. Past days off are hidden and kept.

const PATH = "/api/ops/consult";
const TAGS: Record<Locale3, string> = { en: "en-GB", ar: "ar-AE-u-ca-gregory-nu-latn", es: "es" };
const NO_TIME = "--:--";

/** Every half hour of the day: starts run 00:00..23:30, ends 00:30..24:00. */
const STEPS = Array.from({ length: 49 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const START_OPTIONS = STEPS.slice(0, -1).map((value) => ({ value, label: value }));
const END_OPTIONS = STEPS.slice(1).map((value) => ({ value, label: value }));

type Range = { key: string; starts: string; ends: string };
type Form = { hours: Range[][]; daysOff: string[]; notice: string; horizon: string };
type NumberError = { notice?: true; horizon?: true };
type RangeErrors = Record<string, "overlap" | "start">;

let nextKey = 0;
const newKey = () => `range-${++nextKey}`;

function formFrom(setup: ConsultSetup): Form {
  const hours: Range[][] = Array.from({ length: 7 }, () => []);
  for (const row of setup.hours) hours[row.weekday - 1]?.push({ key: newKey(), starts: row.starts, ends: row.ends });
  return {
    hours,
    daysOff: [...setup.days_off].sort(),
    notice: setup.notice_hours === null ? "" : String(setup.notice_hours),
    horizon: setup.horizon_days === null ? "" : String(setup.horizon_days),
  };
}

const hoursBody = (form: Form) => form.hours.flatMap((day, at) => day.map(({ starts, ends }) => ({ weekday: at + 1, starts, ends })));

/** A whole number within bounds, or null for empty; undefined when it is not one. */
function whole(value: string, min: number, max: number): number | null | undefined {
  const typed = asciiDigits(value).trim();
  if (typed === "") return null;
  if (!/^\d{1,6}$/.test(typed)) return undefined;
  const n = Number(typed);
  return n >= min && n <= max ? n : undefined;
}

function rangeErrors(form: Form): RangeErrors {
  const out: RangeErrors = {};
  for (const day of form.hours) {
    day.forEach((range, at) => {
      if (!range.starts || !range.ends || range.starts >= range.ends) {
        out[range.key] = "start";
        return;
      }
      const clash = day.slice(0, at).some((other) => other.starts && other.ends && range.starts < other.ends && other.starts < range.ends);
      if (clash) out[range.key] = "overlap";
    });
  }
  return out;
}

const dayIn = (day: string, locale: Locale3) => new Intl.DateTimeFormat(TAGS[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

export function ConsultationScreen() {
  const locale = useDashboardLocale();
  const copy = OPS_REQUESTS_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const idBase = useId();
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [error, setError] = useState<OpsError | null>(null);
  const [busy, setBusy] = useState(false);
  const [didSave, setDidSave] = useState(false);
  const [numbers, setNumbers] = useState<NumberError>({});
  const [ranges, setRanges] = useState<RangeErrors>({});
  const [adding, setAdding] = useState(false);
  const [hover, setHover] = useState<CalendarDate | null>(null);
  const [asking, setAsking] = useState<"back" | "link" | null>(null);
  const letGo = useRef(false);
  const guardAgain = useRef<(() => void) | null>(null);
  const leavingTo = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    void (async () => {
      const reply = await opsFetch<DetailReply<ConsultSetup>>(PATH);
      if (!reply.ok) {
        setError(reply.error);
        return;
      }
      const next = formFrom(reply.item);
      setForm(next);
      setSaved(next);
    })();
  }, []);

  const hoursChanged = form && saved ? JSON.stringify(hoursBody(form)) !== JSON.stringify(hoursBody(saved)) : false;
  const offChanged = form && saved ? JSON.stringify(form.daysOff) !== JSON.stringify(saved.daysOff) : false;
  const noticeChanged = form && saved ? form.notice.trim() !== saved.notice : false;
  const horizonChanged = form && saved ? form.horizon.trim() !== saved.horizon : false;
  const dirty = hoursChanged || offChanged || noticeChanged || horizonChanged;

  // The kit's Back guard (components/ops/back-guard.ts, as components/ops/edit-page.tsx uses it): with unsaved changes a link
  // elsewhere and the browser's Back ask "Discard changes?" first.
  useEffect(() => {
    backGuards().loaded();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const guards = backGuards();
    let guarded = true;
    let trap = guards.arm();
    const onPop = () => {
      if (letGo.current || !guarded) return;
      guarded = false;
      setAsking("back");
    };
    const onClick = (event: MouseEvent) => {
      if (letGo.current || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.getAttribute("href")?.startsWith("#")) return;
      event.preventDefault();
      event.stopPropagation();
      leavingTo.current = anchor;
      setAsking("link");
    };
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    guardAgain.current = () => {
      if (guarded) return;
      guarded = true;
      trap = guards.arm();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onLeave);
      guardAgain.current = null;
      guards.release(trap);
    };
  }, [dirty]);

  if (!form) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.ctitle}</h1>
        {error ? (
          <p role="alert" className="m-0 text-label text-error">
            {errorText(kit, error)}
          </p>
        ) : null}
      </div>
    );
  }

  const change = (next: Form) => {
    setForm(next);
    setDidSave(false);
    setError(null);
  };

  const setDay = (at: number, day: Range[]) => {
    const hours = form.hours.slice();
    hours[at] = day;
    change({ ...form, hours });
    setRanges({});
  };

  async function onSave() {
    if (!form || !saved || busy) return;
    const notice = whole(form.notice, 0, 720);
    const horizon = whole(form.horizon, 1, 365);
    const bad: NumberError = {};
    if (notice === undefined) bad.notice = true;
    if (horizon === undefined) bad.horizon = true;
    const clashes = rangeErrors(form);
    setNumbers(bad);
    setRanges(clashes);
    if (Object.keys(bad).length > 0 || Object.keys(clashes).length > 0) return;

    const body: Record<string, unknown> = { action: "save" };
    if (hoursChanged) body.hours = hoursBody(form);
    if (offChanged) body.days_off = form.daysOff;
    if (noticeChanged) body.notice_hours = notice;
    if (horizonChanged) body.horizon_days = horizon;

    setBusy(true);
    setError(null);
    const reply = await opsSend<WriteResult & { item: ConsultSetup | null }>(PATH, body);
    setBusy(false);
    if (!reply.ok) {
      setError(reply.error);
      return;
    }
    const next = reply.item ? formFrom(reply.item) : form;
    setForm(next);
    setSaved(next);
    setDidSave(true);
  }

  const fieldLabel = (field: string): string | undefined => {
    if (field === "notice_hours") return copy.notice;
    if (field === "horizon_days") return copy.horizon;
    if (field === "days_off") return copy.daysOff;
    if (field === "hours" || field === "starts" || field === "ends" || /^\d+$/.test(field)) return copy.hours;
    return undefined;
  };

  const today = dubaiToday();
  const closedNote = form.notice.trim() === "" || form.horizon.trim() === "";
  const removeLink = "inline-flex min-h-control cursor-pointer items-center border-0 bg-transparent p-0 font-body text-label text-error underline decoration-1 underline-offset-4";
  const addLink = "inline-flex min-h-control w-max cursor-pointer items-center border-0 bg-transparent p-0 font-body text-label text-teal underline decoration-gold decoration-1 underline-offset-4";
  const card = "flex min-w-0 flex-col gap-4 border border-line bg-surface p-4 md:p-6";
  const cardTitle = "m-0 font-display text-title font-normal text-teal";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.ctitle}</h1>
          <p className="m-0 mt-2 text-label text-muted">{copy.cintro}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {didSave ? (
            <span role="status" className="text-label text-muted">
              {copy.saved}
            </span>
          ) : null}
          <Button busy={busy} disabled={!dirty} onClick={() => void onSave()}>
            {kit.save}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="m-0 text-label text-error">
          {errorText(kit, error, fieldLabel)}
        </p>
      ) : null}

      <section className={card} aria-labelledby={`${idBase}-hours`}>
        <h2 id={`${idBase}-hours`} className={cardTitle}>
          {copy.hours}
        </h2>
        {copy.days.map((name, at) => {
          const day = form.hours[at] ?? [];
          return (
            <div key={name} className="grid items-start gap-3 border-b border-line py-3 md:grid-cols-[8.75rem_1fr]">
              <p className="m-0 text-label font-bold text-ink">{name}</p>
              <div className="flex flex-col gap-2">
                {day.length === 0 ? <p className="m-0 text-label text-muted">{copy.closed}</p> : null}
                {day.map((range, index) => {
                  const problem = ranges[range.key];
                  return (
                    <div key={range.key} className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="grid gap-2">
                          <span className="text-label text-ink">{copy.from}</span>
                          <Select
                            value={range.starts || null}
                            placeholder={NO_TIME}
                            options={START_OPTIONS}
                            onChange={(starts) => setDay(at, day.map((r, i) => (i === index ? { ...r, starts } : r)))}
                            label={`${name} ${copy.from}: {name}`}
                            dir={dir}
                            className="w-30"
                            invalid={Boolean(problem)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <span className="text-label text-ink">{copy.to}</span>
                          <Select
                            value={range.ends || null}
                            placeholder={NO_TIME}
                            options={END_OPTIONS}
                            onChange={(ends) => setDay(at, day.map((r, i) => (i === index ? { ...r, ends } : r)))}
                            label={`${name} ${copy.to}: {name}`}
                            dir={dir}
                            className="w-30"
                            invalid={Boolean(problem)}
                          />
                        </div>
                        <button type="button" className={removeLink} onClick={() => setDay(at, day.filter((_, i) => i !== index))}>
                          {copy.remove}
                        </button>
                      </div>
                      {problem ? (
                        <p role="alert" className="m-0 border-s-2 border-error ps-2 text-label text-ink">
                          {problem === "overlap" ? copy.err.overlap : copy.err.start}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                <button type="button" className={addLink} onClick={() => setDay(at, [...day, { key: newKey(), starts: "", ends: "" }])}>
                  {copy.addHours}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section className={card} aria-labelledby={`${idBase}-off`}>
        <h2 id={`${idBase}-off`} className={cardTitle}>
          {copy.daysOff}
        </h2>
        {form.daysOff
          .filter((day) => day >= today)
          .map((day) => (
            <div key={day} className="flex flex-wrap items-center gap-3">
              <span className="text-label text-ink">
                <bdi dir="ltr">{dayIn(day, locale)}</bdi>
              </span>
              <button type="button" className={removeLink} onClick={() => change({ ...form, daysOff: form.daysOff.filter((other) => other !== day) })}>
                {copy.remove}
              </button>
            </div>
          ))}
        <div>
          <Button variant="secondary" aria-expanded={adding} onClick={() => setAdding((value) => !value)}>
            {copy.addOff}
          </Button>
        </div>
        {adding ? (
          <div className="max-w-sm">
            <CalendarPanel
              start={null}
              end={null}
              hover={hover}
              onHover={setHover}
              now={parseDate(today)}
              onPick={(date) => {
                const day = date.toString();
                setAdding(false);
                if (!form.daysOff.includes(day)) change({ ...form, daysOff: [...form.daysOff, day].sort() });
              }}
            />
          </div>
        ) : null}
      </section>

      <section className={card} aria-labelledby={`${idBase}-limits`}>
        <h2 id={`${idBase}-limits`} className={cardTitle}>
          {copy.limits}
        </h2>
        {closedNote ? <p className="m-0 border border-line border-s-3 border-s-teal bg-surface px-4 py-3 text-label text-ink">{copy.closedNote}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id={`${idBase}-notice`}
            label={copy.notice}
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            className="max-w-none"
            value={form.notice}
            error={numbers.notice ? copy.err.num : undefined}
            onChange={(event) => {
              setNumbers((was) => ({ ...was, notice: undefined }));
              change({ ...form, notice: event.target.value });
            }}
          />
          <Field
            id={`${idBase}-horizon`}
            label={copy.horizon}
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            className="max-w-none"
            value={form.horizon}
            error={numbers.horizon ? copy.err.num : undefined}
            onChange={(event) => {
              setNumbers((was) => ({ ...was, horizon: undefined }));
              change({ ...form, horizon: event.target.value });
            }}
          />
        </div>
      </section>

      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(stay) => {
          if (stay) return;
          if (asking === "back") guardAgain.current?.();
          setAsking(null);
        }}
        title={kit.discardTitle}
        confirmLabel={kit.discard}
        cancelLabel={kit.keepEditing}
        onConfirm={() => {
          const why = asking;
          setAsking(null);
          letGo.current = true;
          if (why === "back") window.history.back();
          else leavingTo.current?.click();
        }}
      />
    </div>
  );
}

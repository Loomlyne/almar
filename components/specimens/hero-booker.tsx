"use client";

import { BOOKER_COPY, type HomeLocale } from "../../lib/copy/home";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
import { CalendarPanel, formatDate } from "../ui/calendar";
import { Button } from "../ui/button";
import { Stepper } from "../ui/stepper";
import { cn } from "../../lib/cn";

type BookerLabels = {
  form: string;
  destination: string;
  choosePlace: string;
  dates: string;
  chooseDates: string;
  checkIn: string;
  checkOut: string;
  addDate: string;
  guests: string;
  search: string;
  done: string;
  clearSearch: string;
  clearDates: string;
  noMatch: string;
  placeholder: string;
  night: string;
  nights: string;
  guest: string;
  guestsWord: string;
  infant: string;
  infants: string;
  adults: string;
  children: string;
  infantsLabel: string;
  adultHint: string;
  childHint: string;
  infantHint: string;
  addAdult: string;
  removeAdult: string;
  addChild: string;
  removeChild: string;
  addInfant: string;
  removeInfant: string;
  floorNote: string;
  needBoth: string;
  needWhere: string;
  needWhen: string;
  preview: string;
  selected: string;
  checkInSet: string;
  nightSelected: string;
  nightsSelected: string;
  datesCleared: string;
};

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";
const SLOT = "relative min-w-0 md:flex-1 md:basis-0";
const SLOT_NEXT = "border-t border-line md:border-s md:border-t-0";
const SEGMENT = cn(
  "flex min-h-entry w-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-none border-0 bg-transparent px-4 py-3 text-start transition-colors duration-fast ease-standard hover:bg-ivory aria-expanded:bg-ivory aria-expanded:shadow-rule-primary aria-invalid:shadow-rule-error",
  FOCUS,
);
const LABEL = "whitespace-nowrap text-caption text-teal";
const KICKER = "m-0 whitespace-nowrap text-caption text-teal";
const VALUE = "max-w-full truncate text-body text-ink";
const PANEL =
  "m-0 border-t border-line bg-ivory p-4 text-ink md:absolute md:top-full md:z-10 md:mt-2 md:border md:border-line md:bg-surface md:shadow-lg";
const PANEL_BAR = "mt-4 flex flex-wrap justify-end gap-3";

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

const DESTINATIONS = [
  { name: "Cartagena", region: "Caribbean coast" },
  { name: "Medellín", region: "Andes" },
  { name: "Bogotá", region: "Capital" },
  { name: "San Andrés", region: "Island" },
  { name: "Cocora Valley", region: "Coffee region" },
] as const;

type Panel = "where" | "when" | "guests";
type Guests = { adult: number; child: number; infant: number };
type GuestKey = keyof Guests;

const GUEST_ROWS: ReadonlyArray<{
  key: GuestKey;
  label: string;
  hint: string;
  floor: number;
  add: string;
  remove: string;
  floorNote: string;
}> = [
  {
    key: "adult",
    label: "Adults",
    hint: "13+",
    floor: 1,
    add: "Add adult",
    remove: "Remove adult",
    floorNote: "At least 1 adult",
  },
  {
    key: "child",
    label: "Children",
    hint: "3–12",
    floor: 0,
    add: "Add child",
    remove: "Remove child",
    floorNote: "",
  },
  {
    key: "infant",
    label: "Infants",
    hint: "0–2",
    floor: 0,
    add: "Add infant",
    remove: "Remove infant",
    floorNote: "",
  },
];

function compare(a: CalendarDate, b: CalendarDate) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function nightsBetween(start: CalendarDate, end: CalendarDate) {
  const zone = getLocalTimeZone();
  const ms = end.toDate(zone).getTime() - start.toDate(zone).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function nightsLabel(count: number, labels: BookerLabels) {
  return count === 1 ? labels.night : fill(labels.nights, { count });
}

function rangeLabel(
  start: CalendarDate | null,
  end: CalendarDate | null,
  labels: BookerLabels,
  dateLocale: string,
) {
  if (!start) return labels.chooseDates;
  const zone = getLocalTimeZone();
  const fmt = new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short" });
  const startDate = start.toDate(zone);
  if (!end) return fmt.format(startDate);
  const endDate = end.toDate(zone);
  if (typeof fmt.formatRange === "function") return fmt.formatRange(startDate, endDate);
  return `${fmt.format(startDate)} – ${fmt.format(endDate)}`;
}

function guestLabel(guests: Guests, labels: BookerLabels) {
  const people = guests.adult + guests.child;
  const guestsText = people === 1 ? labels.guest : fill(labels.guestsWord, { count: people });
  if (guests.infant === 0) return guestsText;
  if (guests.infant === 1) return `${guestsText}, ${labels.infant}`;
  return `${guestsText}, ${fill(labels.infants, { count: guests.infant })}`;
}

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export type HeroBookQuery = {
  where: string;
  "check-in": string;
  "check-out": string;
  adults: string;
  children: string;
  infants: string;
};

export function HeroBooker({
  labels,
  locale = "en",
  dateLocale = "en-GB",
  onBook,
}: {
  labels?: BookerLabels;
  locale?: HomeLocale;
  dateLocale?: string;
  onBook?: (query: HeroBookQuery) => void;
} = {}) {
  const t = labels ?? BOOKER_COPY[locale];
  const baseId = useId();
  const whereId = `${baseId}-where`;
  const whenId = `${baseId}-when`;
  const guestsId = `${baseId}-guests`;
  const formRef = useRef<HTMLFormElement>(null);
  const whereBtnRef = useRef<HTMLButtonElement>(null);
  const whenBtnRef = useRef<HTMLButtonElement>(null);
  const guestsBtnRef = useRef<HTMLButtonElement>(null);
  const whereInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<Panel | null>(null);
  const [where, setWhere] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [start, setStart] = useState<CalendarDate | null>(null);
  const [end, setEnd] = useState<CalendarDate | null>(null);
  const [hover, setHover] = useState<CalendarDate | null>(null);
  const [guests, setGuests] = useState<Guests>({ adult: 1, child: 0, infant: 0 });
  const [tried, setTried] = useState(false);
  const [live, setLive] = useState("");

  const matches = DESTINATIONS.filter((item) => {
    const needle = fold(query.trim());
    if (!needle) return true;
    return fold(item.name).includes(needle) || fold(item.region).includes(needle);
  });

  const knownWhere = Boolean(where && DESTINATIONS.some((item) => item.name === where));
  const missingWhere = tried && !knownWhere;
  const missingWhen = tried && (!start || !end);
  const notice = !tried
    ? ""
    : missingWhere && missingWhen
      ? t.needBoth
      : missingWhere
        ? t.needWhere
        : missingWhen
          ? t.needWhen
          : onBook
            ? ""
            : t.preview;

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const root = formRef.current;
      if (!root) return;
      if (open === "where") {
        whereInputRef.current?.focus();
        return;
      }
      const panel = root.querySelector<HTMLElement>(`[data-panel="${open}"]`);
      const day = panel?.querySelector<HTMLElement>("[data-date][tabindex='0']");
      const control = day ?? panel?.querySelector<HTMLElement>("button:not(:disabled)");
      control?.focus();
      panel?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!formRef.current?.contains(event.target as Node)) setOpen(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      const trigger =
        open === "where" ? whereBtnRef : open === "when" ? whenBtnRef : guestsBtnRef;
      setOpen(null);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(panel: Panel) {
    setOpen((current) => (current === panel ? null : panel));
  }

  function chooseWhere(name: string) {
    setWhere(name);
    setQuery("");
    setLive(fill(t.selected, { name }));
    setOpen("when");
  }

  function pick(date: CalendarDate) {
    if (!start || end || compare(date, start) === 0) {
      setStart(date);
      setEnd(null);
      setLive(t.checkInSet);
      return;
    }
    const nextStart = compare(date, start) < 0 ? date : start;
    const nextEnd = compare(date, start) < 0 ? start : date;
    setStart(nextStart);
    setEnd(nextEnd);
    const count = nightsBetween(nextStart, nextEnd);
    setLive(count === 1 ? t.nightSelected : fill(t.nightsSelected, { count }));
    setOpen("guests");
  }

  function clearDates() {
    setStart(null);
    setEnd(null);
    setHover(null);
    setLive(t.datesCleared);
  }

  function changeGuests(key: GuestKey, floor: number, delta: number) {
    const value = Math.max(floor, guests[key] + delta);
    if (value === guests[key]) return;
    const next = { ...guests, [key]: value };
    setGuests(next);
    setLive(guestLabel(next, t));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setOpen(null);
    if (!onBook || !where || !start || !end) return;
    if (!DESTINATIONS.some((item) => item.name === where)) return;
    onBook({
      where,
      "check-in": formatDate(start),
      "check-out": formatDate(end),
      adults: String(guests.adult),
      children: String(guests.child),
      infants: String(guests.infant),
    });
  }

  function onQueryKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (matches.length === 1) chooseWhere(matches[0].name);
  }

  const nights = start && end ? nightsBetween(start, end) : null;
  const guestRows = [
    {
      key: "adult" as const,
      label: t.adults,
      hint: t.adultHint,
      floor: 1,
      add: t.addAdult,
      remove: t.removeAdult,
      floorNote: t.floorNote,
    },
    {
      key: "child" as const,
      label: t.children,
      hint: t.childHint,
      floor: 0,
      add: t.addChild,
      remove: t.removeChild,
      floorNote: "",
    },
    {
      key: "infant" as const,
      label: t.infantsLabel,
      hint: t.infantHint,
      floor: 0,
      add: t.addInfant,
      remove: t.removeInfant,
      floorNote: "",
    },
  ];

  return (
    <form
      ref={formRef}
      className="relative z-20 block max-w-full font-body text-body text-ink"
      role="search"
      aria-label={t.form}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col items-stretch border border-t-2 border-line border-t-gold bg-surface md:flex-row">
        <div className={SLOT} data-slot="where">
          <button
            ref={whereBtnRef}
            type="button"
            className={SEGMENT}
            aria-expanded={open === "where"}
            aria-controls={open === "where" ? whereId : undefined}
            aria-invalid={missingWhere || undefined}
            onClick={() => toggle("where")}
          >
            <span className={LABEL}>{t.destination}</span>
            <span className={cn(VALUE, !where && "text-muted")}>{where ?? t.choosePlace}</span>
          </button>
          {open === "where" ? (
            <div
              id={whereId}
              className={cn(PANEL, "md:start-0 md:w-menu")}
              data-panel="where"
              role="region"
              aria-label={t.destination}
            >
              <label className="mb-3 grid gap-1">
                <span className="text-label text-teal">{t.destination}</span>
                <input
                  ref={whereInputRef}
                  name="destination-filter"
                  className={cn(
                    "min-h-control w-full rounded-none border border-teal bg-surface px-3 text-body text-ink",
                    FOCUS,
                  )}
                  value={query}
                  placeholder={t.placeholder}
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onQueryKeyDown}
                />
              </label>
              {matches.length === 0 ? (
                <div className="grid justify-items-start gap-2">
                  <p className="m-0 text-pretty">{t.noMatch}</p>
                  <Button variant="secondary" onClick={() => setQuery("")}>
                    {t.clearSearch}
                  </Button>
                </div>
              ) : (
                <ul className="m-0 grid list-none gap-0 p-0">
                  {matches.map((item) => (
                    <li key={item.name}>
                      <button
                        type="button"
                        className={cn(
                          "flex min-h-control w-full cursor-pointer flex-col items-start justify-center gap-0.5 rounded-none border-0 bg-transparent px-3 py-2 text-start text-body transition-colors duration-fast ease-standard hover:bg-ivory aria-pressed:bg-ivory aria-pressed:shadow-rule-primary",
                          FOCUS,
                        )}
                        aria-pressed={where === item.name}
                        onClick={() => chooseWhere(item.name)}
                      >
                        <span>{item.name}</span>
                        <span className="text-label text-muted">{item.region}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className={PANEL_BAR}>
                <Button variant="secondary" onClick={() => setOpen(null)}>
                  {t.done}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className={cn(SLOT, SLOT_NEXT)} data-slot="when">
          <button
            ref={whenBtnRef}
            type="button"
            className={SEGMENT}
            aria-expanded={open === "when"}
            aria-controls={open === "when" ? whenId : undefined}
            aria-invalid={missingWhen || undefined}
            onClick={() => toggle("when")}
          >
            <span className={LABEL}>{t.dates}</span>
            <span className={cn(VALUE, !start && "text-muted")}>{rangeLabel(start, end, t, dateLocale)}</span>
          </button>
          {open === "when" ? (
            <div
              id={whenId}
              className={cn(PANEL, "md:start-0 md:w-dialog")}
              data-panel="when"
              role="region"
              aria-label={t.dates}
            >
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <p className={KICKER}>{t.checkIn}</p>
                  <p className={cn(VALUE, "m-0", !start && "text-muted")}>
                    {start ? formatDate(start) : t.addDate}
                  </p>
                </div>
                <div>
                  <p className={KICKER}>{t.checkOut}</p>
                  <p className={cn(VALUE, "m-0", !end && "text-muted")}>{end ? formatDate(end) : t.addDate}</p>
                </div>
              </div>
              {nights !== null ? (
                <p className="m-0 mb-2 text-label tabular-nums">{nightsLabel(nights, t)}</p>
              ) : null}
              <div className="max-w-full overflow-x-auto overscroll-contain">
                <CalendarPanel start={start} end={end} hover={hover} onPick={pick} onHover={setHover} />
              </div>
              <div className={PANEL_BAR}>
                <Button variant="secondary" onClick={clearDates} disabled={!start}>
                  {t.clearDates}
                </Button>
                <Button variant="secondary" onClick={() => setOpen(null)}>
                  {t.done}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className={cn(SLOT, SLOT_NEXT)} data-slot="guests">
          <button
            ref={guestsBtnRef}
            type="button"
            className={SEGMENT}
            aria-expanded={open === "guests"}
            aria-controls={open === "guests" ? guestsId : undefined}
            onClick={() => toggle("guests")}
          >
            <span className={LABEL}>{t.guests}</span>
            <span className={VALUE}>{guestLabel(guests, t)}</span>
          </button>
          {open === "guests" ? (
            <div
              id={guestsId}
              className={cn(PANEL, "md:end-0 md:w-menu")}
              data-panel="guests"
              role="region"
              aria-label={t.guests}
            >
              <div className="grid gap-2">
                {guestRows.map((row) => {
                  const value = guests[row.key];
                  const atFloor = value <= row.floor;
                  return (
                    <div key={row.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-1">
                      <div className="grid min-w-0 gap-0.5">
                        <p className="m-0 text-body">{row.label}</p>
                        <p className="m-0 text-label text-muted">{row.hint}</p>
                      </div>
                      <Stepper
                        value={value}
                        min={row.floor}
                        onChange={(next) => changeGuests(row.key, row.floor, next - value)}
                        addLabel={row.add}
                        removeLabel={row.remove}
                      />
                      {atFloor && row.floorNote ? (
                        <p className="m-0 basis-full text-label text-muted">{row.floorNote}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className={PANEL_BAR}>
                <Button variant="secondary" onClick={() => setOpen(null)}>
                  {t.done}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <Button type="submit" size="bar" className="w-full md:h-auto md:w-search">
          {t.search}
        </Button>
      </div>

      <input type="hidden" name="where" value={where ?? ""} />
      <input type="hidden" name="check-in" value={start ? formatDate(start) : ""} />
      <input type="hidden" name="check-out" value={end ? formatDate(end) : ""} />
      <input type="hidden" name="adults" value={guests.adult} />
      <input type="hidden" name="children" value={guests.child} />
      <input type="hidden" name="infants" value={guests.infant} />

      <p className="sr-only" role="status">
        {live}
      </p>
      <p className="m-0 mt-2 text-pretty text-label text-ink empty:sr-only" role="status">
        {notice}
      </p>
    </form>
  );
}

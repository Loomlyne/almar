"use client";

import { BOOKER_COPY, type HomeLocale } from "../../lib/copy/home";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
import { CalendarPanel, formatDate } from "../ui/calendar";

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
      className="hero-booker hero-search"
      role="search"
      aria-label={t.form}
      onSubmit={onSubmit}
    >
      <div className="hero-search-bar">
        <div className="hero-search-slot" data-slot="where">
          <button
            ref={whereBtnRef}
            type="button"
            className="hero-search-segment"
            aria-expanded={open === "where"}
            aria-controls={open === "where" ? whereId : undefined}
            aria-invalid={missingWhere || undefined}
            onClick={() => toggle("where")}
          >
            <span className="hero-search-label">{t.destination}</span>
            <span className={where ? "hero-search-value" : "hero-search-value is-empty"}>
              {where ?? t.choosePlace}
            </span>
          </button>
          {open === "where" ? (
            <div id={whereId} className="hero-search-panel" data-panel="where" role="region" aria-label={t.destination}>
              <label className="hero-search-field">
                <span>{t.destination}</span>
                <input
                  ref={whereInputRef}
                  name="destination-filter"
                  value={query}
                  placeholder={t.placeholder}
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onQueryKeyDown}
                />
              </label>
              {matches.length === 0 ? (
                <div className="hero-search-empty">
                  <p>{t.noMatch}</p>
                  <button type="button" className="hero-search-textbtn" onClick={() => setQuery("")}>
                    {t.clearSearch}
                  </button>
                </div>
              ) : (
                <ul className="hero-search-options">
                  {matches.map((item) => (
                    <li key={item.name}>
                      <button
                        type="button"
                        className="hero-search-option"
                        aria-pressed={where === item.name}
                        onClick={() => chooseWhere(item.name)}
                      >
                        <span>{item.name}</span>
                        <span className="hero-search-region">{item.region}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="hero-search-panel-bar">
                <button type="button" className="hero-search-textbtn" onClick={() => setOpen(null)}>
                  {t.done}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="hero-search-slot" data-slot="when">
          <button
            ref={whenBtnRef}
            type="button"
            className="hero-search-segment"
            aria-expanded={open === "when"}
            aria-controls={open === "when" ? whenId : undefined}
            aria-invalid={missingWhen || undefined}
            onClick={() => toggle("when")}
          >
            <span className="hero-search-label">{t.dates}</span>
            <span className={start ? "hero-search-value" : "hero-search-value is-empty"}>
              {rangeLabel(start, end, t, dateLocale)}
            </span>
          </button>
          {open === "when" ? (
            <div id={whenId} className="hero-search-panel" data-panel="when" role="region" aria-label={t.dates}>
              <div className="hero-search-range">
                <div>
                  <p className="hero-search-kicker">{t.checkIn}</p>
                  <p className={start ? "hero-search-date" : "hero-search-date is-empty"}>
                    {start ? formatDate(start) : t.addDate}
                  </p>
                </div>
                <div>
                  <p className="hero-search-kicker">{t.checkOut}</p>
                  <p className={end ? "hero-search-date" : "hero-search-date is-empty"}>
                    {end ? formatDate(end) : t.addDate}
                  </p>
                </div>
              </div>
              {nights !== null ? <p className="hero-search-nights">{nightsLabel(nights, t)}</p> : null}
              <div className="hero-search-dates">
                <CalendarPanel start={start} end={end} hover={hover} onPick={pick} onHover={setHover} />
              </div>
              <div className="hero-search-panel-bar">
                <button type="button" className="hero-search-textbtn" onClick={clearDates} disabled={!start}>
                  {t.clearDates}
                </button>
                <button type="button" className="hero-search-textbtn" onClick={() => setOpen(null)}>
                  {t.done}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="hero-search-slot" data-slot="guests">
          <button
            ref={guestsBtnRef}
            type="button"
            className="hero-search-segment"
            aria-expanded={open === "guests"}
            aria-controls={open === "guests" ? guestsId : undefined}
            onClick={() => toggle("guests")}
          >
            <span className="hero-search-label">{t.guests}</span>
            <span className="hero-search-value">{guestLabel(guests, t)}</span>
          </button>
          {open === "guests" ? (
            <div id={guestsId} className="hero-search-panel" data-panel="guests" role="region" aria-label={t.guests}>
              <div className="hero-search-guests">
                {guestRows.map((row) => {
                  const value = guests[row.key];
                  const atFloor = value <= row.floor;
                  return (
                    <div key={row.key} className="hero-search-guest">
                      <div className="hero-search-guest-copy">
                        <p className="hero-search-guest-label">{row.label}</p>
                        <p className="hero-search-guest-hint">{row.hint}</p>
                      </div>
                      <div className="hero-search-steps">
                        <button
                          type="button"
                          className="hero-search-step"
                          aria-label={row.remove}
                          disabled={atFloor}
                          onClick={() => changeGuests(row.key, row.floor, -1)}
                        >
                          −
                        </button>
                        <span className="hero-search-count">{value}</span>
                        <button
                          type="button"
                          className="hero-search-step"
                          aria-label={row.add}
                          onClick={() => changeGuests(row.key, row.floor, 1)}
                        >
                          +
                        </button>
                      </div>
                      {atFloor && row.floorNote ? (
                        <p className="hero-search-guest-note">{row.floorNote}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="hero-search-panel-bar">
                <button type="button" className="hero-search-textbtn" onClick={() => setOpen(null)}>
                  {t.done}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <button type="submit" className="hero-search-submit">
          {t.search}
        </button>
      </div>

      <input type="hidden" name="where" value={where ?? ""} />
      <input type="hidden" name="check-in" value={start ? formatDate(start) : ""} />
      <input type="hidden" name="check-out" value={end ? formatDate(end) : ""} />
      <input type="hidden" name="adults" value={guests.adult} />
      <input type="hidden" name="children" value={guests.child} />
      <input type="hidden" name="infants" value={guests.infant} />

      <p className="hero-search-live" role="status">
        {live}
      </p>
      <p className="hero-search-notice" role="status">
        {notice}
      </p>
    </form>
  );
}

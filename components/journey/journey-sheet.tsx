"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import type { CalendarDate } from "@internationalized/date";
import { Button } from "../ui/button";
import { ArrowIcon, ChevronIcon, CloseIcon, SearchIcon } from "../icons/icons";
import { cn } from "../../lib/cn";
import { fill, formatGuestSummary } from "../../lib/journey-format";
import { DateRangePanel } from "./date-range-panel";
import { DestinationMenu } from "./destination-menu";
import { GuestPanel } from "./guest-panel";
import type { Destination, JourneyCopy, JourneyValue, Locale } from "./types";

export type SheetStep = 1 | 2 | 3;

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: CalendarDate) => `${pad(d.day)}/${pad(d.month)}/${d.year}`;
const bdi = (d: CalendarDate) => <bdi dir="ltr">{fmt(d)}</bdi>;

function fillNodes(template: string, slots: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return <Fragment key={i}>{m && m[1] in slots ? slots[m[1]] : part}</Fragment>;
  });
}

/** First step whose answer is missing, or Where when everything is filled (D-43). */
export function firstMissingStep(value: JourneyValue): SheetStep {
  if (!value.destinationId) return 1;
  if (!value.start || !value.end) return 2;
  return 1;
}

function datesNode(value: JourneyValue, copy: JourneyCopy): ReactNode {
  if (value.start && value.end) {
    return (
      <>
        {bdi(value.start)} – {bdi(value.end)}
      </>
    );
  }
  if (value.start) return fillNodes(copy.bar.dates.partial, { start: bdi(value.start) });
  return null;
}

export type JourneyEntryProps = {
  variant: "entry" | "docked";
  value: JourneyValue;
  destinations: Destination[];
  /** Called with the step the sheet should open at. */
  onOpen: (step: SheetStep) => void;
  copy: JourneyCopy;
  locale: Locale;
  className?: string;
};

/** Phone hero entry and the slim docked row: one button that opens the sheet (D-42, D-43). */
export function JourneyEntry({ variant, value, destinations, onOpen, copy, locale, className }: JourneyEntryProps) {
  const destName = destinations.find((d) => d.id === value.destinationId)?.name;
  const dates = datesNode(value, copy);
  const filled = Boolean(destName || dates);
  const title: ReactNode = filled ? (
    <>
      {destName}
      {destName && dates ? " · " : null}
      {dates}
    </>
  ) : (
    copy.entry.title
  );
  const caption = filled ? formatGuestSummary(value, locale, copy.guests.summary) : copy.entry.hint;
  return (
    <button
      type="button"
      onClick={() => onOpen(firstMissingStep(value))}
      className={cn(
        "w-full bg-ivory border-t-2 border-gold flex items-center gap-4 ps-4 pe-2 text-start cursor-pointer rounded-none border-x-0 border-b-0 focus-visible:outline-2 focus-visible:outline-teal",
        variant === "entry"
          ? "h-entry shadow-float"
          : "h-bar-docked animate-dock-in motion-reduce:animate-fade-in",
        className,
      )}
    >
      <SearchIcon size={20} className="shrink-0 text-teal rtl:-scale-x-100" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body text-ink truncate">{title}</span>
        <span className="text-caption text-muted truncate">{caption}</span>
      </span>
      <span aria-hidden="true" className="size-control shrink-0 bg-teal text-ivory flex items-center justify-center">
        <ArrowIcon size={20} className="rtl:-scale-x-100" />
      </span>
    </button>
  );
}

export type JourneySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: SheetStep;
  destinations: Destination[];
  value: JourneyValue;
  onChange: (value: JourneyValue) => void;
  /** Fires only when destination and both dates are set. Never charges (D-37). */
  onSearch: (value: JourneyValue) => void;
  copy: JourneyCopy;
  locale: Locale;
  /** Injectable for deterministic tests. */
  today?: CalendarDate;
  /** Private-stay page: the destination is the stay's and is locked (D-62). */
  lockDestination?: boolean;
  /** Private-stay page: booked or blocked days for this stay (D-63). */
  blockedDates?: CalendarDate[];
  /** Harness only: start with the warning line showing. */
  initialWarn?: "where" | "when" | null;
};

type Warn = "where" | "when" | null;

/** Full-screen phone journey, one question per screen: Where, When, Who (D-42). */
export function JourneySheet(props: JourneySheetProps) {
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <SheetBody {...props} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SheetBody({
  onOpenChange,
  initialStep = 1,
  destinations,
  value,
  onChange,
  onSearch,
  copy,
  locale,
  today,
  lockDestination = false,
  blockedDates,
  initialWarn = null,
}: JourneySheetProps) {
  const s = copy.sheet;
  // With a locked destination Where is answered; the sheet starts at When.
  const [step, setStep] = useState<SheetStep>(lockDestination && initialStep === 1 ? 2 : initialStep);
  const [warn, setWarn] = useState<Warn>(initialWarn);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // No Radix trigger here (the entry lives elsewhere), so remember who opened the sheet.
  const opener = useRef<Element | null>(typeof document === "undefined" ? null : document.activeElement);
  const firstStep: SheetStep = lockDestination ? 2 : 1;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const destName = destinations.find((d) => d.id === value.destinationId)?.name;
  const hasDates = Boolean(value.start && value.end);

  function go(next: SheetStep, nextWarn: Warn = null) {
    setStep(next);
    setWarn(nextWarn);
  }

  function change(next: JourneyValue) {
    setWarn(null);
    onChange(next);
  }

  function advance() {
    if (step === 1) {
      if (!value.destinationId) setWarn("where");
      else go(2);
    } else if (step === 2) {
      if (!hasDates) setWarn("when");
      else go(3);
    } else if (!value.destinationId) go(1, "where");
    else if (!hasDates) go(2, "when");
    else onSearch({ ...value });
  }

  function back() {
    if (step === firstStep) onOpenChange(false);
    else go((step - 1) as SheetStep);
  }

  const heading = step === 1 ? s.where : step === 2 ? s.when : s.who;
  let label: ReactNode;
  let caption: ReactNode;
  if (step === 1) {
    label = destName ?? s.summary.where;
    caption = s.summary.whereHint;
  } else if (step === 2) {
    label = destName ?? s.summary.where;
    caption =
      value.start && value.end
        ? datesNode(value, copy)
        : value.start
          ? fillNodes(s.summary.whenStart, { start: bdi(value.start) })
          : s.summary.whenHint;
  } else {
    label = formatGuestSummary(value, locale, copy.guests.summary);
    caption = (
      <>
        {destName}
        {destName && hasDates ? " · " : null}
        {datesNode(value, copy)}
      </>
    );
  }

  return (
    <Dialog.Content
      aria-label={s.label}
      aria-describedby={undefined}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        headingRef.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
      }}
      className="fixed inset-0 z-70 bg-ivory text-ink flex flex-col animate-sheet-in motion-reduce:animate-fade-in"
    >
      <Dialog.Title asChild>
        <p className="sr-only">{s.label}</p>
      </Dialog.Title>
      <div className="h-sheet-head shrink-0 px-2 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          aria-label={s.back}
          className="size-control inline-flex items-center justify-center border-0 bg-transparent p-0 text-teal cursor-pointer rounded-none focus-visible:outline-2 focus-visible:outline-teal"
        >
          <ChevronIcon size={20} className="-scale-x-100 rtl:scale-x-100" />
        </button>
        <span className="text-caption text-muted tabular-nums">{fill(s.progress, { n: step })}</span>
        <Dialog.Close
          aria-label={s.close}
          className="size-control inline-flex items-center justify-center border-0 bg-transparent p-0 text-teal cursor-pointer rounded-none focus-visible:outline-2 focus-visible:outline-teal"
        >
          <CloseIcon size={20} />
        </Dialog.Close>
      </div>
      <div aria-hidden="true" className="shrink-0 px-4 grid grid-cols-3 gap-1">
        {[1, 2, 3].map((n) => (
          <span key={n} data-bar={n} className={cn("h-0.75", n <= step ? "bg-teal" : "bg-line")} />
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-8 flex flex-col gap-6">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="m-0 font-display text-display text-teal tracking-display outline-none"
        >
          {heading}
        </h2>
        {step === 1 ? (
          <DestinationMenu
            variant="sheet"
            destinations={destinations}
            selectedId={value.destinationId}
            onSelect={(id) => {
              onChange({ ...value, destinationId: id });
              go(2);
            }}
            locale={locale}
            copy={copy}
            className="-mx-4 w-auto"
          />
        ) : step === 2 ? (
          <DateRangePanel
            value={{ start: value.start, end: value.end }}
            onChange={(next) => change({ ...value, start: next.start, end: next.end })}
            onClear={() => change({ ...value, start: null, end: null })}
            onDone={() => undefined}
            months={1}
            size="phone"
            today={today}
            blocked={blockedDates}
            footer={false}
            locale={locale}
            copy={copy}
            className="px-0 pt-0 shadow-none bg-ivory"
          />
        ) : (
          <GuestPanel
            counts={{ adults: value.adults, children: value.children, infants: value.infants }}
            onChange={(counts) => change({ ...value, ...counts })}
            onDone={() => undefined}
            footer={false}
            locale={locale}
            copy={copy}
            className="w-full px-0 shadow-none bg-ivory"
          />
        )}
      </div>
      <div className="h-dock shrink-0 px-4 pb-4 border-t border-line bg-ivory flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-label text-ink truncate">{label}</span>
          {warn ? (
            <p role="alert" className="m-0 text-caption font-bold text-error truncate">
              {warn === "where" ? s.warn.where : s.warn.when}
            </p>
          ) : (
            <span className="text-caption text-muted truncate">{caption}</span>
          )}
        </div>
        <Button size="lg" onClick={advance}>
          {step === 3 ? (
            <>
              <SearchIcon size={20} className="rtl:-scale-x-100" />
              {copy.bar.search}
            </>
          ) : (
            s.next
          )}
        </Button>
      </div>
    </Dialog.Content>
  );
}

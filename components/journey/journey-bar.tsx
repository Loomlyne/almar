"use client";

import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Popover } from "radix-ui";
import type { CalendarDate } from "@internationalized/date";
import { Button } from "../ui/button";
import { AlertCircleIcon, LockIcon, SearchIcon } from "../icons/icons";
import { cn } from "../../lib/cn";
import { formatGuestSummary, formatPlural } from "../../lib/journey-format";
import { DateRangePanel } from "./date-range-panel";
import { DestinationMenu } from "./destination-menu";
import { GuestPanel } from "./guest-panel";
import { JourneySegment } from "./journey-segment";
import type { Destination, JourneyCopy, JourneyValue, Locale } from "./types";

export type JourneyPanel = "where" | "when" | "guests";

export type JourneyBarProps = {
  size: "hero" | "docked" | "summary";
  destinations: Destination[];
  value: JourneyValue;
  onChange: (value: JourneyValue) => void;
  /**
   * Fires only when destination and both dates are set. Never charges (D-37).
   * Omitted: the bar has no submit control at all (no Search button, and the wrapper is a
   * role="group", not a search form). A page with nowhere to send the search does this.
   */
  onSearch?: (value: JourneyValue) => void;
  copy: JourneyCopy;
  locale: Locale;
  /** Injectable for deterministic tests. */
  today?: CalendarDate;
  /** Harness only: open this panel on mount. */
  initialOpen?: JourneyPanel | null;
  /** Harness only: start in the Missing state as if Search had been pressed. */
  forceMissing?: string[];
  /** Private-stay page: the destination is the stay's and is locked (D-62). */
  lockDestination?: boolean;
  /** Private-stay page: booked or blocked days for this stay, from the CMS (D-63). */
  blockedDates?: CalendarDate[];
  /**
   * Private-stay page: a fourth, locked segment after Destination showing the stay. Static text with
   * a lock icon, never opens. With it the segments are 1 / 1.3 / 1.3 / 1 wide and Destination shows
   * its lock icon too.
   */
  lockStay?: { label: string; value: string };
  /** Docked only: shown once this element leaves the viewport. Omit to always show. */
  sentinelRef?: RefObject<HTMLElement | null>;
  /** Summary only: the Edit search control. */
  onEditSearch?: () => void;
  className?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: CalendarDate) => `${pad(d.day)}/${pad(d.month)}/${d.year}`;
const bdi = (d: CalendarDate) => <bdi dir="ltr">{fmt(d)}</bdi>;

function fillNodes(template: string, slots: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return <Fragment key={i}>{m && m[1] in slots ? slots[m[1]] : part}</Fragment>;
  });
}

function missingFor(value: JourneyValue): JourneyPanel[] {
  const out: JourneyPanel[] = [];
  if (!value.destinationId) out.push("where");
  if (!value.start || !value.end) out.push("when");
  return out;
}

const DESKTOP = "(min-width: 1024px)";
function useDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

/** A search form when the bar can submit; a plain labelled group when it cannot. */
function Wrapper({
  formRef,
  groupRef,
  search,
  label,
  onSubmit,
  className,
  children,
}: {
  formRef: RefObject<HTMLFormElement>;
  groupRef: RefObject<HTMLDivElement>;
  search: boolean;
  label: string;
  onSubmit: (event: FormEvent) => void;
  className: string;
  children: ReactNode;
}) {
  if (search) {
    return (
      <form ref={formRef} role="search" aria-label={label} onSubmit={onSubmit} noValidate className={className}>
        {children}
      </form>
    );
  }
  return (
    <div ref={groupRef} role="group" aria-label={label} className={className}>
      {children}
    </div>
  );
}

const shell = {
  hero: "h-bar bg-ivory border-t-2 border-gold shadow-float flex",
  docked: "h-bar-docked bg-ivory border-t-2 border-gold flex",
} as const;

export function JourneyBar({
  size,
  destinations,
  value,
  onChange,
  onSearch,
  copy,
  locale,
  today,
  initialOpen = null,
  forceMissing,
  lockDestination = false,
  blockedDates,
  lockStay,
  sentinelRef,
  onEditSearch,
  className,
}: JourneyBarProps) {
  const b = copy.bar;
  const alertId = useId();
  const desktop = useDesktop();
  const formRef = useRef<HTMLFormElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const segRefs = useRef<Partial<Record<JourneyPanel, HTMLButtonElement | null>>>({});
  const [open, setOpen] = useState<JourneyPanel | null>(initialOpen);
  const [attempted, setAttempted] = useState(Boolean(forceMissing && forceMissing.length > 0));
  const switching = useRef(false);
  const last = useRef<JourneyPanel | null>(initialOpen);
  const [shown, setShown] = useState(!sentinelRef);

  // Docked: appear when the hero bar leaves the viewport.
  useEffect(() => {
    if (size !== "docked" || !sentinelRef) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [size, sentinelRef]);

  const missing = attempted ? missingFor(value) : [];
  const alert =
    missing.length === 2 ? b.error.both : missing[0] === "where" ? b.error.destination : missing[0] === "when" ? b.error.dates : null;

  function show(panel: JourneyPanel | null) {
    // Moving between panels must not hand focus back to the old segment.
    switching.current = panel !== null && open !== null;
    if (panel) last.current = panel;
    setOpen(panel);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const gaps = missingFor(value);
    setAttempted(true);
    if (gaps.length > 0) {
      switching.current = true;
      setOpen(null);
      segRefs.current[gaps[0]]?.focus();
      return;
    }
    onSearch?.({ ...value });
  }

  // Panels anchor under their own segment on desktop and under the whole bar on tablet (D-70).
  const anchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => {
          const el = desktop && open ? segRefs.current[open] : (formRef.current ?? groupRef.current);
          return (el ?? document.body).getBoundingClientRect();
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, desktop],
  );

  if (size === "summary") {
    const nights =
      value.start && value.end
        ? Math.round((Date.UTC(value.end.year, value.end.month - 1, value.end.day) - Date.UTC(value.start.year, value.start.month - 1, value.start.day)) / 86400000)
        : 0;
    const dest = destinations.find((d) => d.id === value.destinationId)?.name;
    const dates =
      value.start && value.end ? (
        <>
          {bdi(value.start)} – {bdi(value.end)} · {formatPlural(copy.dates.nights, nights, locale)}
        </>
      ) : value.start ? (
        fillNodes(b.dates.partial, { start: bdi(value.start) })
      ) : (
        b.dates.empty
      );
    const cell = (label: string, content: ReactNode, grow: string) => (
      <div className={cn("min-w-0 px-6 flex flex-col justify-center gap-1", grow)}>
        <span className="text-caption text-muted whitespace-nowrap">{label}</span>
        <span className="text-body text-ink whitespace-nowrap truncate">{content}</span>
      </div>
    );
    return (
      <div
        role="group"
        aria-label={b.label}
        className={cn("h-summary bg-surface border border-line flex items-stretch", className)}
      >
        {cell(b.destination.label, dest ?? b.destination.empty, "flex-2")}
        <span aria-hidden="true" className="w-px h-9 self-center bg-line" />
        {cell(b.dates.label, dates, "flex-3")}
        <span aria-hidden="true" className="w-px h-9 self-center bg-line" />
        {cell(b.guests.label, formatGuestSummary(value, locale, copy.guests.summary), "flex-2")}
        <div className="border-s border-line px-6 flex items-center">
          <Button variant="ghost" onClick={onEditSearch}>
            {b.editSearch}
          </Button>
        </div>
      </div>
    );
  }

  if (size === "docked" && !shown) return null;

  const stateOf = (panel: JourneyPanel, filled: boolean) =>
    open === panel ? "open" : missing.includes(panel) ? "missing" : filled ? "filled" : "empty";

  const destName = destinations.find((d) => d.id === value.destinationId)?.name;
  const hasDates = Boolean(value.start && value.end);
  const datesValue =
    value.start && value.end ? (
      <>
        {bdi(value.start)} – {bdi(value.end)}
      </>
    ) : value.start ? (
      fillNodes(b.dates.partial, { start: bdi(value.start) })
    ) : undefined;
  const guestsValue = formatGuestSummary(value, locale, copy.guests.summary);
  const divider = <span aria-hidden="true" className="w-px h-9 self-center bg-line" />;

  return (
    <div className={cn("w-full", className)}>
      <Popover.Root open={open !== null} onOpenChange={(next) => !next && show(null)}>
        <Popover.Anchor virtualRef={anchor} />
        <Wrapper
          formRef={formRef}
          groupRef={groupRef}
          search={Boolean(onSearch)}
          label={b.label}
          onSubmit={submit}
          className={cn(shell[size], size === "docked" && "animate-dock-in motion-reduce:animate-fade-in")}
        >
          <div className={cn("min-w-0", lockStay ? "flex-10" : "flex-2")}>
            <JourneySegment
              ref={(el) => {
                segRefs.current.where = el;
              }}
              label={b.destination.label}
              placeholder={b.destination.empty}
              value={destName}
              state={stateOf("where", Boolean(destName))}
              ariaDescribedBy={alertId}
              onClick={() => show(open === "where" ? null : "where")}
              locked={lockDestination}
              lockIcon={Boolean(lockStay) && lockDestination}
            />
          </div>
          {divider}
          {lockStay ? (
            <>
              <div className="flex-13 min-w-0">
                <div
                  data-bar-segment="stay"
                  className="h-full min-w-0 px-6 flex flex-col justify-center gap-1 text-start"
                >
                  <span className="text-caption text-muted whitespace-nowrap">{lockStay.label}</span>
                  <span className="flex min-w-0 items-center gap-2 text-body text-ink whitespace-nowrap">
                    <LockIcon size={16} className="shrink-0 text-muted" />
                    <span className="truncate">{lockStay.value}</span>
                  </span>
                </div>
              </div>
              {divider}
            </>
          ) : null}
          <div className={cn("min-w-0", lockStay ? "flex-13" : "flex-3")}>
            <JourneySegment
              ref={(el) => {
                segRefs.current.when = el;
              }}
              label={b.dates.label}
              placeholder={b.dates.empty}
              value={datesValue}
              state={stateOf("when", hasDates)}
              ariaDescribedBy={alertId}
              onClick={() => show(open === "when" ? null : "when")}
            />
          </div>
          {divider}
          <div className={cn("min-w-0", lockStay ? "flex-10" : "flex-2")}>
            <JourneySegment
              ref={(el) => {
                segRefs.current.guests = el;
              }}
              label={b.guests.label}
              placeholder={b.guests.label}
              value={guestsValue}
              state={stateOf("guests", true)}
              onClick={() => show(open === "guests" ? null : "guests")}
            />
          </div>
          {onSearch ? (
            <Button type="submit" size={size === "hero" ? "bar" : "docked"} journey>
              <SearchIcon size={20} className="rtl:-scale-x-100" />
              {b.search}
            </Button>
          ) : null}
        </Wrapper>

        <Popover.Portal>
          {open ? (
            <Popover.Content
              key={open}
              side="bottom"
              align={desktop && open !== "where" ? "center" : "start"}
              sideOffset={8}
              collisionPadding={16}
              onInteractOutside={(event) => {
                // Clicks on the bar itself switch or toggle panels through the segments.
                const bar = formRef.current ?? groupRef.current;
                if (bar?.contains(event.target as Node)) event.preventDefault();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (switching.current) {
                  switching.current = false;
                  return;
                }
                if (last.current) segRefs.current[last.current]?.focus();
              }}
              className={cn("z-45 outline-none", desktop ? "w-auto" : "w-(--radix-popover-trigger-width)")}
            >
              {open === "where" ? (
                <DestinationMenu
                  destinations={destinations}
                  selectedId={value.destinationId}
                  onSelect={(id) => {
                    onChange({ ...value, destinationId: id });
                    show("when");
                  }}
                  locale={locale}
                  copy={copy}
                  className={desktop ? undefined : "w-full"}
                />
              ) : open === "when" ? (
                <DateRangePanel
                  value={{ start: value.start, end: value.end }}
                  onChange={(next) => onChange({ ...value, start: next.start, end: next.end })}
                  onClear={() => onChange({ ...value, start: null, end: null })}
                  onDone={() => show("guests")}
                  months={desktop ? 2 : 1}
                  today={today}
                  blocked={blockedDates}
                  locale={locale}
                  copy={copy}
                />
              ) : (
                <GuestPanel
                  counts={{ adults: value.adults, children: value.children, infants: value.infants }}
                  onChange={(counts) => onChange({ ...value, ...counts })}
                  onDone={() => show(null)}
                  locale={locale}
                  copy={copy}
                  className={desktop ? undefined : "w-full"}
                />
              )}
            </Popover.Content>
          ) : null}
        </Popover.Portal>
      </Popover.Root>

      {alert ? (
        <p
          id={alertId}
          role="alert"
          className="mt-3 inline-flex items-center gap-3 bg-surface shadow-lg px-4 py-3 text-label font-bold text-error"
        >
          <AlertCircleIcon size={20} className="shrink-0" />
          {alert}
        </p>
      ) : null}
    </div>
  );
}

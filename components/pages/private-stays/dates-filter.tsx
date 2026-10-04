"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { CalendarDate } from "@internationalized/date";
import { Popover } from "radix-ui";
import type { JourneyCopy } from "../../../lib/copy/journey";
import { cn } from "../../../lib/cn";
import { formatRange } from "../../../lib/format";
import { formatPlural } from "../../../lib/journey-format";
import { isoOf } from "../../../lib/journey-choice";
import { DateRangePanel, type DateRangeValue } from "../../journey/date-range-panel";
import { CloseIcon } from "../../icons/icons";

/** The panel shows two months from this width, one below it: the journey bar's own breakpoint. */
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

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
function calendarDate(iso: string): CalendarDate | null {
  const m = ISO.exec(iso);
  return m ? new CalendarDate(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}
const ddmmyyyy = (d: CalendarDate) =>
  `${String(d.day).padStart(2, "0")}/${String(d.month).padStart(2, "0")}/${d.year}`;
const utc = (d: CalendarDate) => Date.UTC(d.year, d.month - 1, d.day);

export type DatesFilterValue = { from: string; to: string };
export type DatesFilterLabels = {
  /** The visible label, also the group's accessible name. */
  label: string;
  /** The trigger's text while no dates are set. */
  empty: string;
  /** The × button's accessible name. */
  clear: string;
};

/**
 * The list's Dates filter: a labelled trigger that opens the journey bar's DateRangePanel. Picking arrival and
 * departure calls onChange at once; the × clears. Dates print DD/MM/YYYY in Western digits, left to right,
 * in every language. Every string arrives as a prop.
 */
export function DatesFilter({
  value,
  onChange,
  labels,
  journeyCopy,
  locale,
  note,
}: {
  value: DatesFilterValue;
  onChange: (next: DatesFilterValue) => void;
  labels: DatesFilterLabels;
  journeyCopy: JourneyCopy;
  locale: "en" | "ar" | "es";
  /** Shown under the control while the blocked dates are sample data; null otherwise. */
  note: string | null;
}) {
  const labelId = useId();
  const desktop = useDesktop();
  const [open, setOpen] = useState(false);
  // The range being picked. The list changes only when both ends are chosen, so the first click is held here.
  const [draft, setDraft] = useState<DateRangeValue>({ start: null, end: null });

  const start = calendarDate(value.from);
  const end = calendarDate(value.to);
  const set = start !== null && end !== null;
  const nights = set ? Math.round((utc(end) - utc(start)) / 86_400_000) : 0;

  function onOpenChange(next: boolean) {
    if (next) setDraft({ start, end });
    setOpen(next);
  }

  function pick(next: DateRangeValue) {
    setDraft(next);
    if (next.start && next.end) onChange({ from: isoOf(next.start), to: isoOf(next.end) });
  }

  function clearDraft() {
    setDraft({ start: null, end: null });
    onChange({ from: "", to: "" });
  }

  return (
    <div className="grid min-w-0 gap-2">
      <span id={labelId} className="text-label text-muted">
        {labels.label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
        <Popover.Root open={open} onOpenChange={onOpenChange}>
          <Popover.Trigger
            className={cn(
              "inline-flex h-chip max-w-full cursor-pointer items-center rounded-none border px-4 text-label",
              set ? "border-teal bg-teal text-ivory hover:bg-teal-hover" : "border-line bg-ivory text-ink",
            )}
          >
            {set ? (
              <span>
                <bdi dir="ltr">{formatRange(ddmmyyyy(start), ddmmyyyy(end))}</bdi>
                {" · "}
                {formatPlural(journeyCopy.dates.nights, nights, locale)}
              </span>
            ) : (
              labels.empty
            )}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="start"
              sideOffset={8}
              collisionPadding={16}
              style={{ maxWidth: "var(--radix-popover-content-available-width)" }}
              className={cn("z-45 outline-none", desktop ? "w-auto" : "w-menu")}
            >
              <DateRangePanel
                value={draft}
                onChange={pick}
                onClear={clearDraft}
                onDone={() => setOpen(false)}
                months={desktop ? 2 : 1}
                locale={locale}
                copy={journeyCopy}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {set ? (
          <button
            type="button"
            aria-label={labels.clear}
            onClick={() => onChange({ from: "", to: "" })}
            className="inline-flex size-chip shrink-0 cursor-pointer items-center justify-center rounded-none border border-line bg-ivory p-0 text-ink hover:border-teal"
          >
            <CloseIcon size={16} />
          </button>
        ) : null}
      </div>
      {note ? <p className="m-0 text-caption text-muted">{note}</p> : null}
    </div>
  );
}

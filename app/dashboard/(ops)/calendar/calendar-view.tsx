"use client";

import { useId, useMemo, useState } from "react";
import { CalendarDate, getDayOfWeek, parseDate } from "@internationalized/date";
import { EditPanel } from "../../../../components/ops/edit-panel";
import type { Block, IsoDay, Locale3 } from "../../../../components/ops/api-types";
import { AlertCircleIcon, ChevronIcon } from "../../../../components/icons/icons";
import { Button } from "../../../../components/ui/button";
import { formatDate } from "../../../../components/ui/calendar";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Select } from "../../../../components/ui/select";
import { cn } from "../../../../lib/cn";
import { OPS_CALENDAR_COPY, monthTitle } from "../../../../lib/copy/ops-calendar";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import { BlockForm, type CalendarPlace, type CalendarStay } from "./block-form-fields";
import { blockCoversDay, type BlockFormValues, type BlockPayload } from "./block-form";

// The Calendar as the owner sees it, drawn from props only: no fetch, no clock, no cookie. The screen
// (calendar-screen.tsx) owns the data and the handlers; the harness scene (tests/journey/scenes/ops-calendar.tsx)
// feeds it bracket data for the pictures. Days are Dubai days, `YYYY-MM-DD` strings: a block covers a day when
// starts_on <= day <= ends_on, both inclusive, compared as text.

export type { CalendarPlace, CalendarStay };
export type { BlockFormValues };

/** The filter above the grid: "all", `destination:<id>` or `stay:<id>`. */
export const FILTER_ALL = "all";

export type BlockPanelState = {
  initial: BlockFormValues;
  busy: boolean;
  /** The sentence of the last failed Block, or null. */
  error: string | null;
};

export type CalendarViewProps = {
  locale: Locale3;
  /** Today in Dubai. */
  today: IsoDay;
  year: number;
  /** 1 to 12. */
  month: number;
  onMonthChange: (delta: -1 | 1) => void;
  /** The blocks of the shown month and filter. */
  blocks: Block[];
  destinations: CalendarPlace[];
  stays: CalendarStay[];
  filter: string;
  onFilterChange: (value: string) => void;
  /** A failed load or delete, said in words, or null. */
  error: string | null;
  /** The overlap sentence after a Block, or null. */
  notice: string | null;
  onDismissNotice: () => void;
  /** The header button (no day) and a click on a day. */
  onOpenBlock: (day: IsoDay | null) => void;
  panel: BlockPanelState | null;
  onSubmitBlock: (payload: BlockPayload) => void;
  onClosePanel: () => void;
  /** The block waiting for the answer to "Delete this block?". */
  deleting: Block | null;
  onAskDelete: (block: Block) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

const pad = (value: number) => String(value).padStart(2, "0");
const isoOf = (year: number, month: number, day: number): IsoDay => `${year}-${pad(month)}-${pad(day)}`;

/** DD/MM/YYYY, left to right whatever the page direction. */
function Dmy({ day }: { day: IsoDay }) {
  return <bdi dir="ltr">{formatDate(parseDate(day))}</bdi>;
}

function DayRange({ block }: { block: Block }) {
  if (block.starts_on === block.ends_on) return <Dmy day={block.starts_on} />;
  return (
    <bdi dir="ltr">
      <Dmy day={block.starts_on} /> – <Dmy day={block.ends_on} />
    </bdi>
  );
}

function plainRange(block: Block): string {
  const start = formatDate(parseDate(block.starts_on));
  return block.starts_on === block.ends_on ? start : `${start} – ${formatDate(parseDate(block.ends_on))}`;
}

export function CalendarView(props: CalendarViewProps) {
  const { locale, today, year, month, blocks, destinations, stays } = props;
  const copy = OPS_CALENDAR_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";

  const targetName = (block: Block): string => {
    if (block.scope === "all") return copy.all;
    if (block.scope === "destination") return destinations.find((one) => one.id === block.destination_id)?.name ?? "";
    return stays.find((one) => one.id === block.stay_id)?.name ?? "";
  };

  const cells = useMemo(() => {
    const first = new CalendarDate(year, month, 1);
    const lead = getDayOfWeek(first, "en-GB");
    const count = first.calendar.getDaysInMonth(first);
    const days: Array<IsoDay | null> = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= count; day += 1) days.push(isoOf(year, month, day));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  const filterOptions = useMemo(
    () => [
      { value: FILTER_ALL, label: copy.allTargets },
      ...destinations.map((one) => ({ value: `destination:${one.id}`, label: one.name })),
      ...stays.map((one) => ({ value: `stay:${one.id}`, label: one.name })),
    ],
    [copy.allTargets, destinations, stays],
  );

  const headingId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
        <Button onClick={() => props.onOpenBlock(null)}>{copy.blockDates}</Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Select
          value={props.filter}
          options={filterOptions}
          onChange={props.onFilterChange}
          label={copy.filterLabel}
          dir={dir}
          className="w-full max-w-96"
        />
      </div>

      {props.error ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-label text-error">
          <AlertCircleIcon size={20} className="shrink-0" />
          <span>{props.error}</span>
        </p>
      ) : null}

      {props.notice ? (
        <div role="status" className="flex items-start gap-3 border border-warning bg-surface p-4">
          <AlertCircleIcon size={20} className="mt-0.5 shrink-0 text-warning" />
          <p className="m-0 min-w-0 flex-1 text-body text-pretty text-ink">{props.notice}</p>
          <Button variant="secondary" onClick={props.onDismissNotice}>
            {kit.close}
          </Button>
        </div>
      ) : null}

      <section className="flex min-w-0 flex-col gap-2" aria-label={monthTitle(locale, year, month)}>
        <div className="flex min-h-control items-center justify-between">
          <button
            type="button"
            className="inline-flex size-control shrink-0 cursor-pointer items-center justify-center rounded-none border-0 bg-transparent p-0 text-ink"
            aria-label={copy.previousMonth}
            onClick={() => props.onMonthChange(-1)}
          >
            <ChevronIcon size={20} className="-scale-x-100 rtl:scale-x-100" />
          </button>
          <p className="m-0 flex-1 text-center font-body text-body tabular-nums text-teal">{monthTitle(locale, year, month)}</p>
          <button
            type="button"
            className="inline-flex size-control shrink-0 cursor-pointer items-center justify-center rounded-none border-0 bg-transparent p-0 text-ink"
            aria-label={copy.nextMonth}
            onClick={() => props.onMonthChange(1)}
          >
            <ChevronIcon size={20} className="rtl:-scale-x-100" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center font-body text-label text-muted md:gap-2" aria-hidden="true">
          {copy.weekdays.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div role="group" aria-label={copy.monthGrid} className="grid grid-cols-7 gap-1 md:gap-2">
          {cells.map((day, index) => {
            if (!day) return <span key={`pad-${index}`} aria-hidden="true" />;
            const here = blocks.filter((block) => blockCoversDay(block, day));
            const blocked = here.length > 0;
            const past = day < today;
            const number = Number(day.slice(8));
            const named = here.map(targetName);
            return (
              <button
                key={day}
                type="button"
                disabled={past}
                aria-current={day === today ? "date" : undefined}
                aria-label={blocked ? `${formatDate(parseDate(day))}, ${copy.blockedDay}` : formatDate(parseDate(day))}
                onClick={() => props.onOpenBlock(day)}
                className={cn(
                  "relative flex min-h-control w-full cursor-pointer flex-col items-center justify-start gap-1 rounded-none border p-1 font-body text-ink md:min-h-24 md:items-start md:p-2",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
                  blocked ? "border-teal bg-teal-tint shadow-rule-primary" : "border-ink bg-surface hover:bg-ivory",
                  past && "cursor-default border-line text-muted hover:bg-surface",
                )}
              >
                <span className="flex items-center gap-1 text-label tabular-nums">
                  {number}
                  {day === today ? <span className="size-1 bg-ink" aria-hidden="true" /> : null}
                </span>
                {named.slice(0, 2).map((name, at) => (
                  <span key={at} className="hidden w-full truncate text-start text-caption text-teal md:block">
                    {name}
                  </span>
                ))}
                {named.length > 2 ? (
                  <span className="hidden text-caption text-muted md:block">+{named.length - 2}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="m-0 flex items-center gap-2 text-label text-muted">
          <span className="inline-block size-4 border border-teal bg-teal-tint shadow-rule-primary" aria-hidden="true" />
          {copy.blockedDay}
        </p>
      </section>

      <section className="flex min-w-0 flex-col gap-2" aria-labelledby={headingId}>
        <h2 id={headingId} className="m-0 font-display text-title font-normal text-teal">
          {copy.blockedDates}
        </h2>
        <p className="m-0 text-label text-muted">{copy.changeHint}</p>
        {blocks.length === 0 ? (
          <p className="m-0 border-t border-line pt-4 text-body text-ink">{copy.noBlocks}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col border-t border-line p-0">
            {blocks.map((block) => (
              <li
                key={block.id}
                className="grid gap-2 border-b border-line py-3 md:grid-cols-4 md:items-center md:gap-4"
              >
                <span className="min-w-0 text-body text-ink">{targetName(block)}</span>
                <span className="text-label tabular-nums text-ink">
                  <DayRange block={block} />
                </span>
                <span className="min-w-0 text-label text-pretty text-muted">{block.reason ?? ""}</span>
                <Button
                  variant="danger"
                  className="md:justify-self-end"
                  aria-label={copy.deleteNamed.replace("{name}", targetName(block)).replace("{dates}", plainRange(block))}
                  onClick={() => props.onAskDelete(block)}
                >
                  {kit.delete}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {props.panel ? <BlockPanel key="block-panel" {...props} panel={props.panel} /> : null}

      <ConfirmDialog
        open={props.deleting !== null}
        onOpenChange={(open) => {
          if (!open) props.onCancelDelete();
        }}
        title={copy.deleteTitle}
        description={copy.deleteBody}
        confirmLabel={kit.delete}
        cancelLabel={kit.cancel}
        onConfirm={props.onConfirmDelete}
      />
    </div>
  );
}

/**
 * The interim mount of the form: the kit's current edit panel. The owner is choosing the redesigned panel (03.2-06,
 * options A, B, C); when it exists, this is the one place that changes. The fields and logic are BlockForm.
 */
function BlockPanel({ panel, ...props }: CalendarViewProps & { panel: BlockPanelState }) {
  const copy = OPS_CALENDAR_COPY[props.locale];
  const [dirty, setDirty] = useState(false);
  return (
    <EditPanel
      open
      onOpenChange={(open) => {
        if (!open) props.onClosePanel();
      }}
      title={copy.blockDates}
      tabs={[{ key: "form", label: copy.blockDates }]}
      tab="form"
      onTabChange={() => undefined}
      dirty={dirty}
      footer={null}
    >
      <BlockForm
        locale={props.locale}
        today={props.today}
        destinations={props.destinations}
        stays={props.stays}
        initial={panel.initial}
        busy={panel.busy}
        error={panel.error}
        onSubmit={props.onSubmitBlock}
        onDirtyChange={setDirty}
      />
    </EditPanel>
  );
}

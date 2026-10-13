"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { CalendarDate, getDayOfWeek, parseDate } from "@internationalized/date";
import { DateRangeField } from "../../../../components/ops/date-range-field";
import { EditPanel } from "../../../../components/ops/edit-panel";
import type { Block, BlockScope, IsoDay, Locale3 } from "../../../../components/ops/api-types";
import { AlertCircleIcon, ChevronIcon } from "../../../../components/icons/icons";
import { Button } from "../../../../components/ui/button";
import { formatDate } from "../../../../components/ui/calendar";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Field } from "../../../../components/ui/field";
import { Select } from "../../../../components/ui/select";
import { ToggleCardGroup } from "../../../../components/ui/toggle-card";
import { cn } from "../../../../lib/cn";
import { OPS_CALENDAR_COPY, monthTitle } from "../../../../lib/copy/ops-calendar";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";

// The Calendar as the owner sees it, drawn from props only: no fetch, no clock, no cookie. The screen
// (calendar-screen.tsx) owns the data and the handlers; the harness scene (tests/journey/scenes/ops-calendar.tsx)
// feeds it bracket data for the pictures. Days are Dubai days, `YYYY-MM-DD` strings: a block covers a day when
// starts_on <= day <= ends_on, both inclusive, compared as text.

export type CalendarPlace = { id: string; name: string };
export type CalendarStay = CalendarPlace & { destinationId: string };

/** The filter above the grid: "all", `destination:<id>` or `stay:<id>`. */
export const FILTER_ALL = "all";

export type BlockFormValues = {
  scope: BlockScope;
  destinationId: string | null;
  stayId: string | null;
  first: IsoDay | null;
  last: IsoDay | null;
  reason: string;
};

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
  /** The overlap sentence after a Block, or null. */
  notice: string | null;
  onDismissNotice: () => void;
  /** The header button (no day) and a click on a day. */
  onOpenBlock: (day: IsoDay | null) => void;
  panel: BlockPanelState | null;
  onSubmitBlock: (values: BlockFormValues) => void;
  onClosePanel: () => void;
  /** The block waiting for the answer to "Delete this block?". */
  deleting: Block | null;
  onAskDelete: (block: Block) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

const pad = (value: number) => String(value).padStart(2, "0");
const isoOf = (year: number, month: number, day: number): IsoDay => `${year}-${pad(month)}-${pad(day)}`;

function coversDay(block: Block, day: IsoDay): boolean {
  return block.starts_on <= day && day <= block.ends_on;
}

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
            const here = blocks.filter((block) => coversDay(block, day));
            const blocked = here.length > 0;
            const past = day < today;
            const number = Number(day.slice(8));
            const named = here.map(targetName);
            return (
              <button
                key={day}
                type="button"
                disabled={past}
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

function Labelled({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid max-w-96 gap-2">
      <span id={id} className="text-label text-ink">
        {label}
      </span>
      {children}
    </div>
  );
}

/** The Block dates form: the signed edit panel (side panel from 768, full-screen sheet below) with the form state inside. */
function BlockPanel({ panel, ...props }: CalendarViewProps & { panel: BlockPanelState }) {
  const { locale, today, destinations, stays } = props;
  const copy = OPS_CALENDAR_COPY[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const ids = useId();
  const [values, setValues] = useState<BlockFormValues>(panel.initial);
  const [missing, setMissing] = useState<string | null>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(panel.initial);

  function change(next: Partial<BlockFormValues>) {
    setMissing(null);
    setValues((old) => ({ ...old, ...next }));
  }

  function submit() {
    if (values.scope === "destination" && !values.destinationId) return setMissing(copy.needDestination);
    if (values.scope === "stay" && !values.stayId) return setMissing(copy.needStay);
    if (!values.first || !values.last) return setMissing(copy.needDates);
    setMissing(null);
    props.onSubmitBlock(values);
  }

  const message = missing ?? panel.error;

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
      footer={
        <div className="flex flex-col gap-2">
          {message ? (
            <p role="alert" className="m-0 flex items-center gap-2 text-label text-error">
              <AlertCircleIcon size={20} className="shrink-0" />
              <span>{message}</span>
            </p>
          ) : null}
          <Button busy={panel.busy} onClick={submit}>
            {copy.block}
          </Button>
        </div>
      }
    >
      <p className="m-0 text-body text-pretty text-ink">{copy.blockedNote}</p>

      <div className="grid gap-2">
        <span id={`${ids}-scope`} className="text-label text-ink">
          {copy.whatToBlock}
        </span>
        <ToggleCardGroup
          labelId={`${ids}-scope`}
          value={values.scope}
          onChange={(scope) => change({ scope: scope as BlockScope })}
          options={[
            { value: "all", title: copy.everything, detail: copy.everythingDetail },
            { value: "destination", title: copy.oneDestination, detail: copy.oneDestinationDetail },
            { value: "stay", title: copy.oneStay },
          ]}
        />
      </div>

      {values.scope === "destination" ? (
        <Labelled id={`${ids}-destination`} label={copy.destinations}>
          <Select
            value={values.destinationId}
            options={destinations.map((one) => ({ value: one.id, label: one.name }))}
            onChange={(destinationId) => change({ destinationId })}
            label={`${copy.destinations}: {name}`}
            placeholder={copy.chooseDestination}
            dir={dir}
            className="w-full"
          />
        </Labelled>
      ) : null}
      {values.scope === "stay" ? (
        <Labelled id={`${ids}-stay`} label={copy.stays}>
          <Select
            value={values.stayId}
            options={stays.map((one) => ({ value: one.id, label: one.name }))}
            onChange={(stayId) => change({ stayId })}
            label={`${copy.stays}: {name}`}
            placeholder={copy.chooseStay}
            dir={dir}
            className="w-full"
          />
        </Labelled>
      ) : null}

      <DateRangeField
        id={`${ids}-dates`}
        label={copy.dates}
        hint={copy.sameDayHint}
        value={{ first: values.first, last: values.last }}
        onChange={({ first, last }) => change({ first, last })}
        min={today}
      />

      <Field
        id={`${ids}-reason`}
        label={copy.reasonOptional}
        name="reason"
        maxLength={300}
        value={values.reason}
        onChange={(event) => change({ reason: event.target.value })}
        className="max-w-none"
      />
    </EditPanel>
  );
}

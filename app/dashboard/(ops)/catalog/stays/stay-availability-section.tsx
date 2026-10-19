"use client";

// Plan 03.2-15: the Availability card of the stay editor (kit EditPage, option B). DRAFT for the picture gate.
// Read only: the month of this stay's blocked days (its own, its destination's and everything blocks, C-13 / D-87) with
// their reasons, and a link to the Calendar's block form with this stay chosen (03.2-13). Booked days arrive with Phase 4.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { opsFetch } from "../../../../../components/ops/ops-client";
import type { Block, BlocksView, IsoDay, Locale3 } from "../../../../../components/ops/api-types";
import { Button } from "../../../../../components/ui/button";
import { cn } from "../../../../../lib/cn";
import { addDays, daysBetween, dubaiToday } from "../../../../../lib/money/dates";
import { OPS_STAY_TABS_COPY } from "../../../../../lib/copy/ops-stay-tabs";
import { blockedDays, calendarBlockHref, monthWindow } from "./rates-forms";
import { showDay } from "./stay-rates-section";

type Month = { year: number; month: number };

function thisMonth(): Month {
  const today = dubaiToday(new Date());
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

function step(at: Month, by: 1 | -1): Month {
  const month = at.month + by;
  if (month === 0) return { year: at.year - 1, month: 12 };
  if (month === 13) return { year: at.year + 1, month: 1 };
  return { year: at.year, month };
}

/** "October 2026" in the dashboard's language, with Western digits (the dashboard writes numbers in Latin). */
function monthTitle(locale: Locale3, from: IsoDay): string {
  const tag = locale === "ar" ? "ar-u-nu-latn" : locale;
  return new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${from}T00:00:00Z`));
}

/** Monday-first column of a day: 0 for Monday, 6 for Sunday. */
function mondayIndex(day: IsoDay): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function StayAvailabilitySection({ stayId, locale }: { stayId: string; locale: Locale3 }) {
  const copy = OPS_STAY_TABS_COPY[locale];
  const pathname = usePathname() ?? "/dashboard";
  const [month, setMonth] = useState<Month>(thisMonth);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { from, to } = monthWindow(month.year, month.month);

  // The month last asked for. Two quick month clicks send two reads; an older month's reply that comes back last is
  // dropped, so it never draws its blocks over the month on screen (PR #23 review).
  const asked = useRef("");

  const load = useCallback(async () => {
    const key = `${stayId} ${from} ${to}`;
    asked.current = key;
    setLoadError(false);
    setBlocks(null);
    const reply = await opsFetch<BlocksView>("/api/ops/blocks", { from, to, stay_id: stayId });
    if (asked.current !== key) return;
    if (!reply.ok) setLoadError(true);
    else setBlocks(reply.blocks);
  }, [from, to, stayId]);

  useEffect(() => {
    void load();
  }, [load]);

  const days: IsoDay[] = [];
  for (let n = 0; n <= daysBetween(from, to); n += 1) days.push(addDays(from, n));
  // Monday-first weeks of the month: blanks before the 1st and after the last day.
  const cells: Array<IsoDay | null> = [...Array.from({ length: mondayIndex(from) }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, n) => cells.slice(n * 7, n * 7 + 7));
  const blocked = blocks ? blockedDays(blocks, month.year, month.month) : new Map<IsoDay, Block[]>();
  const shown = blocks ? blocks.filter((block) => block.starts_on <= to && block.ends_on >= from) : [];

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-label text-ink">{copy.availability.intro}</p>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" aria-label={copy.availability.previousMonth} onClick={() => setMonth((at) => step(at, -1))}>
          <span aria-hidden="true" className="rtl:-scale-x-100">
            ‹
          </span>
        </Button>
        <h3 className="m-0 font-display text-body font-normal text-ink" aria-live="polite">
          {monthTitle(locale, from)}
        </h3>
        <Button variant="ghost" aria-label={copy.availability.nextMonth} onClick={() => setMonth((at) => step(at, 1))}>
          <span aria-hidden="true" className="rtl:-scale-x-100">
            ›
          </span>
        </Button>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1" data-month-grid>
        <caption className="sr-only">{monthTitle(locale, from)}</caption>
        <thead>
          <tr>
            {copy.availability.weekdays.map((name) => (
              <th key={name} scope="col" className="py-1 text-center text-label font-normal text-muted">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, row) => (
            <tr key={row}>
              {week.map((day, col) =>
                day === null ? (
                  <td key={`blank-${col}`} />
                ) : (
                  <td
                    key={day}
                    data-blocked={blocked.has(day) || undefined}
                    className={cn(
                      "h-control border text-center text-label tabular-nums",
                      blocked.has(day) ? "border-ink bg-line text-ink line-through" : "border-line text-ink",
                    )}
                  >
                    <bdi dir="ltr">{Number(day.slice(8, 10))}</bdi>
                    {blocked.has(day) ? <span className="sr-only"> {copy.availability.blocked}</span> : null}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="m-0 flex items-center gap-2 text-label text-ink">
        <span aria-hidden="true" className="inline-block size-4 border border-ink bg-line" />
        {copy.availability.blocked}
      </p>

      {loadError ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="m-0 text-label text-error">
            {copy.loadFailed}
          </p>
          <Button variant="secondary" onClick={() => void load()}>
            {copy.retry}
          </Button>
        </div>
      ) : blocks === null ? (
        <p className="m-0 text-label text-muted">{copy.loading}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 font-display text-body font-normal text-ink">{copy.availability.reasonsTitle}</h3>
          {shown.length === 0 ? (
            <p className="m-0 text-label text-muted">{copy.availability.noBlocks}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0" data-block-reasons>
              {shown.map((block) => (
                <li key={block.id} className="flex flex-col gap-1 border-b border-line pb-2 text-label">
                  <span className="text-ink">
                    <bdi dir="ltr">
                      {block.starts_on === block.ends_on ? showDay(block.starts_on) : `${showDay(block.starts_on)} – ${showDay(block.ends_on)}`}
                    </bdi>
                    {" · "}
                    {copy.availability.scope[block.scope]}
                  </span>
                  <span className={block.reason ? "text-ink" : "text-muted"}>{block.reason ?? copy.availability.noReason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <a
        href={calendarBlockHref(pathname, stayId)}
        className="inline-flex min-h-control items-center self-start text-label text-teal underline decoration-gold decoration-1 underline-offset-4 hover:no-underline"
      >
        {copy.availability.blockDates}
      </a>
    </div>
  );
}

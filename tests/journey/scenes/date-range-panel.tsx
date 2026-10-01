"use client";

import { useState } from "react";
import { CalendarDate } from "@internationalized/date";
import { DateRangePanel, type DateRangeValue } from "../../../components/journey/date-range-panel";
import type { Scenes, SceneContext } from "../scene-types";

// Fixed "today" keeps every state deterministic (2026-09-29).
const TODAY = new CalendarDate(2026, 9, 29);

function Live({
  ctx,
  initial,
  months,
  size,
}: {
  ctx: SceneContext;
  initial: DateRangeValue;
  months: 1 | 2;
  size?: "md" | "phone";
}) {
  const [value, setValue] = useState<DateRangeValue>(initial);
  return (
    <div data-testid="harness-panel">
      <DateRangePanel
        value={value}
        onChange={setValue}
        onDone={() => undefined}
        onClear={() => setValue({ start: null, end: null })}
        locale={ctx.locale}
        copy={ctx.copy}
        months={months}
        size={size}
        today={TODAY}
      />
    </div>
  );
}

const empty: DateRangeValue = { start: null, end: null };

export const scenes: Scenes = {
  empty: (ctx) => <Live ctx={ctx} initial={empty} months={2} />,
  "arrival-only": (ctx) => (
    <Live ctx={ctx} initial={{ start: ctx.fixtures.dates.start, end: null }} months={2} />
  ),
  range: (ctx) => (
    <Live ctx={ctx} initial={{ start: ctx.fixtures.dates.start, end: ctx.fixtures.dates.end }} months={2} />
  ),
  "past-days": (ctx) => <Live ctx={ctx} initial={empty} months={1} />,
  "two-months": (ctx) => <Live ctx={ctx} initial={empty} months={2} />,
  "one-month": (ctx) => <Live ctx={ctx} initial={empty} months={1} size="phone" />,
};

"use client";

// Scenes for the 03.3-02 extensions of JourneyBar. Kept out of tests/journey/matrix.ts on purpose:
// the matrix reads every state of journey-bar.tsx into the visual baselines, and these states have
// none. Behaviour is proven in tests/ui/extensions.spec.ts.

import { useState } from "react";
import { CalendarDate } from "@internationalized/date";
import { JourneyBar } from "../../../components/journey/journey-bar";
import type { JourneyValue } from "../../../components/journey/types";
import type { Scenes, SceneContext } from "../scene-types";

const TODAY = new CalendarDate(2026, 9, 29);
const BLOCKED = [new CalendarDate(2026, 10, 20), new CalendarDate(2026, 10, 21)];

type Opts = {
  initial: JourneyValue;
  search?: boolean;
  lockDestination?: boolean;
  lockStay?: boolean;
};

function Live({ ctx, o }: { ctx: SceneContext; o: Opts }) {
  const [value, setValue] = useState(o.initial);
  const [changes, setChanges] = useState(0);
  const [searches, setSearches] = useState(0);
  return (
    <div data-testid="harness-bar" className="mx-auto w-full max-w-column px-6 pb-16">
      <JourneyBar
        size="hero"
        destinations={ctx.fixtures.destinations}
        value={value}
        onChange={(next) => {
          setValue(next);
          setChanges((n) => n + 1);
        }}
        onSearch={o.search ? () => setSearches((n) => n + 1) : undefined}
        copy={ctx.copy}
        locale={ctx.locale}
        today={TODAY}
        lockDestination={o.lockDestination}
        lockStay={o.lockStay ? { label: "[Stay]", value: "[Stay name]" } : undefined}
        blockedDates={o.lockDestination ? BLOCKED : undefined}
      />
      <output data-testid="changes">{changes}</output>
      <output data-testid="searches">{searches}</output>
    </div>
  );
}

const empty = (ctx: SceneContext): JourneyValue => ({ ...ctx.fixtures.emptyJourney, adults: 1 });

export const scenes: Scenes = {
  // Hero bar, no onSearch: no submit control of any kind.
  "no-search": (ctx) => <Live ctx={ctx} o={{ initial: empty(ctx) }} />,
  // With onSearch: today's behaviour, a search form with a Search button.
  "with-search": (ctx) => <Live ctx={ctx} o={{ initial: empty(ctx), search: true }} />,
  // The private-stay bar: Destination and Stay locked, blocked days, no submit.
  "stay-locked": (ctx) => (
    <Live
      ctx={ctx}
      o={{
        initial: { ...empty(ctx), destinationId: "cartagena" },
        lockDestination: true,
        lockStay: true,
      }}
    />
  ),
};

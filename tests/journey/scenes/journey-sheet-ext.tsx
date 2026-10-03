"use client";

// Scenes for the 03.3-02 extensions of JourneySheet and JourneyEntry. Not in the visual matrix on
// purpose (see journey-bar-ext.tsx).

import { useState } from "react";
import { CalendarDate } from "@internationalized/date";
import { JourneyEntry, JourneySheet, type SheetStep } from "../../../components/journey/journey-sheet";
import type { JourneyValue } from "../../../components/journey/types";
import type { Scenes, SceneContext } from "../scene-types";

const TODAY = new CalendarDate(2026, 9, 29);
const BLOCKED = [new CalendarDate(2026, 10, 20), new CalendarDate(2026, 10, 21)];

type Opts = {
  initial: JourneyValue;
  variant?: "entry" | "stay";
  search?: boolean;
  lockDestination?: boolean;
};

function Live({ ctx, o }: { ctx: SceneContext; o: Opts }) {
  const [value, setValue] = useState(o.initial);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<SheetStep>(1);
  const [searches, setSearches] = useState(0);
  return (
    <div data-testid="harness-sheet" className="w-full">
      <div className="pt-16">
        <JourneyEntry
          variant={o.variant ?? "entry"}
          value={value}
          destinations={ctx.fixtures.destinations}
          onOpen={(next) => {
            setStep(next);
            setOpen(true);
          }}
          copy={ctx.copy}
          locale={ctx.locale}
          stayLine="[Cartagena, Stay name]"
        />
      </div>
      <JourneySheet
        open={open}
        onOpenChange={setOpen}
        initialStep={step}
        destinations={ctx.fixtures.destinations}
        value={value}
        onChange={setValue}
        onSearch={
          o.search
            ? () => {
                setSearches((n) => n + 1);
                setOpen(false);
              }
            : undefined
        }
        copy={ctx.copy}
        locale={ctx.locale}
        today={TODAY}
        lockDestination={o.lockDestination}
        blockedDates={o.lockDestination ? BLOCKED : undefined}
      />
      <output data-testid="searches">{searches}</output>
    </div>
  );
}

const empty = (ctx: SceneContext): JourneyValue => ({ ...ctx.fixtures.emptyJourney, adults: 1 });

export const scenes: Scenes = {
  // The sheet with no onSearch: the last step ends in Done.
  "no-search": (ctx) => <Live ctx={ctx} o={{ initial: empty(ctx) }} />,
  // With onSearch: today's Search on the last step.
  "with-search": (ctx) => <Live ctx={ctx} o={{ initial: empty(ctx), search: true }} />,
  // The private-stay collapsed row, destination locked (the sheet starts at When).
  "entry-stay": (ctx) => (
    <Live
      ctx={ctx}
      o={{
        initial: { ...empty(ctx), destinationId: "cartagena" },
        variant: "stay",
        lockDestination: true,
      }}
    />
  ),
};

"use client";

import { useState } from "react";
import { CalendarDate } from "@internationalized/date";
import { JourneyEntry, JourneySheet, type SheetStep } from "../../../components/journey/journey-sheet";
import type { JourneyValue } from "../../../components/journey/types";
import type { Scenes, SceneContext } from "../scene-types";

const TODAY = new CalendarDate(2026, 9, 29);

const emptyValue: JourneyValue = { destinationId: null, start: null, end: null, adults: 2, children: 0, infants: 0 };

type Opts = {
  initial: JourneyValue;
  variant?: "entry" | "docked";
  open?: boolean;
  step?: SheetStep;
  warn?: "where" | "when";
};

function Live({ ctx, o }: { ctx: SceneContext; o: Opts }) {
  const [value, setValue] = useState(o.initial);
  const [open, setOpen] = useState(Boolean(o.open));
  const [step, setStep] = useState<SheetStep>(o.step ?? 1);
  const [calls, setCalls] = useState<JourneyValue[]>([]);
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
        />
      </div>
      <JourneySheet
        open={open}
        onOpenChange={setOpen}
        initialStep={step}
        destinations={ctx.fixtures.destinations}
        value={value}
        onChange={setValue}
        onSearch={(v) => {
          setCalls((c) => [...c, v]);
          setOpen(false);
        }}
        copy={ctx.copy}
        locale={ctx.locale}
        today={TODAY}
        initialWarn={o.warn}
      />
      <output data-testid="search-calls" className="sr-only">
        {calls.length}
        {calls.length > 0 ? ` ${calls[calls.length - 1].destinationId}` : ""}
      </output>
    </div>
  );
}

const live = (o: (ctx: SceneContext) => Opts) =>
  function Scene(ctx: SceneContext) {
    return <Live ctx={ctx} o={o(ctx)} />;
  };

export const scenes: Scenes = {
  "entry-empty": live(() => ({ initial: emptyValue })),
  "entry-filled": live((ctx) => ({ initial: ctx.fixtures.filledJourney })),
  "docked-empty": live(() => ({ initial: emptyValue, variant: "docked" })),
  "docked-filled": live((ctx) => ({ initial: ctx.fixtures.filledJourney, variant: "docked" })),
  "docked-partial": live(() => ({ initial: { ...emptyValue, destinationId: "cartagena" }, variant: "docked" })),
  "step-1": live(() => ({ initial: emptyValue, open: true, step: 1 })),
  "step-1-warn": live(() => ({ initial: emptyValue, open: true, step: 1, warn: "where" })),
  "step-2": live(() => ({ initial: { ...emptyValue, destinationId: "cartagena" }, open: true, step: 2 })),
  "step-2-warn": live(() => ({
    initial: { ...emptyValue, destinationId: "cartagena" },
    open: true,
    step: 2,
    warn: "when",
  })),
  "step-3": live((ctx) => ({ initial: ctx.fixtures.filledJourney, open: true, step: 3 })),
  "step-3-complete": live((ctx) => ({
    initial: { ...ctx.fixtures.filledJourney, ...ctx.fixtures.guestsFamily },
    open: true,
    step: 3,
  })),
  "step-3-incomplete": live(() => ({ initial: emptyValue, open: true, step: 3 })),
};

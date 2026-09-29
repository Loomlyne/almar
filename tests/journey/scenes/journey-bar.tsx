"use client";

import { useRef, useState, type ReactNode } from "react";
import { CalendarDate } from "@internationalized/date";
import { JourneyBar, type JourneyPanel } from "../../../components/journey/journey-bar";
import type { JourneyValue } from "../../../components/journey/types";
import type { Scenes, SceneContext } from "../scene-types";

const TODAY = new CalendarDate(2026, 9, 29);

type Opts = {
  initial: JourneyValue;
  size?: "hero" | "docked" | "summary";
  initialOpen?: JourneyPanel | null;
  forceMissing?: string[];
  lockDestination?: boolean;
  blockedDates?: CalendarDate[];
};

function Live({ ctx, o }: { ctx: SceneContext; o: Opts }) {
  const [value, setValue] = useState(o.initial);
  const [calls, setCalls] = useState<JourneyValue[]>([]);
  return (
    <div data-testid="harness-bar" className="w-column max-w-full mx-auto px-6 pb-16">
      <JourneyBar
        size={o.size ?? "hero"}
        destinations={ctx.fixtures.destinations}
        value={value}
        onChange={setValue}
        onSearch={(v) => setCalls((c) => [...c, v])}
        copy={ctx.copy}
        locale={ctx.locale}
        today={TODAY}
        initialOpen={o.initialOpen}
        forceMissing={o.forceMissing}
        lockDestination={o.lockDestination}
        blockedDates={o.blockedDates}
      />
      <output data-testid="search-calls" className="sr-only">
        {calls.length}
        {calls.length > 0 ? ` ${calls[calls.length - 1].destinationId}` : ""}
      </output>
    </div>
  );
}

function Scrolling({ ctx }: { ctx: SceneContext }): ReactNode {
  const [value, setValue] = useState(ctx.fixtures.filledJourney);
  const sentinel = useRef<HTMLDivElement>(null);
  const shared = {
    destinations: ctx.fixtures.destinations,
    value,
    onChange: setValue,
    onSearch: () => undefined,
    copy: ctx.copy,
    locale: ctx.locale,
    today: TODAY,
  };
  return (
    <div className="w-column max-w-full mx-auto px-6">
      <div className="sticky top-0 z-40 bg-ivory min-h-bar-docked">
        <JourneyBar size="docked" sentinelRef={sentinel} {...shared} />
      </div>
      <div ref={sentinel} data-testid="hero-sentinel" className="pt-16">
        <JourneyBar size="hero" {...shared} />
      </div>
      <div className="h-screen" />
      <div className="h-screen" />
    </div>
  );
}

const live = (o: Opts) =>
  function Scene(ctx: SceneContext) {
    return <Live ctx={ctx} o={o} />;
  };

const empty = { initial: emptyJourneyOf() };
function emptyJourneyOf(): JourneyValue {
  return { destinationId: null, start: null, end: null, adults: 2, children: 0, infants: 0 };
}

export const scenes: Scenes = {
  empty: live(empty),
  hover: live(empty),
  "open-where": live({ ...empty, initialOpen: "where" }),
  "open-when": live({ ...empty, initialOpen: "when" }),
  "open-guests": live({ ...empty, initialOpen: "guests" }),
  "tablet-open-when": live({ ...empty, initialOpen: "when" }),
  missing: live({ ...empty, forceMissing: ["where", "when"] }),
  destination: (ctx) => (
    <Live ctx={ctx} o={{ initial: { ...emptyJourneyOf(), destinationId: "cartagena" } }} />
  ),
  filled: (ctx) => <Live ctx={ctx} o={{ initial: ctx.fixtures.filledJourney }} />,
  arrival: (ctx) => (
    <Live
      ctx={ctx}
      o={{ initial: { ...ctx.fixtures.filledJourney, end: null } }}
    />
  ),
  docked: (ctx) => <Scrolling ctx={ctx} />,
  "docked-static": (ctx) => <Live ctx={ctx} o={{ initial: ctx.fixtures.filledJourney, size: "docked" }} />,
  summary: (ctx) => <Live ctx={ctx} o={{ initial: ctx.fixtures.filledJourney, size: "summary" }} />,
  stay: (ctx) => (
    <Live
      ctx={ctx}
      o={{
        initial: { ...emptyJourneyOf(), destinationId: "cartagena" },
        lockDestination: true,
        blockedDates: [new CalendarDate(2026, 10, 20), new CalendarDate(2026, 10, 21)],
        initialOpen: "when",
      }}
    />
  ),
};

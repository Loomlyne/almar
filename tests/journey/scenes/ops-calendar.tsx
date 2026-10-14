"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees (job 02). The scene frames every state in the preview shell so the rail and the density match.
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { CalendarView, FILTER_ALL, type BlockPanelState } from "../../../app/dashboard/(ops)/calendar/calendar-view";
import type { CalendarPlace, CalendarStay } from "../../../app/dashboard/(ops)/calendar/block-form-fields";
import { shiftMonth, type BlockFormValues } from "../../../app/dashboard/(ops)/calendar/block-form";
import type { Block, Locale3 } from "../../../components/ops/api-types";
import { overlapLine } from "../../../lib/copy/ops-calendar";
import type { SceneContext, Scenes } from "../scene-types";

/**
 * The Calendar and its Block dates form on bracket data: October 2026 with today fixed at 2026-10-14 (a scene never reads
 * the clock). The API is never called; every handler the view calls is written to a hidden log (`ops-calendar-log`).
 * Test-only.
 */
const TODAY = "2026-10-14";

type Words = { destination: (n: number) => string; stay: (n: number) => string; reason: string };

const WORDS: Record<Locale3, Words> = {
  en: { destination: (n) => `[Destination ${n}]`, stay: (n) => `[Stay ${n}]`, reason: "[Reason]" },
  ar: { destination: (n) => `[الوجهة ${n}]`, stay: (n) => `[الإقامة ${n}]`, reason: "[السبب]" },
  es: { destination: (n) => `[Destino ${n}]`, stay: (n) => `[Estancia ${n}]`, reason: "[Motivo]" },
};

function placesOf(words: Words): { destinations: CalendarPlace[]; stays: CalendarStay[] } {
  return {
    destinations: [
      { id: "d1", name: words.destination(1) },
      { id: "d2", name: words.destination(2) },
    ],
    stays: [
      { id: "s1", name: words.stay(1), destinationId: "d1" },
      { id: "s2", name: words.stay(2), destinationId: "d1" },
      { id: "s3", name: words.stay(3), destinationId: "d2" },
    ],
  };
}

function block(id: string, scope: Block["scope"], target: string | null, from: string, to: string, reason: string | null): Block {
  return {
    id,
    scope,
    destination_id: scope === "destination" ? target : null,
    stay_id: scope === "stay" ? target : null,
    starts_on: from,
    ends_on: to,
    reason,
    created_at: "2026-10-01T08:00:00Z",
  };
}

/** The month, by `starts_on`: one past block, an all-scope block, two that overlap it, a destination and a stay. */
function monthBlocks(words: Words): Block[] {
  return [
    block("b5", "all", null, "2026-10-10", "2026-10-11", null),
    block("b1", "all", null, "2026-10-19", "2026-10-21", words.reason),
    block("b4", "stay", "s1", "2026-10-20", "2026-10-22", null),
    block("b6", "destination", "d2", "2026-10-21", "2026-10-21", null),
    block("b2", "destination", "d1", "2026-10-23", "2026-10-24", null),
    block("b3", "stay", "s2", "2026-10-27", "2026-10-27", words.reason),
  ];
}

/** What the API answers for `?stay_id=s2`: the stay's own blocks, its destination's, and the all-scope ones. */
function blocksFor(filter: string, all: Block[], stays: CalendarStay[]): Block[] {
  if (filter === FILTER_ALL) return all;
  const [kind, id] = filter.split(":");
  if (kind === "destination") return all.filter((one) => one.scope === "all" || one.destination_id === id);
  const stay = stays.find((one) => one.id === id);
  return all.filter(
    (one) => one.scope === "all" || one.stay_id === id || (one.scope === "destination" && one.destination_id === stay?.destinationId),
  );
}

/** The kit reads the almar-locale cookie and the shell does too; the harness picks the language from ?l=, so set it first. */
function Frame({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

type Variant = {
  filter?: string;
  panel?: Partial<BlockFormValues> | null;
  notice?: boolean;
  empty?: boolean;
};

function CalendarScene({ ctx, variant }: { ctx: SceneContext; variant: Variant }) {
  const locale = ctx.locale;
  const words = WORDS[locale];
  const { destinations, stays } = placesOf(words);
  const everything = variant.empty ? [] : monthBlocks(words);

  const [cursor, setCursor] = useState({ year: 2026, month: 10 });
  const [filter, setFilter] = useState(variant.filter ?? FILTER_ALL);
  const [panel, setPanel] = useState<BlockPanelState | null>(
    variant.panel
      ? {
          initial: { scope: "all", destinationId: null, stayId: null, first: null, last: null, reason: "", ...variant.panel },
          busy: false,
          error: null,
        }
      : null,
  );
  const [notice, setNotice] = useState<string | null>(variant.notice ? overlapLine(locale, 2) : null);
  const [deleting, setDeleting] = useState<Block | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const note = (entry: string) => setLog((previous) => [...previous, entry]);

  return (
    <Frame locale={locale}>
      <output data-testid="ops-calendar-log" className="sr-only">
        {log.join(" | ")}
      </output>
      <CalendarView
        locale={locale}
        today={TODAY}
        year={cursor.year}
        month={cursor.month}
        onMonthChange={(delta) => {
          note(`month:${delta}`);
          setCursor((old) => shiftMonth(old.year, old.month, delta));
        }}
        blocks={blocksFor(filter, everything, stays)}
        destinations={destinations}
        stays={stays}
        filter={filter}
        onFilterChange={(next) => {
          note(`filter:${next}`);
          setFilter(next);
        }}
        error={null}
        notice={notice}
        onDismissNotice={() => {
          note("notice:close");
          setNotice(null);
        }}
        onOpenBlock={(day) => {
          note(`open:${day ?? "none"}`);
          setPanel({
            initial: { scope: "all", destinationId: null, stayId: null, first: day, last: day, reason: "" },
            busy: false,
            error: null,
          });
        }}
        panel={panel}
        onSubmitBlock={async (payload) => {
          note(`block:${payload.scope}:${payload.destination_id ?? payload.stay_id ?? "-"}:${payload.starts_on}:${payload.ends_on}:${payload.reason ?? ""}`);
          setPanel(null);
          return true;
        }}
        onClosePanel={() => {
          note("panel:close");
          setPanel(null);
        }}
        deleting={deleting}
        onAskDelete={(one) => {
          note(`delete-ask:${one.id}`);
          setDeleting(one);
        }}
        onConfirmDelete={() => {
          note(`delete:${deleting?.id ?? "-"}`);
          setDeleting(null);
        }}
        onCancelDelete={() => {
          note("delete:cancel");
          setDeleting(null);
        }}
      />
    </Frame>
  );
}

export const scenes: Scenes = {
  month: (ctx) => <CalendarScene ctx={ctx} variant={{}} />,
  "month-filtered": (ctx) => <CalendarScene ctx={ctx} variant={{ filter: "stay:s2" }} />,
  "form-everything": (ctx) => <CalendarScene ctx={ctx} variant={{ panel: {} }} />,
  "form-stay-prefilled": (ctx) => <CalendarScene ctx={ctx} variant={{ panel: { scope: "stay", stayId: "s2" } }} />,
  "form-one-day": (ctx) => <CalendarScene ctx={ctx} variant={{ panel: { first: "2026-10-30", last: "2026-10-30" } }} />,
  "after-overlap": (ctx) => <CalendarScene ctx={ctx} variant={{ notice: true }} />,
  empty: (ctx) => <CalendarScene ctx={ctx} variant={{ empty: true }} />,
};

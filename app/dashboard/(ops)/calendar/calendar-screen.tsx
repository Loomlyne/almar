"use client";

import { useEffect, useRef, useState } from "react";
import { errorText } from "../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import type {
  Block,
  BlockAddResult,
  BlocksView,
  DestinationSummary,
  ListReply,
  StaySummary,
} from "../../../../components/ops/api-types";
import { overlapLine } from "../../../../lib/copy/ops-calendar";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import { dubaiDay, monthWindow, prefillFromQuery, shiftMonth, type BlockFormValues, type BlockPayload } from "./block-form";
import type { CalendarPlace, CalendarStay } from "./block-form-fields";
import { CalendarView, FILTER_ALL, type BlockPanelState } from "./calendar-view";

// Calendar -> Block dates (plan 03.2-13, contract 5.4). This file owns the data: the Dubai day, the month and filter
// the owner is looking at, the blocks of that window from /api/ops/blocks, and the three writes (add, delete, and the
// refetch after each). It draws nothing itself: CalendarView and the form do.

const EMPTY: BlockFormValues = { scope: "all", destinationId: null, stayId: null, first: null, last: null, reason: "" };

type Entry = ReturnType<typeof prefillFromQuery>;

/** `destination:<id>` and `stay:<id>` to the query the blocks endpoint takes; "all" sends neither. */
function filterQuery(filter: string): { destination_id?: string; stay_id?: string } {
  const [kind, id] = filter.split(":");
  if (kind === "destination" && id) return { destination_id: id };
  if (kind === "stay" && id) return { stay_id: id };
  return {};
}

export function CalendarScreen() {
  const locale = useDashboardLocale();
  const kit = OPS_KIT_COPY[locale];

  const [today, setToday] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ year: number; month: number } | null>(null);
  const [filter, setFilter] = useState(FILTER_ALL);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [destinations, setDestinations] = useState<CalendarPlace[]>([]);
  const [stays, setStays] = useState<CalendarStay[]>([]);
  const [listsReady, setListsReady] = useState(false);
  const [reload, setReload] = useState(0);
  // Three errors, each kept until its own read or write succeeds: a later read of something else never hides it. A
  // refused Delete is about the month it was shown on: it also goes when the month changes or a block is added
  // (follow-up 9, PR #17 review round 2).
  const [listsError, setListsError] = useState<string | null>(null);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<BlockPanelState | null>(null);
  const [deleting, setDeleting] = useState<Block | null>(null);
  // The link from a stay or destination page (03.2-15): read once on mount, used once the lists are known.
  const entry = useRef<Entry>(null);
  const latest = useRef(0);

  useEffect(() => {
    const day = dubaiDay(new Date());
    setToday(day);
    setCursor({ year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) });
    entry.current = prefillFromQuery(window.location.search);
  }, []);

  // A tab left open past Dubai midnight: read the day again when the owner comes back to it, so the grid and the
  // picker agree on which days are past. The month shown stays where she left it.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      const day = dubaiDay(new Date());
      setToday((old) => (old === day ? old : day));
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // The pick lists: destinations and stays, by their English names (the dashboard is English).
  useEffect(() => {
    let live = true;
    (async () => {
      const [destinationReply, stayReply] = await Promise.all([
        opsFetch<ListReply<DestinationSummary>>("/api/ops/destinations"),
        opsFetch<ListReply<StaySummary>>("/api/ops/stays"),
      ]);
      if (!live) return;
      if (!destinationReply.ok) return setListsError(errorText(kit, destinationReply.error));
      if (!stayReply.ok) return setListsError(errorText(kit, stayReply.error));
      setListsError(null);
      setDestinations(destinationReply.items.map((one) => ({ id: one.id, name: one.name_en })));
      setStays(stayReply.items.map((one) => ({ id: one.id, name: one.title_en, destinationId: one.destination_id })));
      setListsReady(true);
    })();
    return () => {
      live = false;
    };
  }, [kit]);

  // The blocks of the shown month (both ends inclusive), narrowed by the filter.
  useEffect(() => {
    if (!cursor) return;
    const ticket = (latest.current += 1);
    (async () => {
      const reply = await opsFetch<BlocksView>("/api/ops/blocks", { ...monthWindow(cursor.year, cursor.month), ...filterQuery(filter) });
      if (ticket !== latest.current) return;
      if (!reply.ok) {
        // Never the last month's blocks under this month's title: the grid shows nothing blocked, and says why.
        setBlocks([]);
        return setMonthError(errorText(kit, reply.error));
      }
      setMonthError(null);
      setBlocks(reply.blocks);
    })();
  }, [cursor, filter, reload, kit]);

  // The entry link opens the form with that stay or destination chosen, once it is known; an unknown id is ignored.
  useEffect(() => {
    const wanted = entry.current;
    if (!wanted || !listsReady || !today) return;
    entry.current = null;
    const known =
      wanted.scope === "stay" ? stays.some((one) => one.id === wanted.stayId) : destinations.some((one) => one.id === wanted.destinationId);
    if (!known) return;
    setPanel({
      initial: { ...EMPTY, scope: wanted.scope, ...(wanted.scope === "stay" ? { stayId: wanted.stayId } : { destinationId: wanted.destinationId }) },
      busy: false,
      error: null,
    });
  }, [listsReady, today, stays, destinations]);

  async function add(payload: BlockPayload): Promise<boolean> {
    setPanel((old) => (old ? { ...old, busy: true, error: null } : old));
    const reply = await opsSend<BlockAddResult>("/api/ops/blocks", { action: "add", block: payload });
    if (!reply.ok) {
      // A refused field of the block (`block`, `block.ends_on`) is one of the form's own: the generic sentence, not a
      // column name.
      const ownField = reply.error.code === "invalid" && /^block(\.|$)/.test(reply.error.field ?? "");
      const sentence = ownField ? kit.errors.invalid : errorText(kit, reply.error);
      setPanel((old) => (old ? { ...old, busy: false, error: sentence } : old));
      return false;
    }
    setPanel(null);
    setDeleteError(null);
    setNotice(reply.overlapping_bookings > 0 ? overlapLine(locale, reply.overlapping_bookings) : null);
    setReload((n) => n + 1);
    return true;
  }

  async function confirmDelete() {
    const block = deleting;
    setDeleting(null);
    if (!block) return;
    setDeleteError(null);
    const reply = await opsSend<{ id: string }>("/api/ops/blocks", { action: "delete", id: block.id });
    // A refused delete changed nothing: say so, and leave the month as it is.
    if (!reply.ok) return setDeleteError(errorText(kit, reply.error));
    setReload((n) => n + 1);
  }

  if (!cursor || !today) return <div className="flex min-w-0 flex-col gap-6" />;

  return (
    <CalendarView
      locale={locale}
      today={today}
      year={cursor.year}
      month={cursor.month}
      onMonthChange={(delta) => {
        setDeleteError(null);
        setCursor((old) => (old ? shiftMonth(old.year, old.month, delta) : old));
      }}
      blocks={blocks}
      destinations={destinations}
      stays={stays}
      filter={filter}
      onFilterChange={setFilter}
      errors={[deleteError, monthError, listsError].filter((one): one is string => one !== null)}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
      onOpenBlock={(day) => setPanel({ initial: { ...EMPTY, first: day, last: day }, busy: false, error: null })}
      panel={panel}
      onSubmitBlock={add}
      onClosePanel={() => setPanel(null)}
      onEditBlock={() => setPanel((old) => (old && old.error ? { ...old, error: null } : old))}
      deleting={deleting}
      onAskDelete={setDeleting}
      onConfirmDelete={confirmDelete}
      onCancelDelete={() => setDeleting(null)}
    />
  );
}

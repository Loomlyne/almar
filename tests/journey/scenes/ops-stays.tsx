"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees (job 02: the layout picks a mode, the shell itself is a client component). The scene
// frames every state in the preview shell so the rail and the density match.
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { StaysList, type StayRow } from "../../../app/dashboard/(ops)/catalog/stays/stays-list";
import type { Locale3 } from "../../../components/ops/api-types";
import type { SceneContext, Scenes } from "../scene-types";

/**
 * The states of Catalog -> Stays, bracket data only. The list states are here; the panel states (details, photos,
 * connections, publish) are added once the owner has chosen the redesigned panel. Test-only.
 */
type Text = {
  destination: (n: number) => string;
  stay: (n: number) => string;
  /** A search that matches nothing. */
  search: string;
};

const TEXT: Record<Locale3, Text> = {
  en: { destination: (n) => `[Destination ${n}]`, stay: (n) => `[Stay ${n}]`, search: "[Search text]" },
  ar: { destination: (n) => `[الوجهة ${n}]`, stay: (n) => `[الإقامة ${n}]`, search: "[نص البحث]" },
  es: { destination: (n) => `[Destino ${n}]`, stay: (n) => `[Estancia ${n}]`, search: "[Texto de búsqueda]" },
};

/** The kit reads the almar-locale cookie and the shell does too; the harness picks the language from ?l=, so set it first. */
function Frame({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

/** Hidden record of every handler the list called, so a test can prove each control reaches its prop. */
function LogOutput({ entries }: { entries: string[] }) {
  return (
    <output data-testid="ops-stays-log" className="sr-only">
      {entries.join(" | ")}
    </output>
  );
}

function rowsOf(t: Text): StayRow[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `s${n}`,
    name: t.stay(n),
    destinationId: `d${((n - 1) % 3) + 1}`,
    destinationName: t.destination(((n - 1) % 3) + 1),
    connected: n % 4,
    published: n % 3 !== 0,
  }));
}

function ListScene({ ctx, empty, search: startSearch }: { ctx: SceneContext; empty?: boolean; search?: boolean }) {
  const t = TEXT[ctx.locale];
  const [rows, setRows] = useState<StayRow[]>(() => (empty ? [] : rowsOf(t)));
  const [search, setSearch] = useState(startSearch ? t.search : "");
  const [destinationId, setDestinationId] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const note = (entry: string) => setLog((previous) => [...previous, entry]);

  function move(id: string, by: -1 | 1) {
    note(`move:${id}:${by}`);
    setRows((previous) => {
      const at = previous.findIndex((row) => row.id === id);
      const to = at + by;
      if (at < 0 || to < 0 || to >= previous.length) return previous;
      const next = [...previous];
      const [taken] = next.splice(at, 1);
      next.splice(to, 0, taken);
      return next;
    });
  }

  function dropOrder(ids: string[]) {
    note(`drop:${ids.join(",")}`);
    setRows((previous) => ids.map((id) => previous.find((row) => row.id === id)).filter((row): row is StayRow => Boolean(row)));
  }

  return (
    <Frame locale={ctx.locale}>
      <StaysList
        locale={ctx.locale}
        rows={rows}
        destinations={[1, 2, 3].map((n) => ({ id: `d${n}`, name: t.destination(n) }))}
        search={search}
        onSearchChange={(next) => {
          note(`search:${next}`);
          setSearch(next);
        }}
        destinationId={destinationId}
        onDestinationChange={(next) => {
          note(`destination:${next}`);
          setDestinationId(next);
        }}
        onOpen={(row) => note(`open:${row.id}`)}
        onNew={() => note("new")}
        onMove={move}
        onDropOrder={dropOrder}
      />
      <LogOutput entries={log} />
    </Frame>
  );
}

export const scenes: Scenes = {
  list: (ctx) => <ListScene ctx={ctx} />,
  "list-empty": (ctx) => <ListScene ctx={ctx} empty />,
  "list-no-match": (ctx) => <ListScene ctx={ctx} search />,
};

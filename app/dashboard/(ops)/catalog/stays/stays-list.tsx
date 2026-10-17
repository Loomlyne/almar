"use client";

import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { StatusChip } from "../../../../../components/ops/status-chip";
import type { Locale3 } from "../../../../../components/ops/api-types";
import { Button } from "../../../../../components/ui/button";
import { Field } from "../../../../../components/ui/field";
import { Select } from "../../../../../components/ui/select";
import { DASHBOARD_COPY } from "../../../../../lib/copy/dashboard";
import { OPS_STAYS_COPY } from "../../../../../lib/copy/ops-stays";

/** One line of the stays list. The screen builds it from the stays read and the catalog read (D-88). */
export type StayRow = {
  id: string;
  name: string;
  destinationId: string;
  destinationName: string;
  /** Experiences and services connected to this stay. */
  connected: number;
  published: boolean;
};

export type DestinationOption = { id: string; name: string };

/** Search is folded: case and accents do not matter ("Cartagena" finds "cartagena" and "Cartagéna"). */
export function matchesSearch(row: StayRow, search: string): boolean {
  const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const wanted = fold(search.trim());
  return wanted === "" || fold(row.name).includes(wanted) || fold(row.destinationName).includes(wanted);
}

/**
 * The stays list of Catalog -> Stays: title and New stay, search, destination filter, the dense table (cards below 768),
 * order controls. It owns no data and no panel: the screen passes rows and handlers, so the list is the same whichever
 * panel the owner chose. Order is changed only on the whole list; with a search or a filter on, the controls are hidden
 * and one line says why.
 */
export function StaysList({
  locale,
  rows,
  destinations,
  search,
  onSearchChange,
  destinationId,
  onDestinationChange,
  onOpen,
  onNew,
  onMove,
  onDropOrder,
}: {
  locale: Locale3;
  rows: StayRow[];
  destinations: DestinationOption[];
  search: string;
  onSearchChange: (next: string) => void;
  /** "" is every destination. */
  destinationId: string;
  onDestinationChange: (next: string) => void;
  onOpen: (row: StayRow) => void;
  onNew: () => void;
  onMove: (id: string, by: -1 | 1) => void;
  onDropOrder: (ids: string[]) => void;
}) {
  const copy = OPS_STAYS_COPY[locale];
  const dashboard = DASHBOARD_COPY[locale];
  const filtering = search.trim() !== "" || destinationId !== "";
  const shown = rows.filter((row) => (destinationId === "" || row.destinationId === destinationId) && matchesSearch(row, search));

  const columns: Column<StayRow>[] = [
    { key: "name", label: copy.columnName, phone: "title", render: (row) => row.name },
    { key: "destination", label: copy.columnDestination, phone: "meta", render: (row) => row.destinationName },
    { key: "connected", label: copy.columnConnected, phone: "meta", render: (row) => row.connected },
    { key: "status", label: copy.columnStatus, phone: "meta", render: (row) => <StatusChip published={row.published} locale={locale} /> },
  ];

  const options = [{ value: "", label: copy.allDestinations }, ...destinations.map((one) => ({ value: one.id, label: one.name }))];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{dashboard.rail.stays}</h1>
        <Button onClick={onNew}>{dashboard.newStay}</Button>
      </div>

      {rows.length === 0 ? (
        <p className="m-0 text-pretty text-body text-ink">{dashboard.noStaysYet}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <Field id="stays-search" label={copy.search} search className="max-w-none sm:max-w-96" value={search} onChange={(event) => onSearchChange(event.target.value)} />
            <Select
              id="stays-destination"
              label={copy.filterLabel}
              value={destinationId}
              options={options}
              onChange={onDestinationChange}
              dir={locale === "ar" ? "rtl" : "ltr"}
            />
          </div>
          {filtering && shown.length > 0 ? <p className="m-0 text-caption text-muted">{copy.orderLocked}</p> : null}
          <ListTable
            caption={dashboard.rail.stays}
            columns={columns}
            rows={shown}
            onOpen={onOpen}
            reorder={filtering ? undefined : { onMove, onDropOrder }}
            empty={<p className="m-0 text-pretty text-body text-ink">{copy.noMatch}</p>}
          />
        </>
      )}
    </div>
  );
}

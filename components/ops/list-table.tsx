"use client";

import { useState, type ReactNode } from "react";
import { ChevronIcon } from "../icons/icons";
import { cn } from "../../lib/cn";
import { OPS_KIT_COPY } from "../../lib/copy/ops-kit";
import { useDashboardLocale } from "./use-dashboard-locale";

/**
 * One column. `phone` decides what the card shows below 768: "title" leads (the first one opens the row), "meta" follows
 * as a label and value, "hidden" is dropped. `render` returns text, chips or other static content, never a control: the
 * row itself is the control.
 */
export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode; phone: "title" | "meta" | "hidden" };

type Reorder = {
  /** Move up (-1) or down (+1) by one place. The parent owns the order and passes the new rows back. */
  onMove: (id: string, by: -1 | 1) => void;
  /** A drag finished: the full new id order. */
  onDropOrder: (ids: string[]) => void;
};

function Grip() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" fill="currentColor">
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </svg>
  );
}

const MOVE_BUTTON =
  "inline-flex min-h-control min-w-control cursor-pointer items-center justify-center gap-1 rounded-none border border-line bg-transparent px-2 font-body text-label text-teal transition-colors duration-fast ease-standard hover:bg-teal-tint disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent";

const OPEN_BUTTON =
  "m-0 inline-flex min-h-control cursor-pointer items-center border-0 bg-transparent p-0 text-start font-body text-label text-teal underline decoration-gold decoration-1 underline-offset-4 hover:no-underline";

/**
 * The list of a dashboard section: a dense table from 768 (design canvas page 7, dense variant), a stack of cards
 * below (D-82). Both are in the page; CSS shows one. With `reorder`, every row has Move up and Move down, and from 768
 * a row can also be dragged by its handle (the buttons are the keyboard path).
 */
export function ListTable<T extends { id: string }>({
  caption,
  columns,
  rows,
  onOpen,
  empty,
  reorder,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  onOpen: (row: T) => void;
  empty: ReactNode;
  reorder?: Reorder;
}) {
  const copy = OPS_KIT_COPY[useDashboardLocale()];
  const [drag, setDrag] = useState<{ id: string; over: string | null } | null>(null);

  if (rows.length === 0) return <>{empty}</>;

  const ids = rows.map((row) => row.id);
  const openColumn = columns[0];
  const titled = columns.filter((column) => column.phone === "title");
  // A card always has a lead that opens the row, even when no column was marked "title".
  const titleColumns = titled.length > 0 ? titled : columns.slice(0, 1);
  const metaColumns = columns.filter((column) => column.phone === "meta");

  function dropOn(target: string) {
    if (!reorder || !drag || drag.id === target) return;
    const from = ids.indexOf(drag.id);
    const to = ids.indexOf(target);
    if (from < 0 || to < 0) return;
    const next = ids.filter((id) => id !== drag.id);
    next.splice(to, 0, drag.id);
    reorder.onDropOrder(next);
  }

  function moveButtons(row: T, index: number, labelled: boolean) {
    if (!reorder) return null;
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={MOVE_BUTTON}
          disabled={index === 0}
          aria-label={labelled ? undefined : copy.moveUp}
          title={labelled ? undefined : copy.moveUp}
          onClick={(event) => {
            event.stopPropagation();
            reorder.onMove(row.id, -1);
          }}
        >
          <ChevronIcon size={16} className="-rotate-90" />
          {labelled ? copy.moveUp : null}
        </button>
        <button
          type="button"
          className={MOVE_BUTTON}
          disabled={index === rows.length - 1}
          aria-label={labelled ? undefined : copy.moveDown}
          title={labelled ? undefined : copy.moveDown}
          onClick={(event) => {
            event.stopPropagation();
            reorder.onMove(row.id, 1);
          }}
        >
          <ChevronIcon size={16} className="rotate-90" />
          {labelled ? copy.moveDown : null}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="hidden min-w-0 overflow-x-auto md:block">
        <table className="w-full border-collapse font-body">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="h-row dense:h-row-dense border-b border-line">
              {reorder ? <th scope="col" className="w-12 px-2" aria-hidden="true" /> : null}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="px-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal"
                >
                  {column.label}
                </th>
              ))}
              {reorder ? (
                <th scope="col" className="w-1 whitespace-nowrap px-2 text-start text-caption font-normal text-muted">
                  <span className="sr-only">{copy.order}</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={cn(
                  "h-row dense:h-row-dense cursor-pointer border-b border-line hover:bg-surface",
                  drag?.id === row.id && "opacity-60",
                  drag && drag.over === row.id && drag.id !== row.id && "shadow-rule-primary",
                )}
                onClick={() => onOpen(row)}
                onDragOver={(event) => {
                  if (!drag) return;
                  event.preventDefault();
                  if (drag.over !== row.id) setDrag({ id: drag.id, over: row.id });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dropOn(row.id);
                  setDrag(null);
                }}
              >
                {reorder ? (
                  <td className="w-12 px-2">
                    <span
                      draggable
                      data-testid="drag-handle"
                      title={copy.dragHandle}
                      className="inline-flex size-control cursor-grab items-center justify-center text-muted"
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", row.id);
                        setDrag({ id: row.id, over: null });
                      }}
                      onDragEnd={() => setDrag(null)}
                    >
                      <Grip />
                      <span className="sr-only">{copy.dragHandle}</span>
                    </span>
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td key={column.key} className="px-2 text-label text-ink">
                    {column === openColumn ? (
                      <button
                        type="button"
                        className={OPEN_BUTTON}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(row);
                        }}
                      >
                        {column.render(row)}
                      </button>
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
                {reorder ? <td className="w-1 whitespace-nowrap px-2">{moveButtons(row, index, false)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden" aria-label={caption}>
        {rows.map((row, index) => (
          <li key={row.id} className="flex flex-col gap-2 border border-line bg-surface p-4">
            {titleColumns.map((column, at) =>
              at === 0 ? (
                <button key={column.key} type="button" className={OPEN_BUTTON} onClick={() => onOpen(row)}>
                  {column.render(row)}
                </button>
              ) : (
                <div key={column.key} className="text-label text-ink">
                  {column.render(row)}
                </div>
              ),
            )}
            {metaColumns.length > 0 ? (
              <dl className="m-0 flex flex-col gap-1">
                {metaColumns.map((column) => (
                  <div key={column.key} className="flex flex-wrap items-center gap-2">
                    <dt className="text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
                      {column.label}
                    </dt>
                    <dd className="m-0 text-label text-ink">{column.render(row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {moveButtons(row, index, true)}
          </li>
        ))}
      </ul>
    </>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";
import { foldText } from "../../lib/data/stay-filter";
import { OPS_KIT_COPY, fillCopy } from "../../lib/copy/ops-kit";
import { canMove, moveConnected, type CanSwap } from "./connect-order";
import { useDashboardLocale } from "./use-dashboard-locale";

type Option = { id: string; label: string; meta?: string };

/**
 * Connect several items to one (stays to a destination, experiences to a stay): search, tick, "Connect selected",
 * then a list of what is connected with Remove on each. The order of `connected` is kept and new ids go to the end,
 * in option order. `groups` are read-only lists ("From the destination") that cannot be removed here.
 *
 * `reorder` (opt-in; the stay editor's experiences and services, owner 2026-10-17) adds Move up / Move down on each
 * connected row, as the gallery has: off at the ends and wherever `canSwap` says two neighbours may not trade places, and
 * focus stays on the moved row. Without it the picker draws as before.
 */
export function ConnectPicker({
  title,
  searchLabel,
  hint,
  options,
  connected,
  onChange,
  groups,
  reorder,
}: {
  title: string;
  searchLabel: string;
  hint?: string;
  options: Option[];
  connected: string[];
  onChange: (ids: string[]) => void;
  groups?: { label: string; ids: string[] }[];
  reorder?: { canSwap?: CanSwap };
}) {
  const copy = OPS_KIT_COPY[useDashboardLocale()];
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const connectedRef = useRef<HTMLUListElement>(null);
  // The row just moved by Move up / Move down: once the list has its new order, focus goes to its button for the same
  // direction, or to the other one when the row reached an end (that one is now off).
  const moved = useRef<{ id: string; by: -1 | 1 } | null>(null);

  useEffect(() => {
    const last = moved.current;
    moved.current = null;
    if (!last || !connectedRef.current) return;
    const row = [...connectedRef.current.querySelectorAll<HTMLElement>("[data-connect-row]")].find((el) => el.dataset.connectRow === last.id);
    const button = (way: "up" | "down") => row?.querySelector<HTMLButtonElement>(`button[data-move="${way}"]`);
    const same = button(last.by === -1 ? "up" : "down");
    const other = button(last.by === -1 ? "down" : "up");
    (same && !same.disabled ? same : other)?.focus();
  }, [connected]);

  function move(id: string, by: -1 | 1) {
    const next = moveConnected(connected, id, by, reorder?.canSwap);
    if (next === connected) return;
    moved.current = { id, by };
    onChange([...next]);
  }

  const byId = new Map(options.map((option) => [option.id, option]));
  const connectedSet = new Set(connected);
  const available = options.filter((option) => !connectedSet.has(option.id));
  const needle = foldText(query.trim());
  const shown = needle
    ? available.filter((option) => foldText(`${option.label} ${option.meta ?? ""}`).includes(needle))
    : available;
  // An id that has since been connected is no longer a pending pick.
  const picked = available.filter((option) => ticked.has(option.id));

  function toggle(id: string, on: boolean) {
    const next = new Set(ticked);
    if (on) next.add(id);
    else next.delete(id);
    setTicked(next);
  }

  function connectSelected() {
    if (picked.length === 0) return;
    onChange([...connected, ...picked.map((option) => option.id)]);
    setTicked(new Set());
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label={title}>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-balance font-display text-title font-normal text-teal">{title}</h3>
        {hint ? <p className="m-0 text-label text-muted">{hint}</p> : null}
      </div>
      <Field
        id={searchId}
        label={searchLabel}
        search
        className="max-w-none"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {shown.length > 0 ? (
        <ul className="m-0 flex max-h-96 list-none flex-col overflow-auto border border-line p-0">
          {shown.map((option) => (
            <li key={option.id} className="border-b border-line px-2 last:border-b-0">
              <Checkbox
                className="w-full"
                checked={ticked.has(option.id)}
                onChange={(event) => toggle(option.id, event.target.checked)}
                label={
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span>{option.label}</span>
                    {option.meta ? <span className="text-caption text-muted">{option.meta}</span> : null}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-label text-muted">{copy.noResults}</p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-label text-ink" aria-live="polite">
          {fillCopy(picked.length === 1 ? copy.selectedOne : copy.selected, { n: picked.length })}
        </span>
        <Button variant="secondary" disabled={picked.length === 0} onClick={connectSelected}>
          {copy.connectSelected}
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="m-0 text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
          {copy.connected}
        </h4>
        {connected.length > 0 ? (
          <ul ref={connectedRef} className="m-0 flex list-none flex-col border border-line p-0">
            {connected.map((id) => {
              const option = byId.get(id);
              const label = option?.label ?? id;
              const remove = (
                <Button
                  variant="ghost"
                  aria-label={fillCopy(copy.removeNamed, { name: label })}
                  onClick={() => onChange(connected.filter((other) => other !== id))}
                >
                  {copy.remove}
                </Button>
              );
              const text = (
                <span id={reorder ? `${searchId}-row-${id}` : undefined} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-label text-ink">
                  <span>{label}</span>
                  {option?.meta ? <span className="text-caption text-muted">{option.meta}</span> : null}
                </span>
              );
              if (!reorder) {
                return (
                  <li key={id} className="flex items-center justify-between gap-2 border-b border-line ps-2 last:border-b-0">
                    {text}
                    {remove}
                  </li>
                );
              }
              // The row's name describes its move buttons, so "Move up" is said with the item it moves.
              return (
                <li
                  key={id}
                  data-connect-row={id}
                  className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-line py-1 ps-2 last:border-b-0"
                >
                  {text}
                  <span className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      data-move="up"
                      aria-describedby={`${searchId}-row-${id}`}
                      disabled={!canMove(connected, id, -1, reorder.canSwap)}
                      onClick={() => move(id, -1)}
                    >
                      {copy.moveUp}
                    </Button>
                    <Button
                      variant="secondary"
                      data-move="down"
                      aria-describedby={`${searchId}-row-${id}`}
                      disabled={!canMove(connected, id, 1, reorder.canSwap)}
                      onClick={() => move(id, 1)}
                    >
                      {copy.moveDown}
                    </Button>
                    {remove}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 text-label text-muted">{copy.noneConnected}</p>
        )}
      </div>
      {groups?.map((group) => (
        <div key={group.label} className="flex flex-col gap-2">
          <h4 className="m-0 text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
            {group.label}
          </h4>
          <ul className="m-0 flex list-none flex-col border border-line p-0">
            {group.ids.map((id) => (
              <li key={id} className="border-b border-line px-2 py-2 text-label text-ink last:border-b-0">
                {byId.get(id)?.label ?? id}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowIcon } from "../../../../../components/icons/icons";
import { canMove, moveConnected } from "../../../../../components/ops/connect-order";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { Button } from "../../../../../components/ui/button";
import { Checkbox } from "../../../../../components/ui/checkbox";
import { Chip } from "../../../../../components/ui/chip";
import { Field } from "../../../../../components/ui/field";
import { OPS_KIT_COPY, fillCopy } from "../../../../../lib/copy/ops-kit";
import { OPS_TEAM_COPY } from "../../../../../lib/copy/ops-team";
import { foldText } from "../../../../../lib/data/stay-filter";

export type AddonOption = { id: string; label: string };

const SQUARE = "w-control px-0";
const REMOVE =
  "inline-flex min-h-control cursor-pointer items-center border-0 bg-transparent p-0 font-body text-label text-error underline decoration-error decoration-1 underline-offset-4 disabled:cursor-default disabled:text-muted disabled:no-underline";

/**
 * Included in this package, as signed (pictures/06-06 journey-editor-addons): what is connected first, with its order and Remove,
 * then the search over the catalog, square tick boxes (an item already in is marked Connected and its box is off), and Connect
 * selected. The kit's ConnectPicker draws these the other way round, so this card is its own; it shares the kit's order rules
 * (connect-order.ts). Props only. Guests see these as included and cannot remove them.
 */
export function JourneyAddons({ options, connected, onChange }: { options: AddonOption[]; connected: string[]; onChange: (ids: string[]) => void }) {
  const loc = useDashboardLocale();
  const copy = OPS_TEAM_COPY[loc].journeys;
  const kit = OPS_KIT_COPY[loc];
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const listRef = useRef<HTMLUListElement>(null);
  const moved = useRef<{ id: string; by: -1 | 1 } | null>(null);

  useEffect(() => {
    const last = moved.current;
    moved.current = null;
    if (!last || !listRef.current) return;
    const row = [...listRef.current.querySelectorAll<HTMLElement>("[data-addon-row]")].find((el) => el.dataset.addonRow === last.id);
    const button = (way: "up" | "down") => row?.querySelector<HTMLButtonElement>(`button[data-move="${way}"]`);
    const same = button(last.by === -1 ? "up" : "down");
    const other = button(last.by === -1 ? "down" : "up");
    (same && !same.disabled ? same : other)?.focus();
  }, [connected]);

  const byId = new Map(options.map((option) => [option.id, option]));
  const isConnected = new Set(connected);
  const needle = foldText(query.trim());
  const shown = needle ? options.filter((option) => foldText(option.label).includes(needle)) : options;
  const picked = options.filter((option) => ticked.has(option.id) && !isConnected.has(option.id));

  function move(id: string, by: -1 | 1) {
    const next = moveConnected(connected, id, by);
    if (next === connected) return;
    moved.current = { id, by };
    onChange([...next]);
  }

  function connectSelected() {
    if (picked.length === 0) return;
    onChange([...connected, ...picked.map((option) => option.id)]);
    setTicked(new Set());
  }

  return (
    <>
      <p className="m-0 text-label text-muted">{copy.addonsHint}</p>
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="m-0 font-body text-label font-bold text-ink">{kit.connected}</h3>
        {connected.length > 0 ? (
          <ul ref={listRef} className="m-0 flex list-none flex-col p-0">
            {connected.map((id) => {
              // The screen reads the catalog before it opens a package, so every connected item has its name here; never print an id.
              const label = byId.get(id)?.label;
              if (!label) return null;
              return (
                <li key={id} data-addon-row={id} className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-line py-1">
                  <span className="min-w-0 text-label text-ink">{label}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" className={SQUARE} data-move="up" aria-label={`${kit.moveUp}: ${label}`} title={kit.moveUp} disabled={!canMove(connected, id, -1)} onClick={() => move(id, -1)}>
                      <ArrowIcon size={16} className="-rotate-90" aria-hidden="true" />
                    </Button>
                    <Button variant="secondary" className={SQUARE} data-move="down" aria-label={`${kit.moveDown}: ${label}`} title={kit.moveDown} disabled={!canMove(connected, id, 1)} onClick={() => move(id, 1)}>
                      <ArrowIcon size={16} className="rotate-90" aria-hidden="true" />
                    </Button>
                    <button type="button" className={REMOVE} aria-label={fillCopy(kit.removeNamed, { name: label })} onClick={() => onChange(connected.filter((other) => other !== id))}>
                      {kit.remove}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 text-label text-muted">{kit.noneConnected}</p>
        )}
      </div>
      <Field id={searchId} label={kit.search} placeholder={copy.addonsSearch} className="max-w-none" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
      {shown.length > 0 ? (
        <ul className="m-0 flex max-h-96 list-none flex-col overflow-auto p-0">
          {shown.map((option) => {
            const already = isConnected.has(option.id);
            return (
              <li key={option.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-line">
                <Checkbox
                  className="min-w-0 gap-3"
                  label={option.label}
                  disabled={already}
                  checked={!already && ticked.has(option.id)}
                  onChange={(event) => {
                    const next = new Set(ticked);
                    if (event.target.checked) next.add(option.id);
                    else next.delete(option.id);
                    setTicked(next);
                  }}
                />
                {already ? (
                  <Chip interactive={false} size="dense" on={false}>
                    {kit.connected}
                  </Chip>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-label text-muted">{kit.noResults}</p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={picked.length === 0} onClick={connectSelected}>
          {kit.connectSelected}
        </Button>
        <span className="text-label text-muted" aria-live="polite">
          {fillCopy(picked.length === 1 ? kit.selectedOne : kit.selected, { n: picked.length })}
        </span>
      </div>
    </>
  );
}

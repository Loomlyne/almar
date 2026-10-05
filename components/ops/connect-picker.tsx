"use client";

import { useId, useState } from "react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";
import { foldText } from "../../lib/data/stay-filter";
import { OPS_KIT_COPY, fillCopy } from "../../lib/copy/ops-kit";
import { useDashboardLocale } from "./use-dashboard-locale";

type Option = { id: string; label: string; meta?: string };

/**
 * Connect several items to one (stays to a destination, experiences to a stay): search, tick, "Connect selected",
 * then a list of what is connected with Remove on each. The order of `connected` is kept and new ids go to the end,
 * in option order. `groups` are read-only lists ("From the destination") that cannot be removed here.
 */
export function ConnectPicker({
  title,
  searchLabel,
  hint,
  options,
  connected,
  onChange,
  groups,
}: {
  title: string;
  searchLabel: string;
  hint?: string;
  options: Option[];
  connected: string[];
  onChange: (ids: string[]) => void;
  groups?: { label: string; ids: string[] }[];
}) {
  const copy = OPS_KIT_COPY[useDashboardLocale()];
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());

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
          <ul className="m-0 flex list-none flex-col border border-line p-0">
            {connected.map((id) => {
              const option = byId.get(id);
              const label = option?.label ?? id;
              return (
                <li key={id} className="flex items-center justify-between gap-2 border-b border-line ps-2 last:border-b-0">
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-label text-ink">
                    <span>{label}</span>
                    {option?.meta ? <span className="text-caption text-muted">{option.meta}</span> : null}
                  </span>
                  <Button
                    variant="ghost"
                    aria-label={fillCopy(copy.removeNamed, { name: label })}
                    onClick={() => onChange(connected.filter((other) => other !== id))}
                  >
                    {copy.remove}
                  </Button>
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

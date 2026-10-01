"use client";

import { useState } from "react";
import { AddOnList, AddOnRow, type AddOnFilter } from "../../../components/journey/add-on-row";
import type { AddOnItem } from "../../../components/journey/types";
import type { Scenes, SceneContext } from "../scene-types";

const GUESTS = 4; // guestsFamily: 2 adults + 1 child + 1 infant
const NIGHTS = 5;

function Row({
  ctx,
  id,
  unit,
  start,
  size = "row",
}: {
  ctx: SceneContext;
  id: string;
  unit: AddOnItem["unit"];
  start: number;
  size?: "row" | "phone";
}) {
  const base = ctx.fixtures.addOns.find((i) => i.id === id) as AddOnItem;
  const item = { ...base, unit };
  const [q, setQ] = useState(start);
  return (
    <div data-testid="harness-add-on" className={size === "row" ? "w-column max-w-full" : "w-96 max-w-full"}>
      <AddOnRow
        item={item}
        quantity={q}
        max={unit === "person" ? GUESTS : NIGHTS}
        onChange={setQ}
        size={size}
        copy={ctx.copy}
      />
    </div>
  );
}

function List({
  ctx,
  filter = "all",
  items,
  loading,
}: {
  ctx: SceneContext;
  filter?: AddOnFilter;
  items?: AddOnItem[];
  loading?: boolean;
}) {
  const [f, setF] = useState<AddOnFilter>(filter);
  const [q, setQ] = useState<Record<string, number>>({ [ctx.fixtures.HOME_PICKUP_ID]: 1 });
  return (
    <div data-testid="harness-add-on-list" className="w-column max-w-full max-h-screen flex">
      <AddOnList
        items={items ?? ctx.fixtures.addOns}
        quantities={q}
        onChange={(id, n) => setQ((prev) => ({ ...prev, [id]: n }))}
        guestsTotal={GUESTS}
        nights={NIGHTS}
        destinationName="Cartagena"
        filter={f}
        onFilterChange={setF}
        loading={loading}
        copy={ctx.copy}
      />
    </div>
  );
}

export const scenes: Scenes = {
  "trip-off": (ctx) => <Row ctx={ctx} id="vip-airport-meet" unit="trip" start={0} />,
  "trip-on": (ctx) => <Row ctx={ctx} id="home-pickup" unit="trip" start={1} />,
  person: (ctx) => <Row ctx={ctx} id="heritage-tours" unit="person" start={1} />,
  "person-max": (ctx) => <Row ctx={ctx} id="heritage-tours" unit="person" start={GUESTS} />,
  night: (ctx) => <Row ctx={ctx} id="private-concierge" unit="night" start={2} />,
  "night-max": (ctx) => <Row ctx={ctx} id="private-concierge" unit="night" start={NIGHTS} />,
  "list-all": (ctx) => <List ctx={ctx} />,
  "list-experiences": (ctx) => <List ctx={ctx} filter="experiences" />,
  "list-empty": (ctx) => (
    <List ctx={ctx} filter="services" items={ctx.fixtures.addOns.filter((i) => i.kind === "experience")} />
  ),
  "list-loading": (ctx) => <List ctx={ctx} loading />,
  "phone-row": (ctx) => <Row ctx={ctx} id="heritage-tours" unit="person" start={1} size="phone" />,
};

"use client";

import { useState } from "react";
import { JourneyCart } from "../../../components/journey/journey-cart";
import type { CartLine } from "../../../components/journey/types";
import type { Scenes, SceneContext } from "../scene-types";

const lines = (ctx: SceneContext): CartLine[] => [
  { id: "home-pickup", name: "Home pickup", quantity: 1, amount: ctx.fixtures.AMOUNT },
  { id: "heritage-tours", name: "Cartagena Heritage Tours", quantity: 2, amount: ctx.fixtures.AMOUNT },
  { id: "private-concierge", name: "24/7 Private Concierge", quantity: 3, amount: ctx.fixtures.AMOUNT },
];

function Cart({
  ctx,
  initial,
  variant,
  loading,
  defaultOpen,
}: {
  ctx: SceneContext;
  initial: CartLine[];
  variant: "rail" | "phone";
  loading?: boolean;
  defaultOpen?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [continued, setContinued] = useState(0);
  const f = ctx.fixtures;
  return (
    <div data-testid="harness-cart" className={variant === "rail" ? "flex justify-end" : undefined}>
      <JourneyCart
        variant={variant}
        loading={loading}
        defaultOpen={defaultOpen}
        destinationName="Cartagena"
        stay={{
          image: f.stay.image,
          name: f.stay.name,
          dates: `${f.dates.startLabel} – ${f.dates.endLabel}`,
          guests: "2 adults",
          nights: f.dates.nights,
          amount: f.AMOUNT,
        }}
        lines={items}
        inclusionsCount={f.inclusions.length}
        subtotal={f.AMOUNT}
        vat={f.AMOUNT}
        total={f.AMOUNT}
        onRemove={(id) => setItems((prev) => prev.filter((l) => l.id !== id))}
        onContinue={() => setContinued((n) => n + 1)}
        copy={ctx.copy}
        locale={ctx.locale}
      />
      <output data-testid="cart-continued" className="sr-only">
        {continued}
      </output>
    </div>
  );
}

export const scenes: Scenes = {
  "rail-filled": (ctx) => <Cart ctx={ctx} initial={lines(ctx)} variant="rail" />,
  "rail-empty": (ctx) => <Cart ctx={ctx} initial={[]} variant="rail" />,
  loading: (ctx) => <Cart ctx={ctx} initial={[]} variant="rail" loading />,
  "phone-dock": (ctx) => <Cart ctx={ctx} initial={lines(ctx)} variant="phone" />,
  "phone-open": (ctx) => <Cart ctx={ctx} initial={lines(ctx)} variant="phone" defaultOpen />,
};

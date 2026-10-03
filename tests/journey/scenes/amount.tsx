"use client";

import { useState } from "react";
import { Amount } from "../../../components/ui/amount";
import { Select } from "../../../components/ui/select";
import { HOME_COPY } from "../../../lib/copy/home";
import type { SelectedCurrency } from "../../../lib/fx/rates";
import type { Scenes, SceneContext } from "../scene-types";

/** Fixed test rates, so the expected text can be computed by the spec from the same module. */
const RATES = { aed: 3.6725, eur: 0.92, date: "2026-10-01" };

const CURRENCIES = (["AED", "USD", "EUR"] as const).map((code) => ({ value: code, label: code }));

function Live({ ctx, rates, start }: { ctx: SceneContext; rates: typeof RATES | null; start: SelectedCurrency | null }) {
  const [selected, setSelected] = useState<SelectedCurrency | null>(start);
  const tiers = HOME_COPY.en.journeys;
  return (
    <div data-testid="harness-amount" className="flex flex-col gap-4 p-4">
      <Select
        value={selected}
        options={CURRENCIES}
        label="[Currency]: {code}"
        placeholder="[Currency]"
        dir={ctx.locale === "ar" ? "rtl" : "ltr"}
        onChange={(next) => setSelected(next as SelectedCurrency)}
      />
      {tiers.map((tier, i) => (
        <p key={tier.name} data-testid={`price-${i}`} className="m-0">
          <Amount text={tier.price} selected={selected} rates={rates} locale={ctx.locale} />
        </p>
      ))}
      <p data-testid="price-aed" className="m-0">
        <Amount text="AED 80,000" selected={selected} rates={rates} locale={ctx.locale} />
      </p>
    </div>
  );
}

export const scenes: Scenes = {
  rates: (ctx) => <Live ctx={ctx} rates={RATES} start={null} />,
  "no-rates": (ctx) => <Live ctx={ctx} rates={null} start="USD" />,
};

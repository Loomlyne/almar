"use client";

import { useState } from "react";
import { GuestPanel, type GuestCounts } from "../../../components/journey/guest-panel";
import type { Scenes, SceneContext } from "../scene-types";

function Live({ ctx, initial }: { ctx: SceneContext; initial: GuestCounts }) {
  const [counts, setCounts] = useState(initial);
  return (
    <div data-testid="harness-panel">
      <GuestPanel
        counts={counts}
        onChange={setCounts}
        onDone={() => undefined}
        locale={ctx.locale}
        copy={ctx.copy}
      />
    </div>
  );
}

export const scenes: Scenes = {
  default: (ctx) => <Live ctx={ctx} initial={{ adults: 1, children: 0, infants: 0 }} />,
  filled: (ctx) => <Live ctx={ctx} initial={ctx.fixtures.guestsFamily} />,
};

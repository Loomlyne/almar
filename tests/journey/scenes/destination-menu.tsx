"use client";

import { useState } from "react";
import { DestinationMenu } from "../../../components/journey/destination-menu";
import type { Scenes, SceneContext } from "../scene-types";

function Live({
  ctx,
  initial,
  state,
  none,
}: {
  ctx: SceneContext;
  initial: string | null;
  state?: "ready" | "loading";
  none?: boolean;
}) {
  const [id, setId] = useState<string | null>(initial);
  return (
    <div data-testid="harness-panel">
      <DestinationMenu
        destinations={none ? [] : ctx.fixtures.destinations}
        selectedId={id}
        onSelect={setId}
        state={state}
        locale={ctx.locale}
        copy={ctx.copy}
      />
    </div>
  );
}

export const scenes: Scenes = {
  default: (ctx) => <Live ctx={ctx} initial={null} />,
  selected: (ctx) => <Live ctx={ctx} initial="cartagena" />,
  empty: (ctx) => <Live ctx={ctx} initial={null} none />,
  loading: (ctx) => <Live ctx={ctx} initial={null} state="loading" />,
};

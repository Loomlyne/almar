"use client";

import { useLayoutEffect, useState } from "react";
// The real ops shell in mode "ops" (plan 03.2-05): its header mounts the site status line, which reads
// /api/ops/site-status on mount. tests/ops-site-status.spec.ts answers every /api/ops/site-* call with page.route; nothing
// reaches a server. Test-only. The main area shows job 02's "Not ready." as it does for an unwired section.
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import type { SceneContext, Scenes } from "../scene-types";

function Frame({ ctx }: { ctx: SceneContext }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${ctx.locale}; path=/`;
    setReady(true);
  }, [ctx.locale]);
  return ready ? <OpsShell mode="ops">{null}</OpsShell> : null;
}

export const scenes: Scenes = {
  shell: (ctx) => <Frame ctx={ctx} />,
};

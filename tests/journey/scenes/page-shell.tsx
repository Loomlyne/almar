"use client";

import { PageShell } from "../../../components/ui/page-shell";
import type { Scenes } from "../scene-types";

export const scenes: Scenes = {
  default: () => (
    <PageShell>
      <div data-testid="harness-shell-content" className="h-12 bg-teal-tint" />
    </PageShell>
  ),
};

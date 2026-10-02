"use client";

import type { ReactNode } from "react";
import { Chip } from "../../../components/ui/chip";
import type { Scenes } from "../scene-types";

const wrap = (node: ReactNode) => (
  <div data-testid="harness-chip" className="flex flex-wrap items-center gap-4 p-4">
    <button type="button">[before]</button>
    {node}
    <button type="button">[after]</button>
  </div>
);

export const scenes: Scenes = {
  toggle: () => wrap(<Chip on>[Toggle]</Chip>),
  static: () => wrap(<Chip interactive={false}>[Most Popular]</Chip>),
  dense: () => wrap(<Chip interactive={false} size="dense">[Up to 10 Guests]</Chip>),
  "dense-toggle": () => wrap(<Chip size="dense">[Dense toggle]</Chip>),
};

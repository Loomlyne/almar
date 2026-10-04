"use client";

import type { ReactNode } from "react";

import { Field } from "../../../components/ui/field";
import type { Scenes } from "../scene-types";

const wrap = (node: ReactNode) => (
  <div data-testid="harness-field" className="mx-auto w-full max-w-column p-4">
    {node}
  </div>
);

export const scenes: Scenes = {
  default: () => wrap(<Field id="scene-default" label="[Search]" search />),
  wide: () => wrap(<Field id="scene-wide" label="[Search]" search className="max-w-none" />),
  "coupon-default": () => wrap(<Field id="scene-coupon" label="[Code]" coupon />),
  "coupon-label": () => wrap(<Field id="scene-coupon" label="[Code]" coupon couponLabel="[Apply code]" />),
};

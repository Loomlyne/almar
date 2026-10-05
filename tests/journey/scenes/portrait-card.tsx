"use client";

import type { ReactNode } from "react";
import { PortraitCard } from "../../../components/ui/card";
import type { Scenes } from "../scene-types";
import { IMAGES, harnessHref } from "./_images";

const wrap = (node: ReactNode) => (
  <div data-testid="harness-portrait" className="mx-auto w-full max-w-menu p-4">
    {node}
  </div>
);

export const scenes: Scenes = {
  "portrait-kicker": ({ locale }) =>
    wrap(<PortraitCard href={harnessHref(locale)} image={IMAGES[0]} title="[Title]" kicker="[Featured stay]" />),
  "portrait-article": () =>
    wrap(<PortraitCard image={IMAGES[1]} title="[Title]" kicker="[Featured experience]" />),
};

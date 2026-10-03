"use client";

import type { ReactNode } from "react";
import { MediaCard } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import type { Scenes } from "../scene-types";
import { IMAGES, harnessHref } from "./_images";

const wrap = (node: ReactNode) => (
  <div data-testid="harness-card" className="mx-auto w-full max-w-menu p-4">
    {node}
  </div>
);

export const scenes: Scenes = {
  link: ({ locale }) =>
    wrap(
      <MediaCard
        href={harnessHref(locale)}
        image={IMAGES[0]}
        title="[Title]"
        detail="[Detail line]"
      />,
    ),
  article: () => wrap(<MediaCard image={IMAGES[1]} title="[Title]" detail="[Detail line]" />),
  action: ({ locale }) =>
    wrap(
      <MediaCard
        href={harnessHref(locale)}
        image={IMAGES[2]}
        title="[Title]"
        detail="[Detail line]"
        action={<Button variant="secondary">[Add]</Button>}
      />,
    ),
};

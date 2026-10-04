"use client";

import { Gallery } from "../../../components/ui/gallery";
import type { Scenes } from "../scene-types";
import { IMAGES } from "./_images";

const LABELS = {
  open: "[Open {alt}]",
  previous: "[Previous]",
  next: "[Next]",
  close: "[Close]",
  count: "{n} of {total}",
};

export const scenes: Scenes = {
  six: () => (
    <div data-testid="harness-gallery" className="mx-auto w-full max-w-column p-4">
      <Gallery images={IMAGES} labels={LABELS} />
    </div>
  ),
  four: () => (
    <div data-testid="harness-gallery" className="mx-auto w-full max-w-column p-4">
      <Gallery images={IMAGES.slice(0, 4)} labels={LABELS} />
    </div>
  ),
  one: () => (
    <div data-testid="harness-gallery" className="mx-auto w-full max-w-column p-4">
      <Gallery images={IMAGES.slice(0, 1)} labels={LABELS} />
    </div>
  ),
};

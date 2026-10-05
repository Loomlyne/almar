"use client";

import { Slider } from "../../../components/ui/slider";
import type { Scenes } from "../scene-types";
import { IMAGES } from "./_images";

// Slider layout "hero" (plan 03.3-13, S2-17 case B). The fixed corner square stands in for the page's on-image header, so a
// test can park the pointer outside the carousel (tests/helpers/pointer-off.ts).

const LABELS = {
  region: "[Hero photos]",
  previous: "[Previous]",
  next: "[Next]",
  goTo: "[Go to photo {n}]",
  slide: "[Photo {n} of {total}]",
  pause: "[Pause]",
  play: "[Play]",
};

export const scenes: Scenes = {
  three: () => (
    <div data-testid="harness-hero">
      <header data-testid="harness-header" className="fixed left-0 top-0 z-50 size-8" />
      <Slider layout="hero" autoplay images={IMAGES.slice(0, 3)} labels={LABELS}>
        <div className="grid justify-items-center gap-4 text-center text-ivory">
          <p data-testid="hero-kicker" className="m-0 text-label uppercase tracking-kicker ar:normal-case ar:tracking-normal">
            [Kicker]
          </p>
          <h1 data-testid="hero-heading" className="m-0 font-display text-hero text-ivory">
            [Hero heading]
          </h1>
        </div>
      </Slider>
    </div>
  ),
};

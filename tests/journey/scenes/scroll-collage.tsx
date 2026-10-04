"use client";

import { useEffect, type ReactNode } from "react";
import { MotionController } from "../../../components/site/motion-controller";
import { ScrollCollage } from "../../../components/ui/scroll-collage";
import type { Scenes } from "../scene-types";
import { IMAGES } from "./_images";

// One viewport of space before and after, so the collage scrolls fully through the screen. The harness has no
// PublicFrame, so the scene mounts job 11's MotionController itself (the boot script is in the root layout).
const STATEMENT = "[Statement: two or three sentences held in the middle while the photos pass.]";

// The root layout's boot script sets data-motion="on" before paint, but turns it off again after 3 s if the controller has not
// said it is ready, and the dev server can take longer than that to compile this scene. This sibling runs before the
// controller's effect and puts the same flag back (never under reduced motion), so the A13 test does not depend on timing.
function EngineOn() {
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.setAttribute("data-motion", "on");
    }
  }, []);
  return null;
}

const wrap = (images: { src: string; alt: string }[]): ReactNode => (
  <div data-testid="harness-scroll-collage">
    <div className="h-svh" />
    <ScrollCollage images={images}>
      <p className="m-0 text-body text-ink">{STATEMENT}</p>
    </ScrollCollage>
    <div className="h-svh" />
    <EngineOn />
    <MotionController />
  </div>
);

export const scenes: Scenes = {
  decorative: () => wrap(IMAGES.slice(0, 5).map((image) => ({ src: image.src, alt: "" }))),
  named: () => wrap(IMAGES.slice(0, 5)),
};

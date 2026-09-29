"use client";

import { JourneySegment, type JourneySegmentState } from "../../../components/journey/journey-segment";
import type { Scenes, SceneContext } from "../scene-types";

const one = (state: JourneySegmentState, filled: boolean) =>
  function Scene(ctx: SceneContext) {
    const b = ctx.copy.bar;
    return (
      <div data-testid="harness-segment" className="w-column max-w-full h-bar bg-ivory flex">
        <div className="flex-1 min-w-0">
          <JourneySegment
            label={b.destination.label}
            placeholder={b.destination.empty}
            value={filled ? ctx.fixtures.destinations[0].name : undefined}
            state={state}
            ariaDescribedBy="segment-alert"
          />
        </div>
      </div>
    );
  };

export const scenes: Scenes = {
  empty: one("empty", false),
  hover: one("hover", false),
  open: one("open", true),
  filled: one("filled", true),
  missing: one("missing", false),
};

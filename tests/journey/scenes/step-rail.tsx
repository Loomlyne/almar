"use client";

import { StepRail, type StepNumber } from "../../../components/journey/step-rail";
import type { Scenes, SceneContext } from "../scene-types";

const at = (current: StepNumber, layout: "rail" | "phone") =>
  function Scene(ctx: SceneContext) {
    return (
      <div data-testid="harness-step-rail" className="w-column max-w-full">
        <StepRail
          current={current}
          layout={layout}
          copy={ctx.copy}
          onChange={() => undefined}
        />
      </div>
    );
  };

export const scenes: Scenes = {
  "step-1": at(1, "rail"),
  "step-2": at(2, "rail"),
  "step-3": at(3, "rail"),
  "step-4": at(4, "rail"),
  "phone-1": at(1, "phone"),
  "phone-2": at(2, "phone"),
  "phone-3": at(3, "phone"),
  "phone-4": at(4, "phone"),
};

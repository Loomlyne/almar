"use client";

import { PortraitCard } from "../../../components/ui/card";
import { PinIcon } from "../../../components/icons/icons";
import type { Scenes } from "../scene-types";
import { IMAGES } from "./_images";

// PortraitCard options (plan 03.3-13, S2-21 case B): an article with the square ratio and capitals, beside job 11's default link card.

export const scenes: Scenes = {
  options: ({ locale }) => (
    <div className="mx-auto grid w-full max-w-column gap-4 p-4">
      <div data-testid="option-card">
        <PortraitCard
          ratio="square"
          uppercase
          image={IMAGES[0]}
          title={locale === "ar" ? "ميديلين" : "Medellín"}
          facts={[{ icon: <PinIcon size={16} />, text: "[Region]" }]}
        />
      </div>
      <div data-testid="default-card">
        <PortraitCard href="#default" image={IMAGES[1]} title="[Default card]" facts={[{ icon: <PinIcon size={16} />, text: "[Fact]" }]} />
      </div>
    </div>
  ),
};

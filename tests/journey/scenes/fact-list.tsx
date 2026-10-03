"use client";

import { FactList } from "../../../components/ui/fact-list";
import type { Scenes } from "../scene-types";

const FACTS = [
  { label: "[Guests]", value: "[10]" },
  { label: "[Bedrooms]", value: "[5]" },
  { label: "[Bathrooms]", value: "[4]" },
  { label: "[Beds]", value: "[6]" },
];
const AMENITIES = ["[Amenity 1]", "[Amenity 2]", "[Amenity 3]", "[Amenity 4]"].map((value) => ({
  value,
  icon: true,
}));

export const scenes: Scenes = {
  "one-column": () => (
    <div data-testid="harness-facts" className="mx-auto w-full max-w-column p-4">
      <FactList items={FACTS} />
    </div>
  ),
  "two-columns": () => (
    <div data-testid="harness-facts" className="mx-auto w-full max-w-column p-4">
      <FactList items={AMENITIES} columns={2} />
    </div>
  ),
};

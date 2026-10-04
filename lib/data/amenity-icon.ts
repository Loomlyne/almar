// lib/data/amenity-icon.ts
//
// Pure: no fs, no imports but types. Framer draws an icon per amenity; this keeps the icon a data fact, so
// Phase 3.2 can store the key on the row and no component decides it. The key comes from the ENGLISH label
// (the same index in every locale), by ordered keyword rules: the first rule that matches wins.

import type { AmenityIcon } from "./types";

export const AMENITY_ICON_RULES: ReadonlyArray<readonly [RegExp, AmenityIcon]> = [
  [/pool table/i, "lounge"],
  [/pool|jacuzzi/i, "pool"],
  [/wi-?fi|internet/i, "wifi"],
  [/hot water/i, "water"],
  [/\btv\b/i, "tv"],
  [/air condition/i, "air"],
  [/kitchen|chef/i, "kitchen"],
  [/bbq|barbecue|grill/i, "grill"],
  [/security|guard|gated/i, "security"],
  [/parking|dock/i, "parking"],
  [/terrace|rooftop|patio|gazebo|green|garden|hammock|river/i, "outdoor"],
  [/living|dining|lounge|social|speaker|bounce/i, "lounge"],
  [/butler/i, "service"],
];

/** The icon key for an English amenity label; "check" when no rule matches. */
export function amenityIcon(englishLabel: string): AmenityIcon {
  for (const [re, icon] of AMENITY_ICON_RULES) if (re.test(englishLabel)) return icon;
  return "check";
}

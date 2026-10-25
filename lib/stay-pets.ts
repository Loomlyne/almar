// STAY-05: the stored pets rule as the stay page's facts row words it. Pure.

import { fill } from "./journey-format";
import type { Stay } from "./data/types";

type PetsCopy = { allowed: string; notAllowed: string; fee: string };

/** Null (no fact is drawn) when the owner has set no rule, or a fee rule has no fee. The fee always has two decimals. */
export function petsText(stay: Pick<Stay, "pets_rule" | "pets_fee_aed">, copy: PetsCopy): string | null {
  if (stay.pets_rule === "allowed") return copy.allowed;
  if (stay.pets_rule === "not_allowed") return copy.notAllowed;
  if (stay.pets_rule === "fee" && stay.pets_fee_aed !== null) {
    return fill(copy.fee, { amount: stay.pets_fee_aed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
  }
  return null;
}

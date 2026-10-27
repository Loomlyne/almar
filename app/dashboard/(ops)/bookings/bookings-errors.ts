// Plan 04-09 Task 7: an owner-API failure said in words. The booking sentences come first (conflicts and the field
// checks the dialogs also make), then the kit's fixed sentence per code. A dropped connection or an unreadable reply
// says the caller's own fallback. Pure: no React, no fetch.
import { errorText } from "../../../../components/ops/error-text";
import type { OpsError } from "../../../../components/ops/api-types";
import type { OpsBookingsCopy } from "../../../../lib/copy/ops-bookings";
import type { OpsKitCopy } from "../../../../lib/copy/ops-kit";

const CONFLICTS = [
  "changed",
  "not_found",
  "not_allowed",
  "not_requested",
  "not_applicable",
  "nothing_to_write_off",
  "not_voidable",
  "cancel_first",
  "window_missing",
  "nights_lost",
] as const;

const FIELDS: Record<string, "amount" | "reference" | "reason" | "note" | "attentionNote"> = {
  amount: "amount",
  bank_reference: "reference",
  accept_reason: "reason",
  reason: "reason",
  body: "note",
  note: "attentionNote",
};

export function bookingError(copy: OpsBookingsCopy, kit: OpsKitCopy, error: OpsError, fallback: string): string {
  const E = copy.errors;
  if ((CONFLICTS as readonly string[]).includes(error.code)) return E[error.code as (typeof CONFLICTS)[number]];
  if (error.code === "invalid" && error.field && FIELDS[error.field]) return E[FIELDS[error.field]];
  if (error.code === "unavailable" || error.code === "network" || error.code === "timeout") return fallback;
  return errorText(kit, error);
}

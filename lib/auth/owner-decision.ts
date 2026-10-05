// Plan 03.2-01 (C-19): the pure rule behind requireOwner(). One import, no framework, so node tests load it directly.
import { isOwnerProfile } from "./rules";

export type OwnerDecision = "ok" | "not_owner" | "unavailable";

/**
 * Who may call an owner endpoint. In this order: the request must be on the ops host (the shell header is set by the
 * middleware only, a client copy is dropped); the session profile must be the owner (role owner AND the owner email,
 * isOwnerProfile); the service-role client must exist. Anything else is refused.
 */
export function ownerDecision(input: {
  shell: string | null;
  profile: { role: string; email: string } | null;
  hasAdmin: boolean;
}): OwnerDecision {
  if (input.shell !== "ops") return "not_owner";
  if (!isOwnerProfile(input.profile)) return "not_owner";
  if (!input.hasAdmin) return "unavailable";
  return "ok";
}

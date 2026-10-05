import type { NavAccount } from "../../components/ui/account-menu";
import type { SessionProfile } from "../supabase/clients";
import { isOwnerProfile } from "./rules";

/** The route that issues a fresh one-time handoff to the ops host (plan 02-04, TOUCHWORD). */
export const HANDOFF_START = "/auth/handoff/start";

/** Board 6e: the trigger shows her name, or her email while the name is empty. */
export function navAccount(profile: SessionProfile | null): NavAccount | null {
  if (!profile) return null;
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  return { name: name || profile.email, email: profile.email, ...(isOwnerProfile(profile) ? { opsHref: HANDOFF_START } : {}) };
}

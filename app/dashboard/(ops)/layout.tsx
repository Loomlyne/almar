import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { OpsShell } from "./ops-shell";
import { SHELL_HEADER } from "../../../lib/host";
import { isOwnerProfile } from "../../../lib/auth/rules";
import { OPS_PATH_HEADER, isLiveOpsPath } from "../../../lib/ops-routes";
import { readSessionProfile } from "../../../lib/supabase/clients";

export const dynamic = "force-dynamic";

/**
 * Plan 02-04 owner gate. On the ops host (middleware sets the shell header) only the owner session
 * gets in; anyone else goes to `/sign-in`, the ops sign-in there. The marketing host never serves
 * this tree in production (middleware 404, and notFound here as a second wall). The dev server
 * without the ops host keeps the drawn screens for review.
 *
 * Plan 03.2-03: for the owner on the ops host, a section's page renders only when lib/ops-routes.ts lists it in
 * OPS_LIVE_SECTIONS (the path comes from the header the middleware sets); every other section keeps job 02's
 * "Not ready." state. The gate keeps unwired screens out of production (C-18: every shown control works); a screens
 * plan adds its section to the list in the commit that wires it.
 */
export default async function OpsLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const opsHost = requestHeaders.get(SHELL_HEADER) === "ops";
  if (!opsHost) {
    if (process.env.NODE_ENV === "production") notFound();
    return <OpsShell mode="preview">{children}</OpsShell>;
  }
  if (!isOwnerProfile(await readSessionProfile())) redirect("/sign-in");
  const path = requestHeaders.get(OPS_PATH_HEADER) ?? "";
  return <OpsShell mode="ops">{isLiveOpsPath(path) ? children : null}</OpsShell>;
}

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { OpsShell } from "./ops-shell";
import { SHELL_HEADER } from "../../../lib/host";
import { isOwnerProfile } from "../../../lib/auth/rules";
import { readSessionProfile } from "../../../lib/supabase/clients";

export const dynamic = "force-dynamic";

/**
 * Plan 02-04 owner gate. On the ops host (middleware sets the shell header) only the owner session
 * gets in; anyone else goes to `/sign-in`, the ops sign-in there. The marketing host never serves
 * this tree in production (middleware 404, and notFound here as a second wall). The dev server
 * without the ops host keeps the drawn screens for review.
 */
export default async function OpsLayout({ children }: { children: ReactNode }) {
  const opsHost = (await headers()).get(SHELL_HEADER) === "ops";
  if (!opsHost) {
    if (process.env.NODE_ENV === "production") notFound();
    return <OpsShell mode="preview">{children}</OpsShell>;
  }
  if (!isOwnerProfile(await readSessionProfile())) redirect("/sign-in");
  return <OpsShell mode="ops">{null}</OpsShell>;
}

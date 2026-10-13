import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { OpsShell } from "./ops-shell";
import { SHELL_HEADER } from "../../../lib/host";
import { isOwnerProfile } from "../../../lib/auth/rules";
import { OPS_PATH_HEADER, isLiveOpsPath } from "../../../lib/ops-routes";
import { readSessionProfile } from "../../../lib/supabase/clients";
import { brandCss } from "../../../lib/site-settings";
import { logoMediaUrl, readSiteSettings, siteSettingsEnv } from "../../../lib/site-settings-read";

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
 *
 * Plan 02-06 (D-110, D-113, D-116): the dashboard wears the saved brand. The settings row is read on every request (one
 * owner; a save shows on her next page), its colours become CSS variables and a saved logo replaces the wordmark. A
 * failed read keeps the design system.
 */
async function OpsBrand(): Promise<{ style: ReactNode; logoSrc: string | null }> {
  const settings = await readSiteSettings(siteSettingsEnv(), { maxAgeMs: 0 });
  const css = settings ? brandCss(settings) : "";
  return {
    // Only #rrggbb values and fixed names reach brandCss (parseSiteSettingsRow): no character React would escape.
    style: css ? <style id="almar-brand">{css}</style> : null,
    logoSrc: settings ? logoMediaUrl(settings.logoKey) : null,
  };
}

export default async function OpsLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const opsHost = requestHeaders.get(SHELL_HEADER) === "ops";
  if (!opsHost) {
    if (process.env.NODE_ENV === "production") notFound();
    return <OpsShell mode="preview">{children}</OpsShell>;
  }
  if (!isOwnerProfile(await readSessionProfile())) redirect("/sign-in");
  const path = requestHeaders.get(OPS_PATH_HEADER) ?? "";
  const brand = await OpsBrand();
  return (
    <>
      {brand.style}
      <OpsShell mode="ops" logoSrc={brand.logoSrc}>
        {isLiveOpsPath(path) ? children : null}
      </OpsShell>
    </>
  );
}

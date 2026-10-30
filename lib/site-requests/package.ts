// The package request (plan 06-06, BOOK-05, F-01, T-06-06-01..03): the form's field names, the browser's check, the email lines and
// the server's prepare hook for 06-05's handleSiteRequestPost. Pure apart from the injected `admin`: no Supabase import, no email,
// no money. The field rules are all validateSiteRequest("package")'s (one validator); only the allowed-cities check is added here,
// and the SQL (submit_site_request, site_request_payload_ok) stays the last word. The package name in the email comes from the
// stored row, never from the guest.

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanLine } from "../contact-inquiry";
import { absoluteLocaleUrl } from "../locale-path";
import type { PrepareRequest } from "./submit";
import type { PackageRequest } from "./types";
import { REQUEST_FIELD, validateSiteRequest, type RequestErrors, type RequestFields, type RequestPayload } from "./validate";

/** The package form's names: 06-05's REQUEST_FIELD. Notes are `Trip Notes`, never a honeypot name. */
export const PACKAGE_REQUEST_FIELD = {
  kind: REQUEST_FIELD.kind,
  locale: REQUEST_FIELD.locale,
  tier: REQUEST_FIELD.tier,
  from: REQUEST_FIELD.from,
  to: REQUEST_FIELD.to,
  guests: REQUEST_FIELD.guests,
  cities: REQUEST_FIELD.cities,
  notes: REQUEST_FIELD.tripNotes,
  name: REQUEST_FIELD.name,
  email: REQUEST_FIELD.email,
  phone: REQUEST_FIELD.phone,
} as const;

export type PackageRequestCheck = { ok: true; request: PackageRequest } | { ok: false; errors: RequestErrors };

/** validateSiteRequest("package") unchanged, then a city not among `allowedCities` is refused. */
export function parsePackageRequest(fields: RequestFields, { allowedCities }: { allowedCities: readonly string[] }): PackageRequestCheck {
  const checked = validateSiteRequest("package", fields);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  const cities = (checked.payload.cities ?? []) as string[];
  if (cities.some((city) => !allowedCities.includes(city))) return { ok: false, errors: { cities: "invalid" } };
  return { ok: true, request: checked.payload as unknown as PackageRequest };
}

/**
 * What 06-05's email does not print from the payload: the stored package name and the page address. Its payload lines already
 * hold the dates, guests, cities, notes and phone. No money line: a package request carries none.
 */
export function packageEmailLines({ packageName, pageUrl }: { packageName: string; pageUrl: string }): string[] {
  return [`Package name: ${cleanLine(packageName)}`, `Page: ${pageUrl}`];
}

/** The server-side check: reads only. An unknown or hidden package, or a city outside its legs, saves nothing and sends nothing. */
export const preparePackageRequest: PrepareRequest = async (_kind, payload, admin) => {
  try {
    return await checkPackage(payload, admin);
  } catch {
    return { ok: false };
  }
};

async function checkPackage(payload: RequestPayload, admin: SupabaseClient): ReturnType<PrepareRequest> {
  const slug = String(payload.tier_slug ?? "");
  const tier = await admin.from("journey_tiers").select("id").eq("slug", slug).eq("is_published", true).maybeSingle();
  const tierId = (tier.data as { id?: unknown } | null)?.id;
  if (tier.error || typeof tierId !== "string") return { ok: false };

  const stored = await admin.from("journey_tier_translations").select("name").eq("tier_id", tierId).eq("locale", "en").maybeSingle();
  const packageName = (stored.data as { name?: unknown } | null)?.name;
  if (stored.error || typeof packageName !== "string") return { ok: false };

  const cities = Array.isArray(payload.cities) ? payload.cities : [];
  if (cities.length > 0) {
    const allowed = await legNames(admin, tierId);
    if (allowed === null) return { ok: false };
    if (cities.some((city) => !allowed.has(city))) return { ok: false, errors: { cities: "invalid" } };
  }
  return { ok: true, emailLines: packageEmailLines({ packageName, pageUrl: absoluteLocaleUrl("en", `/journeys/${slug}`) }) };
}

/** The names, in every language, of this package's cities that are on the site (the page offers the ones in its own language). */
async function legNames(admin: SupabaseClient, tierId: string): Promise<Set<string> | null> {
  const legs = await admin.from("journey_tier_legs").select("destination_id").eq("tier_id", tierId);
  if (legs.error) return null;
  const wanted = [...new Set(((legs.data ?? []) as { destination_id: string }[]).map((leg) => leg.destination_id))];
  if (wanted.length === 0) return new Set();
  const live = await admin.from("destinations").select("id").in("id", wanted).eq("is_published", true);
  if (live.error) return null;
  const ids = ((live.data ?? []) as { id: string }[]).map((row) => row.id);
  if (ids.length === 0) return new Set();
  const names = await admin.from("destination_translations").select("name").in("destination_id", ids);
  if (names.error) return null;
  return new Set(((names.data ?? []) as { name: string }[]).map((row) => cleanLine(row.name)));
}

/** The WhatsApp message of the page's "Something else?" link: the greeting with the name, then the address. Takes no money field. */
export function buildPackageAskMessage({ name, pageUrl }: { name: string; pageUrl: string }, copy: { waMessage: string }): string {
  return `${copy.waMessage.replace("{name}", name)}\n${pageUrl}`;
}

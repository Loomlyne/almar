// lib/data/catalog-filter.ts
//
// The one implementation of CatalogFilter (design 3.2). Pure. Used by getCatalogItems on the server and by the
// /experiences browser, so server and client can never disagree. This, ./stay-filter and ./types are the only
// lib/data modules a "use client" file may import.

import type { CatalogItem, CatalogKind } from "./types";
import { foldText } from "./stay-filter";

export type CatalogFilter = {
  kind?: CatalogKind;
  /** Any-of. Empty or absent: no constraint. */
  destinations?: string[];
  /** Any-of. Empty or absent: no constraint. */
  stays?: string[];
  /** Case- and accent-insensitive substring of name or summary. */
  query?: string;
};

export type CatalogFilterable = Pick<CatalogItem, "kind" | "name" | "summary" | "destination_slugs" | "stay_slugs">;

export function matchesCatalogFilter(item: CatalogFilterable, f: CatalogFilter): boolean {
  if (f.kind && item.kind !== f.kind) return false;
  if (f.destinations && f.destinations.length > 0 && !f.destinations.some((d) => item.destination_slugs.includes(d))) {
    return false;
  }
  if (f.stays && f.stays.length > 0 && !f.stays.some((s) => item.stay_slugs.includes(s))) return false;
  const q = f.query ? foldText(f.query.trim()) : "";
  if (q && !foldText(item.name).includes(q) && !foldText(item.summary ?? "").includes(q)) return false;
  return true;
}

export function filterCatalog<T extends CatalogFilterable>(items: readonly T[], f: CatalogFilter): T[] {
  return items.filter((i) => matchesCatalogFilter(i, f));
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LIST = 20;

/** The /experiences address state. Search text is never in the URL. */
export type CatalogQuery = { kind?: CatalogKind; destinations: string[]; stays: string[]; item?: string };

function list(raw: string | null, allow?: readonly string[]): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const v = part.trim();
    if (!SLUG.test(v) || out.includes(v)) continue;
    if (allow && !allow.includes(v)) continue;
    out.push(v);
    if (out.length === MAX_LIST) break;
  }
  return out;
}

export function parseCatalogQuery(
  params: URLSearchParams,
  opts?: { destinations?: readonly string[]; stays?: readonly string[]; items?: readonly string[] },
): CatalogQuery {
  const type = params.get("type");
  const kind: CatalogKind | undefined = type === "experience" || type === "service" ? type : undefined;
  const itemRaw = params.get("item");
  const item = itemRaw && SLUG.test(itemRaw) && (!opts?.items || opts.items.includes(itemRaw)) ? itemRaw : undefined;
  const q: CatalogQuery = {
    destinations: list(params.get("destination"), opts?.destinations),
    stays: list(params.get("stay"), opts?.stays),
  };
  if (kind) q.kind = kind;
  if (item) q.item = item;
  return q;
}

/** "" or "?type=…&destination=a,b&stay=x&item=…". Slugs need no encoding; non-slug values are dropped. */
export function toCatalogQuery(q: CatalogQuery): string {
  const parts: string[] = [];
  if (q.kind === "experience" || q.kind === "service") parts.push(`type=${q.kind}`);
  const d = q.destinations.filter((v) => SLUG.test(v));
  if (d.length) parts.push(`destination=${d.join(",")}`);
  const s = q.stays.filter((v) => SLUG.test(v));
  if (s.length) parts.push(`stay=${s.join(",")}`);
  if (q.item && SLUG.test(q.item)) parts.push(`item=${q.item}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

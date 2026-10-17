// Catalog -> Stays, connected: what the screen builds from the replies of /api/ops/stays, /api/ops/catalog and
// /api/ops/destinations. Pure (no React, no fetch), so node tests can hold it.

import type { LiveFields, Target } from "../../../../../components/ops/auto-translate";
import type { CatalogSummary, DestinationSummary, Locale3, PublishWarningCode, StayDetail, StaySummary } from "../../../../../components/ops/api-types";
import type { CatalogChoice, DestinationChoice } from "./stay-editor";
import { STAY_LINES, STAY_LISTS } from "./stay-forms";
import type { StayRow } from "./stays-list";

/**
 * The list rows, in the server's order (position). The connected count comes from each stay's own ids: the list reply has
 * none, and a catalog row carries only a `stay_count`, so the screen reads every stay once (contract 5.2 `?id=`).
 */
export function stayRows(summaries: StaySummary[], details: ReadonlyMap<string, StayDetail>): StayRow[] {
  return [...summaries]
    .sort((a, b) => a.position - b.position)
    .map((one) => {
      const detail = details.get(one.id);
      return {
        id: one.id,
        name: one.title_en,
        destinationId: one.destination_id,
        destinationName: one.destination_name_en,
        connected: detail ? detail.experience_ids.length + detail.service_ids.length : 0,
        published: one.is_published,
      };
    });
}

export function destinationChoices(destinations: DestinationSummary[]): DestinationChoice[] {
  return [...destinations].sort((a, b) => a.position - b.position).map((one) => ({ id: one.id, name: one.name_en, published: one.is_published }));
}

/** Experiences first, then services, each in its own order: the order the picker offers them. */
export function catalogChoices(catalog: CatalogSummary[]): CatalogChoice[] {
  const rank = (one: CatalogSummary) => (one.kind === "experience" ? 0 : 1);
  return [...catalog].sort((a, b) => rank(a) - rank(b) || a.position - b.position).map((one) => ({ id: one.id, name: one.name_en, kind: one.kind }));
}

/** The items connected to a destination: shown read-only on its stays ("From the destination"), not offered. */
export function destinationItemIds(catalog: CatalogSummary[], destinationId: string): string[] {
  if (destinationId === "") return [];
  return catalogChoices(catalog.filter((one) => one.destination_ids.includes(destinationId))).map((one) => one.id);
}

/**
 * The Arabic and Spanish fields live on the site now: a language whose status is published, and in it every field with
 * text. The kit asks before a Save would empty one, and saves nothing when a translation fails on one.
 */
export function liveStayFields(stay: StayDetail | null): LiveFields {
  const live: LiveFields = {};
  if (!stay) return live;
  for (const target of ["ar", "es"] as Target[]) {
    const record = stay.translations[target];
    if (!record || record.status !== "published") continue;
    const filled: string[] = [];
    for (const name of STAY_LINES) if ((record[name] ?? "").trim() !== "") filled.push(name);
    for (const name of STAY_LISTS) if (record[name].some((line) => line.trim() !== "")) filled.push(name);
    live[target] = filled;
  }
  return live;
}

/** Which languages are published now: Save keeps them published (kit B status rule). */
export function liveLanguages(stay: StayDetail | null): Partial<Record<Locale3, boolean>> {
  if (!stay) return {};
  return { en: stay.translations.en?.status === "published", ar: stay.translations.ar?.status === "published", es: stay.translations.es?.status === "published" };
}

/** A published stay with no base nightly rate is on the site but cannot be booked (C-12): the page says so. */
export function stayWarnings(stay: StayDetail | null): PublishWarningCode[] {
  return stay && stay.is_published && stay.base_nightly_rate_aed === null ? ["no_base_rate"] : [];
}

/** The ids of every stay with `id` moved one place up (-1) or down (1); the same list when it cannot move. */
export function movedOrder(ids: string[], id: string, by: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

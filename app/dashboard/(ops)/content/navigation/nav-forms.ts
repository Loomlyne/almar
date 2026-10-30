// The pure side of Content -> Navigation and footer (plan 06-02, CMS-09, F-15): a header or footer link as form state,
// the area body of POST /api/ops/nav (the area's list is replaced whole, in order), the link rules the server applies,
// and the target names. No React, no fetch, no directive. Login, currency and language are never links (SITE-01).

import type { Locale3, NavArea, NavLinkDetail } from "../../../../../components/ops/api-types";
import type { Fields, LiveFields, Target } from "../../../../../components/ops/auto-translate";
import type { OpsNavCopy } from "../../../../../lib/copy/ops-nav";
import { NAV_TARGET_KEYS, isNavTarget, journeySlug, type NavTargetKey } from "../../../../../lib/site-nav";
import type { NavTargetOption } from "../../../../../lib/ops/site-pages-handlers";
import { locksOf, noLocks, type Locks } from "../../catalog/catalog-forms";

const TARGETS: readonly Target[] = ["ar", "es"];

/** The label cap of nav_link_translations and the address cap of ops_save_nav. */
export const MAX_LABEL = 80;
export const MAX_URL = 500;
/** ops_save_nav: at most 20 links in one area. */
export const MAX_AREA_LINKS = 20;

export type LinkForm = {
  /** The row's identity in the list while links are added (the id once saved). */
  key: string;
  id: string | null;
  shown: boolean;
  kind: "internal" | "external";
  /** A page key of lib/site-nav.ts or journey:<slug>; "" = none chosen yet. */
  target: string;
  /** As typed, for a web address. */
  url: string;
  text: Record<Locale3, { label: string }>;
  locked: Locks;
};

let count = 0;
const newKey = () => `new-link-${++count}`;

export function emptyLinkForm(): LinkForm {
  return { key: newKey(), id: null, shown: true, kind: "internal", target: "", url: "", text: { en: { label: "" }, ar: { label: "" }, es: { label: "" } }, locked: noLocks() };
}

export function linkForm(detail: NavLinkDetail): LinkForm {
  const label = (locale: Locale3) => ({ label: detail.translations[locale]?.label ?? "" });
  const external = detail.link_kind === "external";
  return {
    key: detail.id,
    id: detail.id,
    shown: detail.is_shown,
    kind: detail.link_kind,
    target: external ? "" : detail.target,
    url: external ? detail.target : "",
    text: { en: label("en"), ar: label("ar"), es: label("es") },
    locked: locksOf(detail.translations),
  };
}

/** The area's links as the server holds them, in order. */
export function areaForms(links: readonly NavLinkDetail[]): LinkForm[] {
  return links
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(linkForm);
}

/** An https address the URL parser takes, with a host, of at most 500 characters (the server's rule). */
export function webOk(url: string): boolean {
  const value = url.trim();
  if (!/^https:\/\/[^\s]+$/i.test(value) || value.length > MAX_URL) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export type LinkProblem = "label" | "target" | "url";

/** What keeps a link from being saved: an English label, a page chosen, or an https address. */
export function linkProblem(form: LinkForm): LinkProblem | null {
  const label = form.text.en.label.trim();
  if (label === "" || label.length > MAX_LABEL) return "label";
  if (form.kind === "internal") return isNavTarget(form.target) ? null : "target";
  return webOk(form.url) ? null : "url";
}

type SentLabel = { label: string; status: "published"; locked_fields?: string[] };

/**
 * One link as POST /api/ops/nav takes it. Every language with a label goes out published (a link has no publish step);
 * an Arabic or Spanish record carries its lock list; an empty one is null (no record).
 */
export function linkBody(form: LinkForm): Record<string, unknown> {
  const translations: Record<string, SentLabel | null> = { en: { label: form.text.en.label.trim(), status: "published" } };
  for (const target of TARGETS) {
    const label = form.text[target].label.trim();
    translations[target] = label === "" ? null : { label, status: "published", locked_fields: form.locked[target].filter((field) => field === "label") };
  }
  const body: Record<string, unknown> = {
    is_shown: form.shown,
    link_kind: form.kind,
    target: form.kind === "internal" ? form.target : form.url.trim(),
    translations,
  };
  if (form.id !== null) body.id = form.id;
  return body;
}

/** The body of POST /api/ops/nav for one area, or the first link that cannot be saved. */
export function areaBody(area: NavArea, links: readonly LinkForm[]): { ok: true; body: { area: NavArea; links: Record<string, unknown>[] } } | { ok: false; key: string; problem: LinkProblem | "too_many" } {
  if (links.length > MAX_AREA_LINKS) return { ok: false, key: links[MAX_AREA_LINKS]?.key ?? "", problem: "too_many" };
  for (const link of links) {
    const problem = linkProblem(link);
    if (problem) return { ok: false, key: link.key, problem };
  }
  return { ok: true, body: { area, links: links.map(linkBody) } };
}

export function linkWithTranslations(form: LinkForm, translations: Record<Target, Fields>, locked: Locks): LinkForm {
  const pick = (target: Target) => {
    const value = translations[target].label;
    if (value === undefined) return form.text[target];
    return { label: Array.isArray(value) ? value.join(" ") : (value ?? "") };
  };
  return { ...form, text: { ...form.text, ar: pick("ar"), es: pick("es") }, locked: { ar: [...locked.ar], es: [...locked.es] } };
}

/** A shown link's saved Arabic and Spanish labels are on the site. */
export function liveLinkFields(saved: LinkForm | null): LiveFields {
  if (!saved || saved.id === null || !saved.shown) return {};
  const live: LiveFields = {};
  for (const target of TARGETS) live[target] = saved.text[target].label.trim() !== "" ? ["label"] : [];
  return live;
}

/** The area with one link replaced (by key) or added at the end. */
export function withLink(links: readonly LinkForm[], link: LinkForm): LinkForm[] {
  return links.some((l) => l.key === link.key) ? links.map((l) => (l.key === link.key ? link : l)) : [...links, link];
}

/** The area after moving one link up or down; out of range: unchanged. */
export function movedLinks(links: readonly LinkForm[], key: string, by: -1 | 1): LinkForm[] {
  const at = links.findIndex((l) => l.key === key);
  const to = at + by;
  if (at < 0 || to < 0 || to >= links.length) return [...links];
  const next = [...links];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** The area in the order of `keys` (a drag); a key not in the list is ignored, a link not named keeps its place at the end. */
export function orderedLinks(links: readonly LinkForm[], keys: readonly string[]): LinkForm[] {
  const byKey = new Map(links.map((l) => [l.key, l]));
  const ordered = keys.flatMap((key) => (byKey.has(key) ? [byKey.get(key) as LinkForm] : []));
  return [...ordered, ...links.filter((l) => !keys.includes(l.key))];
}

const fill = (line: string, values: Record<string, string>) => line.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);

/** The owner's name for a target: the copy's page name, or "Package: {name}". */
export function targetName(copy: OpsNavCopy, key: string, options: readonly NavTargetOption[]): string {
  if ((NAV_TARGET_KEYS as readonly string[]).includes(key)) return copy.targets[key as NavTargetKey];
  const slug = journeySlug(key);
  if (slug !== null) return fill(copy.packageTarget, { name: options.find((o) => o.key === key)?.name ?? slug });
  return key;
}

/** Whether the target's page is on the site now (the server's answer; a key it did not list is not). */
export function targetOnSite(key: string, options: readonly NavTargetOption[]): boolean {
  return options.find((o) => o.key === key)?.available === true;
}


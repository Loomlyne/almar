// Plan 03.2-04: the primitive validators of the owner API (house style of lib/auth/rules.ts: plain TS, no library).
// Each returns the clean value or throws OpsInvalid(field, locale) on the first bad value. Caps mirror the database and
// are never tighter than the content the owner already has (the fixtures' longest texts fit with room). Arabic and
// Spanish are accepted as typed: there is no Latin-only rule anywhere. Lengths count characters, like Postgres
// char_length, not UTF-16 units.

import type { Locale3 } from "../../components/ops/api-types";
import { OpsInvalid } from "./route-core";

/** Contract caps: names and titles 160, labels 120, paragraphs 4,000, lists at most 40 items. */
export const CAPS = { name: 160, label: 120, paragraph: 4000, items: 40 } as const;

const INT_MAX = 2147483647;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** numeric(12, 2): up to 10 digits before the point, no leading zero, at most 2 after. */
const MONEY = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export const LOCALES: readonly Locale3[] = ["en", "ar", "es"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function record(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new OpsInvalid(field);
  return value;
}

/** Throws on the first key not in `allowed`; the field is `prefix` + key. */
export function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], prefix = ""): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new OpsInvalid(`${prefix}${key}`);
  }
}

export function has(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function length(text: string): number {
  return Array.from(text).length;
}

export function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new OpsInvalid(field);
  return value.toLowerCase();
}

export function uuidOrNull(value: unknown, field: string): string | null {
  return value === null ? null : uuid(value, field);
}

/** An array of distinct uuids (compared lowercased), between min and max items. */
export function uuidList(value: unknown, field: string, { min = 0, max = 500 }: { min?: number; max?: number } = {}): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new OpsInvalid(field);
  const out = value.map((item) => uuid(item, field));
  if (new Set(out).size !== out.length) throw new OpsInvalid(field);
  return out;
}

export function slug(value: unknown, field = "slug"): string {
  if (typeof value !== "string") throw new OpsInvalid(field);
  const text = value.trim();
  if (text.length === 0 || text.length > 80 || !SLUG.test(text)) throw new OpsInvalid(field);
  return text;
}

/** AED as a decimal string ("1250.00"), never a number (contract §1.2). Normalised to two decimals. */
export function money(value: unknown, field: string, { positive = false }: { positive?: boolean } = {}): string {
  if (typeof value !== "string" || !MONEY.test(value)) throw new OpsInvalid(field);
  const [whole, cents = ""] = value.split(".");
  const out = `${whole}.${cents.padEnd(2, "0")}`;
  if (positive && /^0\.00$/.test(out)) throw new OpsInvalid(field);
  return out;
}

export function moneyOrNull(value: unknown, field: string, options?: { positive?: boolean }): string | null {
  return value === null ? null : money(value, field, options);
}

/** A calendar day "YYYY-MM-DD" that exists (2026-02-30 does not). */
export function isoDay(value: unknown, field: string): string {
  if (typeof value !== "string") throw new OpsInvalid(field);
  const m = value.match(DAY);
  if (!m) throw new OpsInvalid(field);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) throw new OpsInvalid(field);
  return value;
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

export function addDays(day: string, n: number): string {
  return new Date((dayNumber(day) + n) * 86_400_000).toISOString().slice(0, 10);
}

export function int(value: unknown, field: string, { min = 0, max = INT_MAX }: { min?: number; max?: number } = {}): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new OpsInvalid(field);
  return value;
}

export function intOrNull(value: unknown, field: string, options?: { min?: number; max?: number }): number | null {
  return value === null ? null : int(value, field, options);
}

export function bool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new OpsInvalid(field);
  return value;
}

export function boolOrNull(value: unknown, field: string): boolean | null {
  return value === null ? null : bool(value, field);
}

type TextOptions = { max: number; locale?: Locale3 | null };

/** Optional text: trimmed; empty or null -> null; at most `max` characters. */
export function text(value: unknown, field: string, { max, locale = null }: TextOptions): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new OpsInvalid(field, locale);
  const out = value.trim();
  if (out.length === 0) return null;
  if (length(out) > max) throw new OpsInvalid(field, locale);
  return out;
}

export function requiredText(value: unknown, field: string, options: TextOptions): string {
  const out = text(value, field, options);
  if (out === null) throw new OpsInvalid(field, options.locale ?? null);
  return out;
}

/** Exact text (a password, a door code): not trimmed; empty -> null; at most `max` characters. */
export function rawText(value: unknown, field: string, { max }: { max: number }): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || length(value) > max) throw new OpsInvalid(field);
  return value.length === 0 ? null : value;
}

/** An array of strings, each trimmed and capped; at most CAPS.items items. */
export function textList(
  value: unknown,
  field: string,
  { itemMax, maxItems = CAPS.items, locale = null }: { itemMax: number; maxItems?: number; locale?: Locale3 | null },
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new OpsInvalid(field, locale);
  return value.map((item) => {
    if (typeof item !== "string") throw new OpsInvalid(field, locale);
    const out = item.trim();
    if (length(out) > itemMax) throw new OpsInvalid(field, locale);
    return out;
  });
}

export type TextSpec = {
  /** Filled in every record that is created; never blank when sent. */
  required: readonly string[];
  fields: Record<string, { kind: "text" | "list"; max: number }>;
};

export type TranslationRecord = Record<string, string | string[] | null>;
export type TranslationsPayload = Partial<Record<Locale3, TranslationRecord | null>>;

/**
 * The translations object of a save (contract §1.2): a language absent stays absent (untouched), null deletes that
 * record (never English), an object is upserted with only the keys it carries. English is required on create, with its
 * required fields. `status` is "published" or "draft".
 */
export function translations(value: unknown, spec: TextSpec, { create }: { create: boolean }): TranslationsPayload {
  if (value === undefined && create) throw new OpsInvalid("translations.en", "en");
  if (!isRecord(value)) throw new OpsInvalid("translations");
  for (const key of Object.keys(value)) {
    if (!(LOCALES as readonly string[]).includes(key)) throw new OpsInvalid(`translations.${key}`);
  }
  if (create && !has(value, "en")) throw new OpsInvalid("translations.en", "en");

  const out: TranslationsPayload = {};
  for (const locale of LOCALES) {
    if (!has(value, locale)) continue;
    const raw = value[locale];
    const base = `translations.${locale}`;
    if (raw === null) {
      if (locale === "en") throw new OpsInvalid(base, locale);
      out[locale] = null;
      continue;
    }
    if (!isRecord(raw)) throw new OpsInvalid(base, locale);
    const rec: TranslationRecord = {};
    for (const [key, item] of Object.entries(raw)) {
      const field = `${base}.${key}`;
      if (key === "status") {
        if (item !== "published" && item !== "draft") throw new OpsInvalid(field, locale);
        rec.status = item;
        continue;
      }
      // Own properties only: an inherited name ("constructor", "__proto__") is not a field.
      const rule = has(spec.fields, key) ? spec.fields[key] : undefined;
      if (!rule) throw new OpsInvalid(field, locale);
      if (rule.kind === "list") {
        rec[key] = textList(item, field, { itemMax: rule.max, locale });
      } else if (spec.required.includes(key)) {
        rec[key] = requiredText(item, field, { max: rule.max, locale });
      } else {
        rec[key] = text(item, field, { max: rule.max, locale });
      }
    }
    if (create && locale === "en") {
      for (const key of spec.required) {
        if (!has(rec, key)) throw new OpsInvalid(`${base}.${key}`, locale);
      }
    }
    out[locale] = rec;
  }
  return out;
}

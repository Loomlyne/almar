// Automatic translation for the kit editor (owner, 2026-10-14, decision 2026-10-14-auto-translate-and-panel-redesign).
// Maria writes English only. On Save the editor asks the 03.2-10 route (POST /api/ops/translate, contract 5.11) for
// Arabic and Spanish of the English fields that changed or have no translation yet, and saves them with the English.
// Pure: no React, no fetch. The editor passes `send` (opsSend from ops-client.ts); node tests pass a fake.

import type { OpsResponse } from "./ops-client";

export type Target = "ar" | "es";
export type FieldValue = string | string[] | null;
/** Field name -> value, the names the translate route accepts (lowercase snake_case, e.g. `short_line`, `alt`). */
export type Fields = Record<string, FieldValue>;
export type TranslateReply = { target: Target; fields: Record<string, string | string[]>; left?: string[] };
export type Send = (path: "/api/ops/translate", body: unknown, options: { timeoutMs: number }) => Promise<OpsResponse<TranslateReply>>;

export const TARGETS: readonly Target[] = ["ar", "es"];

/** How long one request may take before it is given up as failed; a stalled AI call otherwise holds Save ~100 s. */
export const TRANSLATE_TIMEOUT_MS = 45_000;

/** Why a translation did not finish, in the words the alert uses. */
export type FailReason = "limit" | "busy" | "failed";

const isBlank = (value: FieldValue | undefined): boolean =>
  value === null || value === undefined || (Array.isArray(value) ? value.every((item) => item.trim() === "") : value.trim() === "");

/** A value the route can take: a string with text, or a list whose every item has text (its length is the contract). */
export function sendable(value: FieldValue | undefined): value is string | string[] {
  if (typeof value === "string") return value.trim() !== "";
  return Array.isArray(value) && value.length > 0 && value.every((item) => item.trim() !== "");
}

const same = (a: FieldValue | undefined, b: FieldValue | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** `${target}:${field}`: a translation the owner typed herself since the last save; the AI leaves it alone. */
export const touchKey = (target: Target, field: string) => `${target}:${field}`;

export type TranslationPlan = {
  /** What is sent per target. A target with no field is not asked. */
  send: Record<Target, Record<string, string | string[]>>;
  /** Translations that no longer match their English (the English was emptied): saved as empty. */
  clear: Record<Target, string[]>;
};

/**
 * What one Save asks for. A field is sent for a target when its English has text, the owner did not type that
 * translation herself, and either the English changed since the last save or the translation is empty (a new item, an
 * earlier failure, a row that never had one). An English emptied since the last save empties its translations too.
 */
export function planTranslation(english: Fields, savedEnglish: Fields, translations: Record<Target, Fields>, touched: ReadonlySet<string>): TranslationPlan {
  const plan: TranslationPlan = { send: { ar: {}, es: {} }, clear: { ar: [], es: [] } };
  for (const [name, value] of Object.entries(english)) {
    const changed = !same(value, savedEnglish[name]);
    for (const target of TARGETS) {
      if (touched.has(touchKey(target, name))) continue;
      const current = translations[target][name];
      if (sendable(value)) {
        if (changed || isBlank(current)) plan.send[target][name] = value;
      } else if (changed && isBlank(value) && !isBlank(current)) {
        plan.clear[target].push(name);
      }
    }
  }
  return plan;
}

/** True when this Save will ask the AI for anything. */
export const plansAnything = (plan: TranslationPlan) => TARGETS.some((target) => Object.keys(plan.send[target]).length > 0);

/** The fields still waiting for a translation: their Arabic or Spanish gap is filled by the next Save, not by Maria. */
export function pendingFields(plan: TranslationPlan): Record<Target, Set<string>> {
  return { ar: new Set(Object.keys(plan.send.ar)), es: new Set(Object.keys(plan.send.es)) };
}

/** The Arabic and Spanish fields that are published on the site now, per target (the screen knows from its row). */
export type LiveFields = Partial<Record<Target, readonly string[]>>;

/** A published translation by language and field name, in the shape of the missing list. */
export type LiveGap = { locale: Target; field: string };

/** The published translations that are empty in `translations`. */
export function blankLive(live: LiveFields, translations: Record<Target, Fields>): LiveGap[] {
  const out: LiveGap[] = [];
  for (const target of TARGETS) for (const field of live[target] ?? []) if (isBlank(translations[target][field])) out.push({ locale: target, field });
  return out;
}

/**
 * The published translations this Save would leave empty on purpose: typed empty by hand (the AI is not asked for
 * them), or emptied with their English. A blank the plan sends for is not counted: the AI fills it, and if it fails
 * nothing is saved.
 */
export function emptiedLive(live: LiveFields, translations: Record<Target, Fields>, plan: TranslationPlan): LiveGap[] {
  return blankLive(live, translations)
    .filter((gap) => !(gap.field in plan.send[gap.locale]))
    .concat(TARGETS.flatMap((target) => plan.clear[target].filter((field) => (live[target] ?? []).includes(field)).map((field) => ({ locale: target, field }))));
}

export type TranslationOutcome = {
  /** Every translation after this Save: the fills applied, a failed field emptied (its old text is of old English). */
  translations: Record<Target, Fields>;
  /** Every field that was asked came back. */
  complete: boolean;
  /** Something was asked (the "updated" line is said only then). */
  asked: boolean;
  reason: FailReason | null;
};

const isLimit = (r: OpsResponse<TranslateReply> | null) => r !== null && !r.ok && r.status === 429 && r.error.code === "translate_limit";
const isBusy = (r: OpsResponse<TranslateReply> | null) => r !== null && !r.ok && r.error.code === "translate_busy";

/** A returned value that fits the screen's limit (its maxLength, e.g. 300 for an alt text), per string or list item. */
const fits = (value: string | string[], max: number | undefined) =>
  max === undefined || (Array.isArray(value) ? value.every((item) => item.length <= max) : value.length <= max);

/**
 * Applies the two answers (null: that target was not asked, or its request threw). A field that came back fills its
 * translation; a field asked and not returned (a failed target, named in `left`, or longer than `maxLength` allows) is
 * emptied, so an Arabic or Spanish text of the old English never stays and the server never refuses the save for a
 * length the owner did not type. The reason: the daily limit before busy before any other failure.
 */
export function applyReplies(
  plan: TranslationPlan,
  translations: Record<Target, Fields>,
  replies: Record<Target, OpsResponse<TranslateReply> | null>,
  maxLength: Record<string, number | undefined> = {},
): TranslationOutcome {
  const next: Record<Target, Fields> = { ar: { ...translations.ar }, es: { ...translations.es } };
  let complete = true;
  for (const target of TARGETS) {
    for (const name of plan.clear[target]) next[target][name] = null;
    const asked = Object.keys(plan.send[target]);
    if (asked.length === 0) continue;
    const reply = replies[target];
    const got = reply?.ok === true ? reply.fields : {};
    for (const name of asked) {
      const value = got[name];
      if (sendable(value) && fits(value, maxLength[name])) next[target][name] = value;
      else {
        next[target][name] = null;
        complete = false;
      }
    }
  }
  const answers = TARGETS.map((target) => replies[target]);
  const reason: FailReason | null = complete ? null : answers.some(isLimit) ? "limit" : answers.some(isBusy) ? "busy" : "failed";
  return { translations: next, complete, asked: plansAnything(plan), reason };
}

/** The two requests, in parallel, each through `send` with the timeout. A target with nothing to send is not asked. */
export async function requestTranslations(plan: TranslationPlan, send: Send): Promise<Record<Target, OpsResponse<TranslateReply> | null>> {
  const settled = await Promise.allSettled(
    TARGETS.map((target) =>
      Object.keys(plan.send[target]).length === 0
        ? Promise.resolve(null)
        : send("/api/ops/translate", { target, fields: plan.send[target] }, { timeoutMs: TRANSLATE_TIMEOUT_MS }),
    ),
  );
  const [ar, es] = settled.map((one) => (one.status === "fulfilled" ? one.value : null));
  return { ar: ar ?? null, es: es ?? null };
}

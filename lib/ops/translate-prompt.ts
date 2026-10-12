// The translation prompt, plan 03.2-10. One source for the Wave 0 check Worker (scripts/translate-check/worker.ts) and
// the production route (/api/ops/translate, Task 2): the system prompt per target, the user message, the JSON schema
// the model must follow, and the shape check its answer must pass. Pure: no binding, no network, no React.

export type TranslateTarget = "ar" | "es";
export type TranslateFields = Record<string, string | string[]>;

/** Kept exactly as written in every language (C-06). */
export const KEEP_UNCHANGED = [
  "ALMAR",
  "Getsemaní",
  "Cartagena",
  "Barú",
  "Medellín",
  "Bogotá",
  "San Andrés",
  "Cocora",
  "Antioquia",
  "Colombia",
] as const;

const LANGUAGE: Record<TranslateTarget, string> = {
  ar: "Modern Standard Arabic",
  // Owner, 2026-10-11 (03.2-10-NOTES.md): Latin American / Colombian Spanish, formal "usted".
  es: "Latin American Spanish, Colombian usage, formal usted",
};

/** The system prompt for one target language. */
export function systemPrompt(target: TranslateTarget): string {
  return [
    `You translate website text for ALMAR, a private luxury travel company in Colombia, from English into ${LANGUAGE[target]}.`,
    "Write in a calm, refined luxury-travel register: natural, precise, never salesy, never literal word for word.",
    `Keep these names exactly as written, in Latin letters, with their accents: ${KEEP_UNCHANGED.join(", ")}.`,
    "Keep every other proper noun, place name, brand, vehicle model and airport code (for example BOG, MDE, CTG) unchanged.",
    "Keep numbers, prices, currency codes, times and units exactly as written.",
    "You receive a JSON object of English fields. Return only a JSON object with exactly the same keys.",
    "A string field becomes one translated string. A list field becomes a list of the same length, item by item, in the same order.",
    "Never leave a value empty, never add a key, never add notes, explanations or anything outside the JSON object.",
  ].join("\n");
}

/** The user message: the English fields as JSON. */
export function userMessage(fields: TranslateFields): string {
  return JSON.stringify(fields);
}

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: "string"; minLength: 1 } | { type: "array"; items: { type: "string"; minLength: 1 }; minItems: number; maxItems: number }>;
  required: string[];
  additionalProperties: false;
};

/** A JSON schema for an object with exactly these keys: strings stay strings, lists keep the English length. */
export function schemaFor(fields: TranslateFields): JsonSchema {
  const properties: JsonSchema["properties"] = {};
  for (const [key, value] of Object.entries(fields)) {
    properties[key] = Array.isArray(value)
      ? { type: "array", items: { type: "string", minLength: 1 }, minItems: value.length, maxItems: value.length }
      : { type: "string", minLength: 1 };
  }
  return { type: "object", properties, required: Object.keys(fields), additionalProperties: false };
}

export type ShapeCheck = { ok: true; fields: TranslateFields } | { ok: false; reason: string };

const filled = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/**
 * Accept the model's answer only if it has every key of the source and no other, every list has the English length,
 * and nothing is empty or not a string. The reason names the first problem (for the check outputs and the tests).
 */
export function checkSameShape(source: TranslateFields, output: unknown): ShapeCheck {
  if (output === null || typeof output !== "object" || Array.isArray(output)) return { ok: false, reason: "not an object" };
  const answer = output as Record<string, unknown>;
  for (const key of Object.keys(answer)) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) return { ok: false, reason: `extra key ${key}` };
  }
  const fields: TranslateFields = {};
  for (const [key, english] of Object.entries(source)) {
    if (!Object.prototype.hasOwnProperty.call(answer, key)) return { ok: false, reason: `missing key ${key}` };
    const value = answer[key];
    if (Array.isArray(english)) {
      if (!Array.isArray(value)) return { ok: false, reason: `${key} is not a list` };
      if (value.length !== english.length) return { ok: false, reason: `${key} has ${value.length} items, English has ${english.length}` };
      for (const [index, item] of value.entries()) {
        if (!filled(item)) return { ok: false, reason: `${key}[${index}] is empty or not text` };
      }
      fields[key] = value as string[];
    } else {
      if (!filled(value)) return { ok: false, reason: `${key} is empty or not text` };
      fields[key] = value;
    }
  }
  return { ok: true, fields };
}

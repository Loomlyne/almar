// Plan 04-09 Task 1: the money Settings section as plain data (balance due days, transfer window, bank details): the
// form from GET /api/ops/money, its errors, when Save is on and the POST /api/ops/money body (04-08 A,
// ops_save_money_settings). IBAN and SWIFT / BIC are checked with lib/booking/bank.ts, the same rules the SQL checks
// again on save. Pure: no React, no fetch, no clock, no environment.
import { BANK_TEXT_LIMITS, isValidBic, isValidIban, normalizeBic, normalizeIban } from "../booking/bank";
import { westernDigits } from "../format";
import type { MoneyView } from "./booking-rules";

export type MoneyForm = {
  windowValue: string;
  windowUnit: "minutes" | "hours" | "days";
  balanceDays: string;
  accountName: string;
  bankName: string;
  iban: string;
  swift: string;
  bankAddress: string;
  noteEn: string;
  noteAr: string;
  noteEs: string;
};

type MoneyField =
  | "window"
  | "balanceDays"
  | "accountName"
  | "bankName"
  | "iban"
  | "swift"
  | "bankAddress"
  | "noteEn"
  | "noteAr"
  | "noteEs";

type MoneyError = "range" | "whole" | "checksum" | "shape" | "long" | "required";

/** The POST /api/ops/money body: only the groups that changed. Empty bank values are null (the SQL clears them). */
type MoneySaveBody = {
  transfer_window_minutes?: number | null;
  balance_due_days?: number | null;
  bank?: {
    account_name: string | null;
    bank_name: string | null;
    iban: string | null;
    swift: string | null;
    bank_address: string | null;
    note_en: string | null;
    note_ar?: string;
    note_es?: string;
  };
};

const UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440 } as const;

/** The transfer window bounds in minutes (P-07: 35 minutes to 30 days). */
const WINDOW_MIN = 35;
const WINDOW_MAX = 43200;
/** Balance due days (ops_save_money_settings: 0..365). */
const BALANCE_DAYS_MAX = 365;

/** The six bank fields that travel together (P-08); the Arabic and Spanish note lines are optional. */
const BANK_REQUIRED = ["accountName", "bankName", "iban", "swift", "bankAddress", "noteEn"] as const;

/** The form from what GET /api/ops/money returned: days when the minutes divide by 1440, else hours, else minutes. */
export function moneyForm(view: MoneyView): MoneyForm {
  const minutes = view.transfer_window_minutes;
  let windowValue = "";
  let windowUnit: MoneyForm["windowUnit"] = "hours";
  if (minutes !== null) {
    if (minutes % 1440 === 0) {
      windowValue = String(minutes / 1440);
      windowUnit = "days";
    } else if (minutes % 60 === 0) {
      windowValue = String(minutes / 60);
      windowUnit = "hours";
    } else {
      windowValue = String(minutes);
      windowUnit = "minutes";
    }
  }
  const bank = view.bank;
  return {
    windowValue,
    windowUnit,
    balanceDays: view.balance_due_days === null ? "" : String(view.balance_due_days),
    accountName: bank.account_name ?? "",
    bankName: bank.bank_name ?? "",
    iban: bank.iban ?? "",
    swift: bank.swift ?? "",
    bankAddress: bank.bank_address ?? "",
    noteEn: bank.note_en ?? "",
    noteAr: bank.note_ar ?? "",
    noteEs: bank.note_es ?? "",
  };
}

/** A whole number typed in a field (Arabic-Indic digits allowed): null when empty, "whole" when not a whole number. */
function wholeNumber(value: string): number | null | "whole" | "range" {
  const t = westernDigits(value).trim();
  if (t === "") return null;
  if (!/^[0-9]+$/.test(t)) return "whole";
  if (t.length > 9) return "range";
  return Number.parseInt(t, 10);
}

/** The window in minutes: null when empty (requests stay closed, B-27), "whole" or "range" when it cannot be saved. */
export function windowMinutes(value: string, unit: MoneyForm["windowUnit"]): number | null | "range" | "whole" {
  const n = wholeNumber(value);
  if (n === null || typeof n === "string") return n;
  const minutes = n * UNIT_MINUTES[unit];
  return minutes < WINDOW_MIN || minutes > WINDOW_MAX ? "range" : minutes;
}

function balanceDays(value: string): number | null | "range" | "whole" {
  const n = wholeNumber(value);
  if (n === null || typeof n === "string") return n;
  return n > BALANCE_DAYS_MAX ? "range" : n;
}

/** Characters as the SQL counts them (char_length). */
function length(value: string): number {
  return Array.from(value.trim()).length;
}

/**
 * What each field says is wrong; an empty object when the form can be saved. The six bank fields travel together: one
 * filled and another empty is "required" on the empty one; all six empty clears the bank details (no error).
 */
export function moneyErrors(form: MoneyForm): Partial<Record<MoneyField, MoneyError>> {
  const errors: Partial<Record<MoneyField, MoneyError>> = {};
  const window = windowMinutes(form.windowValue, form.windowUnit);
  if (typeof window === "string") errors.window = window;
  const days = balanceDays(form.balanceDays);
  if (typeof days === "string") errors.balanceDays = days;

  const anyBank = BANK_REQUIRED.some((field) => form[field].trim() !== "");
  if (anyBank) for (const field of BANK_REQUIRED) if (form[field].trim() === "") errors[field] = "required";

  if (length(form.accountName) > BANK_TEXT_LIMITS.accountName) errors.accountName = "long";
  if (length(form.bankName) > BANK_TEXT_LIMITS.bankName) errors.bankName = "long";
  if (length(form.bankAddress) > BANK_TEXT_LIMITS.bankAddress) errors.bankAddress = "long";
  for (const field of ["noteEn", "noteAr", "noteEs"] as const) if (length(form[field]) > BANK_TEXT_LIMITS.note) errors[field] = "long";
  if (form.iban.trim() !== "" && !isValidIban(form.iban)) errors.iban = "checksum";
  if (form.swift.trim() !== "" && !isValidBic(form.swift)) errors.swift = "shape";
  return errors;
}

/** The bank values as they would be stored: trimmed text, IBAN and BIC without spaces in upper case, null when empty. */
function bankValues(form: MoneyForm) {
  const t = (value: string) => (value.trim() === "" ? null : value.trim());
  return {
    account_name: t(form.accountName),
    bank_name: t(form.bankName),
    iban: form.iban.trim() === "" ? null : normalizeIban(form.iban),
    swift: form.swift.trim() === "" ? null : normalizeBic(form.swift),
    bank_address: t(form.bankAddress),
    note_en: t(form.noteEn),
    note_ar: t(form.noteAr),
    note_es: t(form.noteEs),
  };
}

/** True when a bank key differs from the saved one after normalization (Q-07's confirm shows then). */
export function bankChanged(form: MoneyForm, saved: MoneyForm): boolean {
  const a = bankValues(form);
  const b = bankValues(saved);
  return (Object.keys(a) as (keyof typeof a)[]).some((key) => a[key] !== b[key]);
}

function windowChanged(form: MoneyForm, saved: MoneyForm): boolean {
  const a = windowMinutes(form.windowValue, form.windowUnit);
  return typeof a === "string" || a !== windowMinutes(saved.windowValue, saved.windowUnit);
}

function daysChanged(form: MoneyForm, saved: MoneyForm): boolean {
  const a = balanceDays(form.balanceDays);
  return typeof a === "string" || a !== balanceDays(saved.balanceDays);
}

/** Something in the section differs from what was loaded (1 day and 24 hours are the same window). */
export function moneyDirty(form: MoneyForm, saved: MoneyForm): boolean {
  return windowChanged(form, saved) || daysChanged(form, saved) || bankChanged(form, saved);
}

/** The section's own Save: something changed and nothing is wrong. */
export function canSaveMoney(form: MoneyForm, saved: MoneyForm): boolean {
  return moneyDirty(form, saved) && Object.keys(moneyErrors(form)).length === 0;
}

/**
 * The POST /api/ops/money body, or null when Save is off (nothing changed, or an error). Only the changed groups go:
 * transfer_window_minutes, balance_due_days, and bank with its six keys (IBAN and BIC normalized). `notes` are the
 * Arabic and Spanish note lines to send (from the translation or Edit translations): sent only when they have text, so
 * a changed English line without them clears the stored ones (P-16) and readers fall back to English.
 */
export function moneySaveBody(form: MoneyForm, saved: MoneyForm, notes: { ar: string | null; es: string | null }): MoneySaveBody | null {
  if (!canSaveMoney(form, saved)) return null;
  const body: MoneySaveBody = {};
  if (windowChanged(form, saved)) body.transfer_window_minutes = windowMinutes(form.windowValue, form.windowUnit) as number | null;
  if (daysChanged(form, saved)) body.balance_due_days = balanceDays(form.balanceDays) as number | null;
  if (bankChanged(form, saved)) {
    const v = bankValues(form);
    body.bank = {
      account_name: v.account_name,
      bank_name: v.bank_name,
      iban: v.iban,
      swift: v.swift,
      bank_address: v.bank_address,
      note_en: v.note_en,
    };
    const ar = notes.ar?.trim() ?? "";
    const es = notes.es?.trim() ?? "";
    if (ar !== "") body.bank.note_ar = ar;
    if (es !== "") body.bank.note_es = es;
  }
  return body;
}

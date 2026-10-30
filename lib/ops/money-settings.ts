// Plan 04-09 Task 6: GET and POST /api/ops/money, the owner's money Settings (balance due days, transfer window, bank
// details) through 04-08's ops_get_money_settings and ops_save_money_settings. Owner only (lib/ops/route.ts has run
// requireOwner() and, for POST, the Origin check and the 64 KiB JSON read); the SQL checks the owner again (p_actor).
//
// The GET answer is the only place a bank value leaves the server, and only to the owner (route-core sets no-store).
// Nothing here logs. IBAN and SWIFT / BIC are checked with lib/booking/bank.ts, the browser's rules (lib/ops/money-form.ts),
// and the SQL checks them again on save. No Next import, no Supabase import, no environment: node tests run it.
import { BANK_TEXT_LIMITS, isValidBic, isValidIban, normalizeBic, normalizeIban } from "../booking/bank";
import { bookingTermsGate } from "../booking/terms";
import { SITE_ORIGIN } from "../locale-path";
import { mapBookingRefusal, type OpsDb } from "./bookings-api";
import { errorBody, OpsInvalid, type DbError, type OpsOutcome } from "./route-core";
import { has, int, onlyKeys, record } from "./validate";

/** What the handlers need of requireOwner()'s owner: the profile id (p_actor) and the admin client. */
export type MoneyOwner = { profile: { id: string }; admin: OpsDb };

/** The bank group of a save: the six keys always, each a value or null (cleared); the AR / ES note lines optional. */
export type MoneyBank = {
  account_name: string | null;
  bank_name: string | null;
  iban: string | null;
  swift: string | null;
  bank_address: string | null;
  note_en: string | null;
  note_ar?: string | null;
  note_es?: string | null;
};

/** POST /api/ops/money: at least one of the three groups. */
export type MoneySave = {
  transfer_window_minutes?: number | null;
  balance_due_days?: number | null;
  bank?: MoneyBank;
};

const TOP_KEYS = ["transfer_window_minutes", "balance_due_days", "bank"] as const;
const BANK_REQUIRED = ["account_name", "bank_name", "iban", "swift", "bank_address", "note_en"] as const;
const BANK_KEYS = [...BANK_REQUIRED, "note_ar", "note_es"] as const;

/** Transfer window: 35 minutes (P-07) to 30 days. */
export const WINDOW_MIN = 35;
export const WINDOW_MAX = 43200;
/** Balance due days before arrival: 0 to 365. */
export const DAYS_MAX = 365;

/** Text limits per bank key (characters, as the SQL counts them). IBAN and BIC are limited by their own shape. */
const LIMITS: Record<(typeof BANK_KEYS)[number], number> = {
  account_name: BANK_TEXT_LIMITS.accountName,
  bank_name: BANK_TEXT_LIMITS.bankName,
  iban: 64,
  swift: 32,
  bank_address: BANK_TEXT_LIMITS.bankAddress,
  note_en: BANK_TEXT_LIMITS.note,
  note_ar: BANK_TEXT_LIMITS.note,
  note_es: BANK_TEXT_LIMITS.note,
};

/** A bank text: a string or null; trimmed; "" is null (cleared); at most its limit. */
function bankText(value: unknown, key: (typeof BANK_KEYS)[number]): string | null {
  const field = `bank.${key}`;
  if (value === null) return null;
  if (typeof value !== "string") throw new OpsInvalid(field);
  const out = value.trim();
  if (out === "") return null;
  if ([...out].length > LIMITS[key]) throw new OpsInvalid(field);
  return out;
}

function parseBank(value: unknown): MoneyBank {
  const b = record(value, "bank");
  onlyKeys(b, BANK_KEYS, "bank.");
  for (const key of BANK_REQUIRED) if (!has(b, key)) throw new OpsInvalid(`bank.${key}`);

  let iban = bankText(b.iban, "iban");
  if (iban !== null) {
    iban = normalizeIban(iban);
    if (!isValidIban(iban)) throw new OpsInvalid("bank.iban");
  }
  let swift = bankText(b.swift, "swift");
  if (swift !== null) {
    swift = normalizeBic(swift);
    if (!isValidBic(swift)) throw new OpsInvalid("bank.swift");
  }
  const bank: MoneyBank = {
    account_name: bankText(b.account_name, "account_name"),
    bank_name: bankText(b.bank_name, "bank_name"),
    iban,
    swift,
    bank_address: bankText(b.bank_address, "bank_address"),
    note_en: bankText(b.note_en, "note_en"),
  };
  // The six travel together: all set, or all cleared.
  const empty = BANK_REQUIRED.filter((key) => bank[key] === null);
  if (empty.length > 0 && empty.length < BANK_REQUIRED.length) throw new OpsInvalid(`bank.${empty[0]}`);
  if (has(b, "note_ar")) bank.note_ar = bankText(b.note_ar, "note_ar");
  if (has(b, "note_es")) bank.note_es = bankText(b.note_es, "note_es");
  return bank;
}

/**
 * POST /api/ops/money's body: only transfer_window_minutes (null or 35..43200), balance_due_days (null or 0..365) and
 * bank (the six keys, all set or all cleared; note_ar / note_es optional); at least one of them. IBAN and BIC are
 * normalized (no spaces, upper case) and checked; a wrong one is field bank.iban / bank.swift.
 */
export function parseMoneySave(body: unknown): MoneySave {
  const b = record(body, "body");
  onlyKeys(b, TOP_KEYS);
  if (!TOP_KEYS.some((key) => has(b, key))) throw new OpsInvalid("body");
  const out: MoneySave = {};
  if (has(b, "transfer_window_minutes")) {
    out.transfer_window_minutes =
      b.transfer_window_minutes === null ? null : int(b.transfer_window_minutes, "transfer_window_minutes", { min: WINDOW_MIN, max: WINDOW_MAX });
  }
  if (has(b, "balance_due_days")) {
    out.balance_due_days = b.balance_due_days === null ? null : int(b.balance_due_days, "balance_due_days", { min: 0, max: DAYS_MAX });
  }
  if (has(b, "bank")) out.bank = parseBank(b.bank);
  return out;
}

const UNREADABLE: { dbError: DbError } = { dbError: { code: "unreadable" } };

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The SQL's bank field names, answered with the wire's bank. prefix. */
const BANK_FIELD_NAMES: readonly string[] = BANK_KEYS;

function moneyRefusal(error: Parameters<typeof mapBookingRefusal>[0]): OpsOutcome {
  const mapped = mapBookingRefusal(error);
  if ("dbError" in mapped) return mapped;
  const refusal = mapped.body.error;
  if (mapped.status === 400 && isRow(refusal) && typeof refusal.field === "string" && BANK_FIELD_NAMES.includes(refusal.field)) {
    return { status: 400, body: errorBody("invalid", `bank.${refusal.field}`) };
  }
  return mapped;
}

/**
 * The terms version the public Worker `almar` was built with, from the file its build publishes. This handler runs on
 * `almar-ops`, a separate build whose own bake says nothing about the public site. Any failure is null: not final.
 */
export async function fetchPublicTermsVersion(doFetch: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await doFetch(`${SITE_ORIGIN}/booking-terms-version.json`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const { version } = (await response.json()) as { version?: unknown };
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/ops/money: the saved values (null when unset) and whether the booking terms are final (Q-13): the same test as
 * the public gate, with the public Worker's baked version, so the row never says final while `almar` is still closed.
 */
export async function getMoneyRoute({ owner, publicVersion = fetchPublicTermsVersion }: { owner: MoneyOwner; publicVersion?: () => Promise<string | null> }): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_get_money_settings");
  if (error) return moneyRefusal(error);
  if (!isRow(data)) return UNREADABLE;
  const terms = await bookingTermsGate(owner.admin, await publicVersion());
  return { body: { ok: true, money: data, terms_final: !terms.isPlaceholder } };
}

/** POST /api/ops/money: one ops_save_money_settings; answers what GET answers. Never affects the public site. */
export async function postMoneyRoute({ owner, body }: { owner: MoneyOwner; body: MoneySave }): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_save_money_settings", { p: body, p_actor: owner.profile.id });
  if (error) return moneyRefusal(error);
  if (!isRow(data)) return UNREADABLE;
  return { body: { ok: true, money: data } };
}

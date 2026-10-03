const LATN = "ar-AE-u-nu-latn";

function grouped(amount: number, locale = "en-US"): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

function formatLikeAmount(currency: string, amount: number, locale: string): string {
  if (locale === "ar") return `${currency} ${grouped(amount, LATN)}`;
  return `${currency} ${grouped(amount)}`;
}

export const FX_URL = "https://latest.currency-api.pages.dev/v1/currencies/usd.json";

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

export type WrittenCurrency = "USD" | "AED";
export type SelectedCurrency = "AED" | "USD" | "EUR";

export type WrittenAmount = {
  amount: number;
  currency: WrittenCurrency;
};

export type FxRates = {
  aed: number;
  eur: number;
  date: string;
};

type RatePair = {
  aed: number;
  eur: number;
};

const WRITTEN: Array<{
  source: string;
  amount: number;
  currency: WrittenCurrency;
}> = [
  { source: "USD $20,000", amount: 20000, currency: "USD" },
  { source: "$20,000", amount: 20000, currency: "USD" },
  { source: "USD $3,500", amount: 3500, currency: "USD" },
  { source: "$3,500", amount: 3500, currency: "USD" },
  { source: "USD $3,000", amount: 3000, currency: "USD" },
  { source: "$3,000", amount: 3000, currency: "USD" },
  { source: "AED 200,000", amount: 200000, currency: "AED" },
  { source: "AED 120,000", amount: 120000, currency: "AED" },
  { source: "AED 80,000", amount: 80000, currency: "AED" },
];

// A written amount ends where no further digit and no decimal or group part follows, so "AED 80,000"
// never matches inside "AED 80,0000" or "AED 80,000.50". It starts where no word character or "$" comes
// before it, so "$3,000" never matches inside "US$3,000".
const START = String.raw`(?<![\w$])`;
const END = String.raw`(?!\d|[.,]\d)`;

// "AED 80,000–90,000" (en dash, hyphen or em dash, spaced or not, optional trailing "+"): both ends
// convert under one currency code and the written separator is kept.
const AED_RANGE = /(?<![\w$])AED (\d{1,3}(?:,\d{3})*)(\s*[-–—]\s*)(\d{1,3}(?:,\d{3})*)(\+?)(?!\d|[.,]\d)/g;

// A single written amount is never one end of a range: no dash or "to" and a digit after it (the low
// end) and no digit and a dash or "to" before it (the high end). Only AED_RANGE converts a range, and a
// range it cannot read keeps the whole label as written.
const NOT_LOW_END = String.raw`(?!\s*(?:[-–—]|to)\s*\d)`;
const NOT_HIGH_END = String.raw`(?<!\d\s*(?:[-–—]|to)\s*)`;
const WRITTEN_PATTERNS = WRITTEN.map((row) => ({
  ...row,
  pattern: new RegExp(`${START}${NOT_HIGH_END}${row.source.replace(/[$.]/g, "\\$&")}${END}${NOT_LOW_END}`, "g"),
}));

let memory: { rates: FxRates; at: number } | null = null;

/** A usable rate is a real number above zero: never 0, negative, NaN, Infinity, a string or null. */
function isRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** The digits of a written amount ("80,000") as a number, or null when they are not a safe integer. */
function writtenNumber(digits: string): number | null {
  const amount = Number(digits.replace(/,/g, ""));
  return Number.isSafeInteger(amount) ? amount : null;
}

export function parseWrittenAmount(text: string): WrittenAmount | null {
  if (typeof text !== "string") return null;
  const usd = text.match(/^\$(\d{1,3}(?:,\d{3})*)$/);
  if (usd) {
    const amount = writtenNumber(usd[1]);
    return amount === null ? null : { amount, currency: "USD" };
  }
  const aed = text.match(/^AED (\d{1,3}(?:,\d{3})*)$/);
  if (aed) {
    const amount = writtenNumber(aed[1]);
    return amount === null ? null : { amount, currency: "AED" };
  }
  return null;
}

export function convertWrittenAmount(
  written: WrittenAmount,
  selected: SelectedCurrency,
  rates: RatePair,
): number | null {
  if (!written || typeof written.amount !== "number" || !Number.isFinite(written.amount)) {
    return null;
  }
  if (written.currency !== "USD" && written.currency !== "AED") return null;
  if (selected !== "AED" && selected !== "USD" && selected !== "EUR") return null;
  if (written.currency === selected) return written.amount;

  const aed: unknown = rates?.aed;
  const eur: unknown = rates?.eur;
  let converted: number | null = null;
  if (written.currency === "USD" && selected === "EUR") {
    converted = isRate(eur) ? written.amount * eur : null;
  } else if (written.currency === "USD" && selected === "AED") {
    converted = isRate(aed) ? written.amount * aed : null;
  } else if (written.currency === "AED" && selected === "USD") {
    converted = isRate(aed) ? written.amount * (1 / aed) : null;
  } else if (written.currency === "AED" && selected === "EUR") {
    converted = isRate(aed) && isRate(eur) ? written.amount * (eur / aed) : null;
  }
  return converted !== null && Number.isFinite(converted) ? converted : null;
}

export function formatConverted(
  currency: SelectedCurrency,
  amount: number,
  locale = "en",
): string {
  if (!Number.isFinite(amount)) return "";
  if (locale === "ar") return formatLikeAmount(currency, amount, "ar");
  return formatLikeAmount(currency, amount, "en");
}

/** The converted amount as text, or null when it would print empty (not finite) or as zero. */
function shownAmount(selected: SelectedCurrency, amount: number, locale: string): string | null {
  const shown = formatConverted(selected, amount, locale);
  return shown !== "" && /[1-9]/.test(shown) ? shown : null;
}

/**
 * True when `out` reads in one currency only: no written dollar amount is left ("$3,000", "US$3,000")
 * and every currency code in it is the selected one.
 */
function settled(out: string, selected: SelectedCurrency): boolean {
  if (/\$\s?\d/.test(out)) return false;
  const codes = out.match(/\b(?:AED|USD|EUR)\b/g) ?? [];
  return codes.every((code) => code === selected);
}

export function rewriteHomeAmounts(
  text: string,
  selected: SelectedCurrency,
  rates: RatePair | null,
  locale = "en",
): string {
  if (typeof text !== "string") return "";
  if (selected !== "AED" && selected !== "USD" && selected !== "EUR") return text;
  if (!rates || !isRate(rates.aed) || !isRate(rates.eur)) return text;
  let next = text;
  // A written AED range ("AED 80,000–90,000", see AED_RANGE) converts at BOTH ends under
  // one currency code. Only the low end carries the "AED " prefix the rows below match, so without this the
  // high end stayed in AED under a USD label. A range converts only when both ends come out finite and
  // above zero; otherwise it is left as written.
  next = next.replace(
    AED_RANGE,
    (whole: string, low: string, separator: string, high: string, plus: string) => {
      if (selected === "AED") return whole; // already in AED: keep it byte for byte
      const prefix = `${selected} `;
      const ends = [low, high].map((digits) => {
        const written = writtenNumber(digits);
        if (written === null) return null;
        const amount = convertWrittenAmount({ amount: written, currency: "AED" }, selected, rates);
        if (amount === null || !Number.isFinite(amount) || amount <= 0) return null;
        const shown = shownAmount(selected, amount, locale);
        return shown !== null && shown.startsWith(prefix) ? shown.slice(prefix.length) : null;
      });
      return ends[0] === null || ends[1] === null ? whole : `${prefix}${ends[0]}${separator}${ends[1]}${plus}`;
    },
  );
  for (const row of WRITTEN_PATTERNS) {
    if (row.currency === "AED" && selected === "AED") continue; // already in AED: keep it byte for byte
    if (!next.includes(row.source)) continue;
    const amount = convertWrittenAmount(
      { amount: row.amount, currency: row.currency },
      selected,
      rates,
    );
    if (amount === null) continue;
    const shown = shownAmount(selected, amount, locale);
    if (shown === null) continue;
    next = next.replace(row.pattern, () => shown);
  }
  // All or nothing: a written amount that could not be converted, or a second currency code, means the
  // label would mix currencies. Print it exactly as written instead.
  return settled(next, selected) ? next : text;
}

async function readFeed(): Promise<FxRates | null> {
  try {
    const response = await fetch(FX_URL, { cache: "no-store" });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return null;
    const record = body as { date?: unknown; usd?: { aed?: unknown; eur?: unknown } };
    const aed = record.usd?.aed;
    const eur = record.usd?.eur;
    const date = record.date;
    if (!isRate(aed) || !isRate(eur)) return null;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    return { aed, eur, date };
  } catch {
    return null;
  }
}

export async function loadRates(): Promise<FxRates | null> {
  const now = Date.now();
  if (memory && now - memory.at < TWELVE_HOURS) return memory.rates;
  const fresh = (await readFeed()) ?? (await readFeed());
  if (fresh) {
    memory = { rates: fresh, at: now };
    return fresh;
  }
  return memory?.rates ?? null;
}

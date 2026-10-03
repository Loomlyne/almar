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

// "AED 80,000–90,000" (en dash, optional trailing "+"): both ends convert under one currency code.
const AED_RANGE = /(?<![\w$])AED (\d{1,3}(?:,\d{3})*)–(\d{1,3}(?:,\d{3})*)(\+?)(?!\d|[.,]\d)/g;

// A single written amount. "–" and a digit after it make it the low end of a range, which only
// AED_RANGE may convert.
const WRITTEN_PATTERNS = WRITTEN.map((row) => ({
  ...row,
  pattern: new RegExp(`${START}${row.source.replace(/[$.]/g, "\\$&")}${END}(?!–\\d)`, "g"),
}));

let memory: { rates: FxRates; at: number } | null = null;

/** A usable rate is a real number above zero: never 0, negative, NaN, Infinity, a string or null. */
function isRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function parseWrittenAmount(text: string): WrittenAmount | null {
  if (typeof text !== "string") return null;
  const usd = text.match(/^\$(\d{1,3}(?:,\d{3})*)$/);
  if (usd) {
    const amount = Number(usd[1].replace(/,/g, ""));
    return Number.isFinite(amount) ? { amount, currency: "USD" } : null;
  }
  const aed = text.match(/^AED (\d{1,3}(?:,\d{3})*)$/);
  if (aed) {
    const amount = Number(aed[1].replace(/,/g, ""));
    return Number.isFinite(amount) ? { amount, currency: "AED" } : null;
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
  // A written AED range ("AED 80,000–90,000", en dash, optional trailing "+") converts at BOTH ends under
  // one currency code. Only the low end carries the "AED " prefix the rows below match, so without this the
  // high end stayed in AED under a USD label. A range converts only when both ends come out finite and
  // above zero; otherwise it is left as written.
  next = next.replace(
    AED_RANGE,
    (whole: string, low: string, high: string, plus: string) => {
      if (selected === "AED") return whole; // already in AED: keep it byte for byte
      const prefix = `${selected} `;
      const ends = [low, high].map((digits) => {
        const amount = convertWrittenAmount(
          { amount: Number(digits.replace(/,/g, "")), currency: "AED" },
          selected,
          rates,
        );
        if (amount === null || !Number.isFinite(amount) || amount <= 0) return null;
        const shown = formatConverted(selected, amount, locale);
        return shown.startsWith(prefix) ? shown.slice(prefix.length) : null;
      });
      return ends[0] === null || ends[1] === null ? whole : `${prefix}${ends[0]}–${ends[1]}${plus}`;
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
    const shown = formatConverted(selected, amount, locale);
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

export function homePriceScript(): string {
  return `(function () {
  var ORIG = "data-almar-fx";
  var last = null;
  var specs = [
    ["USD $20,000", 20000, "USD"],
    ["$20,000", 20000, "USD"],
    ["USD $3,500", 3500, "USD"],
    ["$3,500", 3500, "USD"],
    ["USD $3,000", 3000, "USD"],
    ["$3,000", 3000, "USD"],
    ["AED 200,000", 200000, "AED"],
    ["AED 120,000", 120000, "AED"],
    ["AED 80,000", 80000, "AED"]
  ];
  function finite(value) {
    return typeof value === "number" && isFinite(value);
  }
  function convert(amount, written, selected, aed, eur) {
    if (written === selected) return amount;
    if (written === "USD" && selected === "EUR") return finite(eur) ? amount * eur : null;
    if (written === "USD" && selected === "AED") return finite(aed) ? amount * aed : null;
    if (written === "AED" && selected === "USD") return finite(aed) && aed !== 0 ? amount * (1 / aed) : null;
    if (written === "AED" && selected === "EUR") return finite(aed) && finite(eur) && aed !== 0 ? amount * (eur / aed) : null;
    return null;
  }
  function format(currency, amount, locale) {
    var whole = Number.isInteger(amount);
    var loc = locale === "ar" ? "ar-AE-u-nu-latn" : "en-US";
    var num = new Intl.NumberFormat(loc, {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2
    }).format(amount);
    return currency + " " + num;
  }
  function rewrite(text, selected, aed, eur, locale) {
    if (!finite(aed) || !finite(eur)) return text;
    var next = text;
    for (var i = 0; i < specs.length; i++) {
      var source = specs[i][0];
      if (next.indexOf(source) === -1) continue;
      var amount = convert(specs[i][1], specs[i][2], selected, aed, eur);
      if (amount === null) continue;
      next = next.split(source).join(format(selected, amount, locale));
    }
    return next;
  }
  function hasSource(text) {
    for (var j = 0; j < specs.length; j++) {
      if (text.indexOf(specs[j][0]) !== -1) return true;
    }
    return false;
  }
  function apply(selected, aed, eur, locale) {
    var nodes = document.body ? document.body.querySelectorAll("*") : [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest("#almar-hero-booker, script, style")) continue;
      var original = el.getAttribute(ORIG) || el.textContent || "";
      if (!hasSource(original)) continue;
      var childHit = false;
      for (var c = 0; c < el.children.length; c++) {
        var childText = el.children[c].getAttribute(ORIG) || el.children[c].textContent || "";
        if (hasSource(childText)) childHit = true;
      }
      if (childHit) continue;
      if (!el.getAttribute(ORIG)) el.setAttribute(ORIG, original);
      var next = rewrite(original, selected, aed, eur, locale);
      if (el.textContent !== next) el.textContent = next;
      if (el.style.fontVariantNumeric !== "tabular-nums") el.style.fontVariantNumeric = "tabular-nums";
    }
  }
  function onMessage(event) {
    if (event.origin !== location.origin) return;
    if (event.source !== window.parent) return;
    var data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.currency !== "AED" && data.currency !== "USD" && data.currency !== "EUR") return;
    var locale = data.locale === "ar" ? "ar" : "en";
    var aed = typeof data.aed === "number" ? data.aed : NaN;
    var eur = typeof data.eur === "number" ? data.eur : NaN;
    last = { currency: data.currency, aed: aed, eur: eur, locale: locale };
    apply(data.currency, aed, eur, locale);
  }
  window.addEventListener("message", onMessage);
  var timer = 0;
  var observer = new MutationObserver(function () {
    if (!last) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      if (!last) return;
      apply(last.currency, last.aed, last.eur, last.locale);
    }, 50);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.setTimeout(function () { observer.disconnect(); }, 8000);
})();`;
}

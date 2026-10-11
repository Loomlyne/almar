// Plan 03.2-04 (C-15): the structured price of a home journey, read from the owner's English price label. The label is
// his own text and is stored verbatim; these values are derived from it only (never computed from anything else) and
// are what the public build serves as price_from / price_estimate (lib/data/types.ts JourneyTier). The rule reproduces
// lib/data/fixtures/home.json exactly for the three accepted labels (tests/journey-price.test.mjs, tests/data-prices.test.mjs):
//
//   "From USD $3,000/person · Est. AED 80,000–90,000"     -> from 3000 USD, estimate 80000-90000 AED
//   "From USD $20,000/person · Est. AED 200,000–250,000+" -> from 20000 USD, estimate 200000-250000 AED, open ended
//
// Each part is read on its own and is null when it does not parse ("Price on request" gives both null). A currency is
// never guessed: "From $3,000" has none, so it is null.

export type TierPrice = {
  price_from: { amount: number; currency: "USD" | "AED" } | null;
  price_estimate: { low: number; high: number | null; currency: "AED"; open_ended: boolean } | null;
};

/** A whole amount: 3000, or 3,000 with exact groups of three. Never followed by another digit or comma. */
const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?![\d,])`;
const FROM = new RegExp(String.raw`\bfrom\s+(USD|AED)\s*\$?\s*${AMOUNT}`, "i");
const RANGE = new RegExp(String.raw`\best\.?\s+AED\s*${AMOUNT}\s*[–—-]\s*${AMOUNT}(\+)?`, "i");
const OPEN = new RegExp(String.raw`\best\.?\s+AED\s*${AMOUNT}\+`, "i");

function amount(text: string): number {
  return Number(text.replace(/,/g, ""));
}

export function parseTierPrice(label: string | null | undefined): TierPrice {
  const text = typeof label === "string" ? label : "";

  const from = text.match(FROM);
  const price_from = from ? { amount: amount(from[2]), currency: from[1].toUpperCase() as "USD" | "AED" } : null;

  let price_estimate: TierPrice["price_estimate"] = null;
  const range = text.match(RANGE);
  if (range) {
    const low = amount(range[1]);
    const high = amount(range[2]);
    if (low <= high) price_estimate = { low, high, currency: "AED", open_ended: range[3] === "+" };
  } else {
    const open = text.match(OPEN);
    if (open) price_estimate = { low: amount(open[1]), high: null, currency: "AED", open_ended: true };
  }

  return { price_from, price_estimate };
}

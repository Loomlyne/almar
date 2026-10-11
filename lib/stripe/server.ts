// The Stripe client for server code (plan 04-04). This is the only file that names the two key variables
// (tests/secrets.test.mjs). The key's prefix says the mode; a key that is neither test nor live is treated as no key, so a
// mistyped secret never reaches Stripe. The fetch HTTP client is set explicitly: Stripe's Node client hangs on Workers
// (research Pitfall 2). The publishable key is returned to the browser in API answers only, never inlined in a build
// (B-19: switching Stripe accounts is a secret change, not a rebuild).
import Stripe from "stripe";

export type StripeMode = "test" | "live" | "none";

function secretKey(): string {
  return (process.env.STRIPE_SECRET_KEY ?? "").trim();
}

/** "live" for `sk_live_` / `rk_live_`, "test" for `sk_test_` / `rk_test_`, otherwise "none" (also when unset). */
export function stripeMode(): StripeMode {
  const key = secretKey();
  if (/^(sk|rk)_live_/.test(key)) return "live";
  if (/^(sk|rk)_test_/.test(key)) return "test";
  return "none";
}

/** A client per request (the environment is read at request time), or null without a usable secret key. */
export function stripeServer(): Stripe | null {
  if (stripeMode() === "none") return null;
  return new Stripe(secretKey(), { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 1 });
}

/** The publishable key for the browser, or null when unset or not a publishable key. */
export function stripePublishableKey(): string | null {
  const key = (process.env.STRIPE_PUBLISHABLE_KEY ?? "").trim();
  return /^pk_(test|live)_/.test(key) ? key : null;
}

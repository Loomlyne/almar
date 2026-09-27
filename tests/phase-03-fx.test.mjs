import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { convertWrittenAmount, parseWrittenAmount } from "../lib/fx/rates.ts";

test("$20,000 parses as 20000 USD", () => {
  assert.deepEqual(parseWrittenAmount("$20,000"), {
    amount: 20000,
    currency: "USD",
  });
});

test("AED 120,000 stays 120000 when the selected currency is AED", () => {
  const written = parseWrittenAmount("AED 120,000");
  assert.deepEqual(written, { amount: 120000, currency: "AED" });
  assert.equal(
    convertWrittenAmount(written, "AED", { aed: 9.5, eur: 0.25 }),
    120000,
  );
});

test("a USD amount times the supplied eur number is the converted value", () => {
  const written = parseWrittenAmount("$20,000");
  const eur = 0.123456;
  assert.equal(
    convertWrittenAmount(written, "EUR", { aed: 8, eur }),
    20000 * eur,
  );
});

test("the rates module does not contain 3.6725", () => {
  const source = readFileSync("lib/fx/rates.ts", "utf8");
  assert.equal(source.includes("3.6725"), false);
});

test("no exported function returns the string rate unavailable", async () => {
  const source = readFileSync("lib/fx/rates.ts", "utf8");
  assert.equal(/rate unavailable/i.test(source), false);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  try {
    const mod = await import("../lib/fx/rates.ts");
    const trials = [
      ["$20,000"],
      ["AED 120,000", "AED", { aed: 1.5, eur: 0.4 }],
      [{ amount: 20000, currency: "USD" }, "EUR", { aed: 1.5, eur: 0.4 }],
      ["EUR", 10, "ar"],
      [],
    ];
    for (const fn of Object.values(mod)) {
      if (typeof fn !== "function") continue;
      for (const args of trials) {
        let value;
        try {
          value = await fn(...args);
        } catch {
          continue;
        }
        assert.notEqual(value, "rate unavailable");
        if (typeof value === "string") {
          assert.equal(/rate unavailable/i.test(value), false);
        }
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

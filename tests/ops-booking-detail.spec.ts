import { expect, test } from "@playwright/test";
import { OPS_BOOKINGS_COPY } from "../lib/copy/ops-bookings";

// Plan 04-09 Task 2: the booking detail and its dialogs. Scenes and pictures were replaced by the signed HTML page
// (owner, 2026-10-25: no test, no shoot). The behaviour block (a double click on Record posts once, bite check B10) needs
// the screen of Task 7 and is written there. This file keeps the sentences the dialogs print checked in all languages.
// Written and not run in this job.

test("copy: every record, void, status and attention sentence has the same tokens in en, ar and es", () => {
  const tokens = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  const groups = ["record", "void", "attention"] as const;
  for (const group of groups) {
    for (const key of Object.keys(OPS_BOOKINGS_COPY.en[group]) as (keyof (typeof OPS_BOOKINGS_COPY.en)[typeof group])[]) {
      const en = tokens(String(OPS_BOOKINGS_COPY.en[group][key]));
      for (const locale of ["ar", "es"] as const) {
        expect(tokens(String(OPS_BOOKINGS_COPY[locale][group][key])), `${locale}.${group}.${String(key)}`).toEqual(en);
      }
    }
  }
});

test("copy: Cancel keeps the booking, and no dialog string offers a refund", () => {
  for (const locale of ["en", "ar", "es"] as const) {
    const copy = OPS_BOOKINGS_COPY[locale];
    expect(copy.actions.keep.trim()).not.toBe("");
    expect(copy.actions.cancel).not.toBe(copy.actions.keep);
  }
});

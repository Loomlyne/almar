// Plan 04-03, Task 3 (Q-06): the trip page's metadata, server-safe (no "use client"). noindex and out of the sitemap,
// with a self canonical and hreflang like every PUBLIC_PAGES document. `referrer: "same-origin"` as app/auth/confirm
// (F-02): no-referrer would make the browser send `Origin: null` on the page's POSTs, which the booking routes refuse.
import type { Metadata } from "next";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { TRIP_PATH } from "../../../lib/booking/trip-link";
import { localeAlternates, type Locale } from "../../../lib/locale-path";

export function tripMetadata(locale: Locale): Metadata {
  return {
    title: JOURNEY_COPY[locale].trip.title,
    robots: { index: false, follow: false },
    referrer: "same-origin",
    alternates: localeAlternates(locale, TRIP_PATH),
  };
}

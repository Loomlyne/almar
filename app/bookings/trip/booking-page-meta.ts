// Plan 04-05, Task 5: the booking page's metadata, server-safe (no "use client"), copied from 04-03's
// app/booking/trip/trip-meta.ts. noindex and out of the sitemap (scripts/crawl-files.mjs NOT_PUBLIC has bookings),
// with a self canonical and four hreflang alternates like every PUBLIC_PAGES document (they carry no query, so never
// the link token). `referrer: "same-origin"` as app/auth/confirm (F-02): a policy that drops the referrer entirely
// would make the browser send `Origin: null` on the page's POST to /api/booking/view and /api/booking/withdraw, which
// both routes refuse with 403; same-origin still never sends the token to another site.
import type { Metadata } from "next";
import { BOOKING_PAGE_COPY } from "../../../lib/copy/booking-page";
import { localeAlternates, type Locale } from "../../../lib/locale-path";

/** The page's path in PUBLIC_PAGES (lib/locale-path.ts); the locale prefix comes from localePath. */
export const BOOKING_PAGE_PATH = "/bookings/trip";

export function bookingPageMetadata(locale: Locale): Metadata {
  return {
    title: BOOKING_PAGE_COPY[locale].pageTitle,
    robots: { index: false, follow: false },
    referrer: "same-origin",
    alternates: localeAlternates(locale, BOOKING_PAGE_PATH),
  };
}

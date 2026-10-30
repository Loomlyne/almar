import { Suspense } from "react";
import { bookingPageMetadata } from "../../../bookings/trip/booking-page-meta";
import { BookingPageView } from "../../../bookings/trip/booking-page-view";
import { BookingTripScreen } from "../../../bookings/trip/booking-trip-screen";
import { BOOKING_PAGE_COPY } from "../../../../lib/copy/booking-page";
import { getBookingPageLegal } from "../../../../lib/data/legal";

// Plan 04-05 (Task 5): the guest booking page, static and noindex (same-origin referrer: F-02). The screen reads
// ref and t in the browser; the static HTML is the loading state. Shared code lives in app/bookings/trip/; every page
// is /en|ar|es/… (#33), and this static segment wins over app/[locale]/bookings, which has no trip child.
export const dynamic = "force-static";

export function generateMetadata() {
  return bookingPageMetadata("en");
}

export default async function Page() {
  const legal = await getBookingPageLegal("en");
  return (
    <Suspense
      fallback={
        <BookingPageView
          locale="en"
          copy={BOOKING_PAGE_COPY.en}
          state={{ kind: "loading" }}
          isTest={false}
          showBackLink={false}
          legal={legal}
        />
      }
    >
      <BookingTripScreen locale="en" legal={legal} />
    </Suspense>
  );
}

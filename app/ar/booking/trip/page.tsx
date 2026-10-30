import { tripMetadata } from "../../../booking/trip/trip-meta";
import { TripPage } from "../../../booking/trip/trip-screen";
import { getBookingPageLegal, getBookingTermsLink } from "../../../../lib/data/legal";

// Plan 04-03 (Q-06): the guest's trip, static and noindex; the screen reads the query in the browser.
export const dynamic = "force-static";

export function generateMetadata() {
  return tripMetadata("ar");
}

export default async function Page() {
  return <TripPage locale="ar" legal={await getBookingPageLegal("ar")} termsLink={await getBookingTermsLink("ar")} />;
}

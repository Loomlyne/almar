import { tripMetadata } from "../../../booking/trip/trip-meta";
import { TripPage } from "../../../booking/trip/trip-screen";

// Plan 04-03 (Q-06): the guest's trip, static and noindex; the screen reads the query in the browser.
export const dynamic = "force-static";

export function generateMetadata() {
  return tripMetadata("en");
}

export default function Page() {
  return <TripPage locale="en" />;
}

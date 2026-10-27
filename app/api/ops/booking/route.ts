// Owner API (plan 04-09): GET one booking by ?ref=ALMAR-XXXXXX through ops_get_booking, after ops_lapse_holds.
import { opsGet } from "../../../../lib/ops/route";
import { getBookingRoute } from "../../../../lib/ops/bookings";

export const dynamic = "force-dynamic";
export const GET = opsGet(getBookingRoute);

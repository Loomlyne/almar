// Owner API (plan 04-09): GET the bookings list (search, status, destination, arrival range, paging) through
// ops_list_bookings, after ops_lapse_holds.
import { opsGet } from "../../../../lib/ops/route";
import { getBookingsRoute } from "../../../../lib/ops/bookings";

export const dynamic = "force-dynamic";
export const GET = opsGet(getBookingsRoute);

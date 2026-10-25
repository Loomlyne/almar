// Owner API (plan 04-09): POST Confirm, Mark completed or Cancel (ops_set_booking_status), after ops_lapse_holds.
import { opsPost } from "../../../../../lib/ops/route";
import { parseStatus, postStatusRoute } from "../../../../../lib/ops/bookings";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseStatus, postStatusRoute);

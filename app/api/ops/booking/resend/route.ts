// Owner API (plan 04-09): POST resend a receipt or the request email, after ops_lapse_holds (key
// resend/<booking_id>/<request_id>).
import { opsPost } from "../../../../../lib/ops/route";
import { parseResend, postResendRoute } from "../../../../../lib/ops/bookings";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseResend, postResendRoute);

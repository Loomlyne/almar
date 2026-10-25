// Owner API (plan 04-09): POST void a recorded payment with a reason (ops_void_payment). No mail.
import { opsPost } from "../../../../../lib/ops/route";
import { parseVoid, postVoidRoute } from "../../../../../lib/ops/bookings";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseVoid, postVoidRoute);

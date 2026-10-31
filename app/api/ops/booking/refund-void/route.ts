// Owner API (plan 05-03): POST void a refund record with a reason (ops_void_refund). The row stays. No mail.
import { opsPost } from "../../../../../lib/ops/route";
import { parseRefundVoid, postRefundVoidRoute } from "../../../../../lib/ops/bookings";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseRefundVoid, postRefundVoidRoute);

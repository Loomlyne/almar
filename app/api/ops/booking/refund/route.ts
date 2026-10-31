// Owner API (plan 05-03): POST record a bank refund already made by the owner (ops_record_refund). Never sends money.
import { opsPost } from "../../../../../lib/ops/route";
import { parseRefund, postRefundRoute } from "../../../../../lib/ops/bookings";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseRefund, postRefundRoute);

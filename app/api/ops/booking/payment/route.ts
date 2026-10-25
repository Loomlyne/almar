// Owner API (plan 04-09): POST record a bank transfer (ops_record_payment); the first time, the receipt and the owner
// notice go through 04-08's mail seam.
import { opsPost } from "../../../../../lib/ops/route";
import { parsePayment, postPaymentRoute } from "../../../../../lib/ops/bookings";

export const dynamic = "force-dynamic";
export const POST = opsPost(parsePayment, postPaymentRoute);

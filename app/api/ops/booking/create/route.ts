// Owner API (plan 05-02): POST one ops_create_booking and the guest's mail.
import { opsPost } from "../../../../../lib/ops/route";
import { parseCreate, postCreateRoute } from "../../../../../lib/ops/new-booking";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseCreate, postCreateRoute);

// Owner API (plan 04-09): POST resolve Needs attention with a note (ops_resolve_attention).
import { opsPost } from "../../../../../lib/ops/route";
import { parseAttention, postAttentionRoute } from "../../../../../lib/ops/bookings";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseAttention, postAttentionRoute);

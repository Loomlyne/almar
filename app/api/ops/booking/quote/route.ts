// Owner API (plan 05-02): POST the server's price for a hand-made booking.
import { opsPost } from "../../../../../lib/ops/route";
import { parseQuote, postQuoteRoute } from "../../../../../lib/ops/new-booking";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseQuote, postQuoteRoute);

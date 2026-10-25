// Owner API (plan 04-09): POST one internal note (ops_add_booking_note).
import { opsPost } from "../../../../../lib/ops/route";
import { parseNote, postNoteRoute } from "../../../../../lib/ops/bookings";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseNote, postNoteRoute);

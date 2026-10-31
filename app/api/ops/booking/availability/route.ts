// Owner API (plan 05-02): POST the stay's blocked and booked nights, and whether it has a rate.
import { opsPost } from "../../../../../lib/ops/route";
import { parseAvailability, postAvailabilityRoute } from "../../../../../lib/ops/new-booking";

export const dynamic = "force-dynamic";
export const POST = opsPost(parseAvailability, postAvailabilityRoute);

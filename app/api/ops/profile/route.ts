// Owner API (plan 05-04): GET profile, read-only, through requireOwner (opsGet). Static path, no [id].
import { opsGet } from "../../../../lib/ops/route";
import { getProfile } from "../../../../lib/ops/home-api";

export const dynamic = "force-dynamic";
export const GET = opsGet(getProfile);

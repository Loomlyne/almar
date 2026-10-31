// Owner API (plan 05-04): GET home, read-only, through requireOwner (opsGet). Static path, no [id].
import { opsGet } from "../../../../lib/ops/route";
import { getHome } from "../../../../lib/ops/home-api";

export const dynamic = "force-dynamic";
export const GET = opsGet(getHome);

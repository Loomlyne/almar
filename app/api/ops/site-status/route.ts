// Owner API, contract §6 (plan 03.2-05): the public site's update status for the dashboard line. GET only.
import { opsGet } from "../../../../lib/ops/route";
import { getSiteStatus } from "../../../../lib/ops/site-update";

export const dynamic = "force-dynamic";
export const GET = opsGet(getSiteStatus);

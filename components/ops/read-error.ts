// Plan 05-04: an owner-API read failure said in words. A dropped connection, a timeout or an unavailable reply says the
// caller's own fallback; any other error says the kit's fixed sentence for its code. Pure: no React, no fetch.
import type { OpsKitCopy } from "../../lib/copy/ops-kit";
import type { OpsError } from "./api-types";
import { errorText } from "./error-text";

export function readError(kit: OpsKitCopy, error: OpsError, fallback: string): string {
  if (error.code === "unavailable" || error.code === "network" || error.code === "timeout") return fallback;
  return errorText(kit, error);
}

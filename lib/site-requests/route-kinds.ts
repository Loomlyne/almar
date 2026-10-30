// What POST /api/requests accepts (plans 06-05, 06-06). The route and handleSiteRequestPost have no per-kind code: a kind and its
// prepare hook are added here and nowhere else.

import { preparePackageRequest } from "./package";
import type { PrepareRequest } from "./submit";
import type { SiteRequestKind } from "./types";

export const REQUEST_ROUTE_KINDS = ["plan", "list", "package"] as const;

export const REQUEST_PREPARE: Partial<Record<SiteRequestKind, PrepareRequest>> = { package: preparePackageRequest };

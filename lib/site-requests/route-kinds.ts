// What POST /api/requests accepts (plan 06-05). 06-06 appends "package" to REQUEST_ROUTE_KINDS and REQUEST_PREPARE.package here;
// nothing else changes, because the route and handleSiteRequestPost have no per-kind code.

import type { PrepareRequest } from "./submit";
import type { SiteRequestKind } from "./types";

export const REQUEST_ROUTE_KINDS = ["plan", "list"] as const;

export const REQUEST_PREPARE: Partial<Record<SiteRequestKind, PrepareRequest>> = {};

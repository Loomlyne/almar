// Phase 5 plan 05-01: the contract of the owner's Home, Customers and Profile routes (OPS-03, OPS-08, P5-08, P5-09, P5-10).
// Types only: no import and no runtime export, so nothing here enters a bundle. 05-04 builds the routes and screens from it.

/** GET /api/ops/home?range=month|30d or ?from=YYYY-MM-DD&to=YYYY-MM-DD (Custom). The route works out days in Dubai time. P5-08. */
export type HomeRange = "month" | "30d" | "custom";
export type HomeNumbers = {
  from: string;
  to: string;
  bookings: number;
  received_fils: number;
  refunded_fils: number;
  /** Bank payments received in the range minus refunds in the range; may be negative. */
  recorded_fils: number;
  /** Still due now, independent of the range. */
  outstanding_fils: number;
  outstanding_count: number;
};
export type HomeAnswer = { ok: true } & HomeNumbers;

/** GET /api/ops/customers?q=&after=&limit= P5-09. */
export type CustomerRow = { email: string; name: string; phone: string; bookings: number; last_arrive: string };
export type CustomersAnswer = { ok: true; items: CustomerRow[]; next: string | null };

/** GET /api/ops/profile. Read-only from the session's profile row, first and last name joined; null when both are empty. P5-10. */
export type ProfileAnswer = { ok: true; name: string | null; email: string };

// lib/site-requests/types.ts (plan 06-01, Task 4)
//
// Types only, plus one constant: the four kinds of request a guest sends from the public site (F-10, F-01, F-04) and the
// caps of every field. The SQL copy of these caps is public.site_request_payload_ok in migration
// 20261025120000_site_cms.sql (the check on site_requests.payload): change both in one commit. 06-05 builds the validator
// and the routes on these names; 06-06 sends kind `package`.
//
// `name` and `email` are columns of site_requests (the Requests list sorts and searches them); `payload` holds the rest,
// with only the keys of its kind. Every text is the guest's own words: no number here is a price or a rate we set.

export const SITE_REQUEST_KINDS = ["plan", "list", "package", "consultation"] as const;
export type SiteRequestKind = (typeof SITE_REQUEST_KINDS)[number];

/** Fields every kind carries. */
export type RequestContact = {
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
};

/** Plan with us (SITE-04): all optional except the contact. Dates are "YYYY-MM-DD", from before to. */
export type PlanRequest = RequestContact & {
  destination?: string | null;
  from?: string | null;
  to?: string | null;
  guests?: number | null;
  /** The guest's own words ("around 20k"), never a number we compute. */
  budget?: string | null;
  /** UAE airport the guest flies from. */
  airport?: string | null;
};

/** List with us (SITE-05): footer link only, no partner login. */
export type ListRequest = RequestContact & {
  property_type: string;
  city: string;
  message: string;
};

/** A package request (F-01, BOOK-05): the package page's form; the owner replies with the amount. */
export type PackageRequest = RequestContact & {
  /** The slug of a published package; the database refuses any other (almar:invalid). */
  tier_slug: string;
  from?: string | null;
  to?: string | null;
  guests?: number | null;
  cities?: string[] | null;
};

/** A consultation booking (SITE-06): a 30-minute slot the guest picked, shown in their own time zone. */
export type ConsultationRequest = RequestContact & {
  /** ISO timestamp with offset of the slot start (a :00 or :30 boundary). */
  slot_start: string;
  /** The guest's IANA time zone, for the email and the .ics. */
  time_zone: string;
};

export type SiteRequestPayload = {
  plan: PlanRequest;
  list: ListRequest;
  package: PackageRequest;
  consultation: ConsultationRequest;
};

type TextCap = { kind: "text"; min: number; max: number };
type Cap =
  | TextCap
  | { kind: "email"; max: number }
  | { kind: "phone"; pattern: RegExp }
  | { kind: "day" }
  | { kind: "int"; min: number; max: number }
  | { kind: "slug"; max: number }
  | { kind: "list"; maxItems: number; item: TextCap }
  | { kind: "timestamp" }
  | { kind: "timezone"; max: number };

export type FieldCap = Cap & { required: boolean };

const req = (cap: Cap): FieldCap => ({ ...cap, required: true });
const opt = (cap: Cap): FieldCap => ({ ...cap, required: false });

const CONTACT = {
  name: req({ kind: "text", min: 1, max: 120 }),
  email: req({ kind: "email", max: 254 }),
  phone: opt({ kind: "phone", pattern: /^\+?[0-9 ()-]{7,20}$/ }),
  notes: opt({ kind: "text", min: 0, max: 2000 }),
} as const;

/**
 * Every field of every kind, its type and its limits. A key not listed for its kind is refused. Dates are YYYY-MM-DD and
 * `from` < `to` when both are present (checked by the validator and the SQL, not expressible here).
 */
export const SITE_REQUEST_CAPS: { readonly [K in SiteRequestKind]: Readonly<Record<keyof SiteRequestPayload[K], FieldCap>> } = {
  plan: {
    ...CONTACT,
    destination: opt({ kind: "text", min: 0, max: 120 }),
    from: opt({ kind: "day" }),
    to: opt({ kind: "day" }),
    guests: opt({ kind: "int", min: 1, max: 99 }),
    budget: opt({ kind: "text", min: 0, max: 120 }),
    airport: opt({ kind: "text", min: 0, max: 80 }),
  },
  list: {
    ...CONTACT,
    property_type: req({ kind: "text", min: 1, max: 80 }),
    city: req({ kind: "text", min: 1, max: 120 }),
    message: req({ kind: "text", min: 1, max: 2000 }),
  },
  package: {
    ...CONTACT,
    tier_slug: req({ kind: "slug", max: 80 }),
    from: opt({ kind: "day" }),
    to: opt({ kind: "day" }),
    guests: opt({ kind: "int", min: 1, max: 99 }),
    cities: opt({ kind: "list", maxItems: 6, item: { kind: "text", min: 1, max: 120 } }),
  },
  consultation: {
    ...CONTACT,
    slot_start: req({ kind: "timestamp" }),
    time_zone: req({ kind: "timezone", max: 64 }),
  },
};

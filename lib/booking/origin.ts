// Which origin a booking endpoint accepts a POST from, and which origin a booking-page or email link points at. A host
// is never trusted on its own: only the three public origins, plus a plain-http dev origin outside production.
// (Job 02's linkOrigin lacks the preview host and is not edited.) No imports.
//
// The default publicOrigin is process.env.PUBLIC_ORIGIN, the one name this file reads: set only on Worker `almar-ops`.
// Guest links do not use it any more: they use originForBooking(isTest), chosen from the booking's own TEST flag.

const CANONICAL = "https://almarprivatejourney.com";
const WWW = "https://www.almarprivatejourney.com";
const PREVIEW = "https://preview.almarprivatejourney.com";

const ORIGINS: readonly string[] = [CANONICAL, WWW, PREVIEW];

const HOST_ORIGIN: Record<string, string> = {
  "almarprivatejourney.com": CANONICAL,
  "www.almarprivatejourney.com": WWW,
  "preview.almarprivatejourney.com": PREVIEW,
};

/** The accepted set, for a "which origins exist" check or a message. */
export function allowedBookingOrigins(): readonly string[] {
  return ORIGINS;
}

/**
 * The booking origin of a Host header. The three public hosts map to their own https origin; 127.0.0.1 and localhost
 * (with a port) to plain http, only when nodeEnv is not "production"; any other host (the ops host on `almar-ops`)
 * to publicOrigin when that is exactly one of the three https origins, else the canonical origin.
 */
export function bookingOrigin(
  host: string | null | undefined,
  nodeEnv: string | undefined,
  publicOrigin: string | undefined = process.env.PUBLIC_ORIGIN,
): string {
  const name = (host ?? "").trim().toLowerCase();
  const known = HOST_ORIGIN[name];
  if (known) return known;
  if (nodeEnv !== "production" && /^(127\.0\.0\.1|localhost)(:\d{2,5})?$/.test(name)) return `http://${name}`;
  const configured = (publicOrigin ?? "").trim();
  return ORIGINS.includes(configured) ? configured : CANONICAL;
}

/** True only when the Origin header equals the booking origin of the Host. A missing, empty or "null" Origin is false. */
export function isAllowedPostOrigin(
  originHeader: string | null | undefined,
  host: string | null | undefined,
  nodeEnv: string | undefined,
): boolean {
  if (!originHeader) return false;
  return originHeader === bookingOrigin(host, nodeEnv);
}

// ---------------------------------------------------------------- TEST bookings and guest links (04-08)

/**
 * True when a booking made on this Host is a TEST booking. Only the production host and www are real (trimmed, any
 * case, no port accepted); the preview host, the local hosts, the ops host, an empty or missing Host and any other
 * name are TEST. Decided by the Host header, never by a request body.
 */
export function isTestHost(host: string | null | undefined): boolean {
  const name = (host ?? "").trim().toLowerCase();
  return name !== "almarprivatejourney.com" && name !== "www.almarprivatejourney.com";
}

/** The origin a guest's link points at: the production origin for a real booking, the preview origin for a TEST one. */
export function originForBooking(isTest: boolean): string {
  return isTest ? PREVIEW : CANONICAL;
}

/**
 * The booking page's path: `/<locale>/bookings/trip?ref=<ref>&t=<t>` (`/en`, `/ar` or `/es`; every page is
 * locale-prefixed since #33). Without `t` the path carries the ref only (the signed-in guest's email decides then). Both values
 * are URL-encoded.
 */
export function bookingPagePath(locale: "en" | "ar" | "es", ref: string, t?: string): string {
  const prefix = `/${locale}`; // every page is /en|ar|es/… since job 21 (#33, owner decision 13)
  const query = `ref=${encodeURIComponent(ref)}` + (t === undefined ? "" : `&t=${encodeURIComponent(t)}`);
  return `${prefix}/bookings/trip?${query}`;
}

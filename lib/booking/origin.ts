// Which origin the booking endpoints accept a POST from, and which origin a Stripe return URL or an email link may
// point at. A host is never trusted on its own: only the three public origins, plus a plain-http dev origin outside
// production. (Job 02's linkOrigin lacks the preview host and is not edited.) No imports.
//
// The default publicOrigin is process.env.PUBLIC_ORIGIN, the one name this file reads: set only on Worker `almar-ops`
// by the owner (the preview origin while Stripe is TEST, the production origin at go-live).

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

// The visitor's cookie choice (plan 06-04, F-05, SITE-07). Pure: no document, no React. A first-party cookie, not HttpOnly:
// the pages are static, the browser reads it and no server does. It carries no identity. Marketing is not built (owner, P6-Q4:
// no switch until a marketing tool exists). The lifetime is the owner's, signed with the pictures: 180 days.

export const CONSENT_COOKIE = "almar-consent";
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

const ANALYTICS_ON = "v1.a1";
const ANALYTICS_OFF = "v1.a0";

export type ConsentChoice = { analytics: boolean };

/** The choice in a Cookie header or document.cookie; null when there is none yet or the value is not ours (the banner shows). */
export function parseConsent(cookieHeader: string | null | undefined): ConsentChoice | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at === -1 || part.slice(0, at).trim() !== CONSENT_COOKIE) continue;
    const value = part.slice(at + 1).trim();
    if (value === ANALYTICS_ON) return { analytics: true };
    if (value === ANALYTICS_OFF) return { analytics: false };
    return null;
  }
  return null;
}

/** The string to give document.cookie. */
export function serializeConsent(choice: ConsentChoice): string {
  return `${CONSENT_COOKIE}=${choice.analytics ? ANALYTICS_ON : ANALYTICS_OFF}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax; Secure`;
}

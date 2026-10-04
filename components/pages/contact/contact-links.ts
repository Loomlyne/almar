import type { ContactDetails } from "../../../lib/data/types";
import { isHttpsUrl } from "../../../lib/https-url";

// The one place on the Contact page that builds a tel:, wa.me or mailto: href. Every input is validated and a value
// that fails throws, so a tampered fixture (or, later, a Settings row) fails the static build instead of shipping a
// broken or injected link (threat T-3.3-24-01). Pure: no React, no fixture.

/** The English path of this page. localePath turns it into the address in each language. */
export const CONTACT_PATH = "/contact";

export type ContactLinks = {
  /** The Google Maps search page for the location (opens in a new tab). */
  location: string;
  tel: string;
  /** https://wa.me/<digits> with no message. */
  whatsapp: string;
  /** The same, with the page language's prefilled sentence. */
  whatsappMessage: string;
  mailto: string;
};

const PHONE = /^\+(?!0)\d{8,15}$/;
// One plain address: no whitespace (CR and LF included), no quote or angle bracket, and none of ? & , that would add
// a header, a recipient or a subject to a mailto: link.
const EMAIL = /^[^\s@?&,"'<>]+@[^\s@?&,"'<>]+\.[^\s@?&,"'<>]+$/;

export function contactLinks(details: ContactDetails): ContactLinks {
  const { phone_e164: phone, location_url: location, email } = details;

  if (typeof phone !== "string" || !PHONE.test(phone)) {
    throw new Error("contact: phone_e164 must be + and 8 to 15 digits");
  }
  if (
    typeof location !== "string" ||
    !isHttpsUrl(location) ||
    /[\s"'<>`\\]/.test(location) ||
    /javascript:/i.test(location)
  ) {
    throw new Error("contact: location_url must be one plain https:// address");
  }
  if (typeof email !== "string" || !EMAIL.test(email)) {
    throw new Error("contact: email must be one plain local@domain.tld address");
  }

  const whatsapp = `https://wa.me/${phone.slice(1)}`;
  return {
    location,
    tel: `tel:${phone}`,
    whatsapp,
    whatsappMessage: `${whatsapp}?text=${encodeURIComponent(details.whatsapp_message)}`,
    mailto: `mailto:${email}`,
  };
}

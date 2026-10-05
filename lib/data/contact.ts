// lib/data/contact.ts
//
// Server only. The business's own contact details (D-92): Dashboard > Settings > Business and brand replaces
// the fixture in Phase 3.2/6 and nothing else changes. The fixture stores no URL (the media scripts and
// tests/data-sample.test.mjs refuse one), so the two URLs the type carries are built here from fixed https
// prefixes and a validated query or handle: a malformed or hostile Settings value cannot become an href
// (threat T-3.3-20-02).

import { readFixture, resolveRow, type StoredStatus } from "./resolve";
import type { ContactDetails, Locale } from "./types";

const MAPS_SEARCH_BASE = "https://www.google.com/maps/search/";
const INSTAGRAM_BASE = "https://www.instagram.com/";

type ContactBase = {
  id: string;
  created_at: string;
  updated_at: string;
  is_sample: boolean;
  sample_fields: string[];
  business_name: string;
  location_query: string;
  phone_e164: string;
  phone_display: string;
  email: string;
  instagram_handle: string;
};
type ContactTranslation = {
  contact_id: string;
  locale: Locale;
  status: StoredStatus;
  location_label: string;
  whatsapp_message: string;
};

function validate(row: ContactBase): void {
  if (!/^\+[1-9]\d{7,14}$/.test(row.phone_e164)) throw new Error("contact: phone_e164 is not an E.164 number");
  // "%" would let a percent escape decode to a header break or a second recipient inside a mailto: link; ";" separates
  // recipients in some mail clients. contactLinks refuses the same two characters.
  if (typeof row.email !== "string" || row.email.split("@").length !== 2 || /[\s%;]/.test(row.email)) {
    throw new Error('contact: email must hold exactly one @ and no space, "%" or ";"');
  }
  if (!/^[a-z0-9._]+$/.test(row.instagram_handle)) throw new Error("contact: instagram_handle is outside [a-z0-9._]");
  if (typeof row.location_query !== "string" || row.location_query.length === 0 || /[/?#]/.test(row.location_query)) {
    throw new Error('contact: location_query must not contain "/", "?" or "#"');
  }
}

export async function getContactDetails(locale: Locale): Promise<ContactDetails> {
  const row = readFixture<ContactBase>("contact");
  validate(row);
  const r = resolveRow(row, readFixture<ContactTranslation[]>("contact-translations"), locale);
  return {
    business_name: r.business_name,
    location_label: r.location_label,
    // Encoded as a whole, then the spaces written as + (the form Google Maps uses): a "%" or any reserved character in
    // the query cannot make a malformed or hijacked address.
    location_url: MAPS_SEARCH_BASE + encodeURIComponent(row.location_query).replace(/%20/g, "+"),
    phone_e164: r.phone_e164,
    phone_display: r.phone_display,
    email: r.email,
    whatsapp_message: r.whatsapp_message,
    instagram_url: `${INSTAGRAM_BASE}${row.instagram_handle}/`,
    locale: r.locale,
    translation_status: r.translation_status,
  };
}

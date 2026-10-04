// The organisation JSON-LD every public page carries. Carried byte-for-byte from the live Framer home
// (app/route.ts, <script id="almar-organization-schema">), identical on all 26 live pages on 2026-10-03.
// tests/json-ld-domain.test.mjs and tests/build/assembled-site.test.mjs require it on every React document.
//
// Use in a server component, once per page:
//   <script {...ORGANIZATION_JSON_LD_SCRIPT} />
// A constant string, so the raw HTML below is not an injection surface.

export const ORGANIZATION_JSON_LD =
  '{"@context":"https://schema.org","@type":["Organization","TravelAgency"],"@id":"https://almarprivatejourney.com/#organization","name":"ALMAR Private Journeys","url":"https://almarprivatejourney.com/","description":"Private journeys in Colombia.","areaServed":{"@type":"Country","name":"Colombia"}}';

export const ORGANIZATION_JSON_LD_SCRIPT = {
  id: "almar-organization-schema",
  type: "application/ld+json",
  dangerouslySetInnerHTML: { __html: ORGANIZATION_JSON_LD },
} as const;

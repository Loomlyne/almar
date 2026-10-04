import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { ORGANIZATION_JSON_LD, ORGANIZATION_JSON_LD_SCRIPT } from "../components/site/organization-json-ld.ts";

test("the organisation JSON-LD parses and names the real domain", () => {
  const data = JSON.parse(ORGANIZATION_JSON_LD);
  assert.deepEqual(data["@type"], ["Organization", "TravelAgency"]);
  assert.equal(data["@id"], "https://almarprivatejourney.com/#organization");
  assert.equal(data.url, "https://almarprivatejourney.com/");
  assert.equal(ORGANIZATION_JSON_LD.includes("framer.website"), false);
});

test("the script props render the string raw, under the id the Framer pages use", () => {
  assert.equal(ORGANIZATION_JSON_LD_SCRIPT.id, "almar-organization-schema");
  assert.equal(ORGANIZATION_JSON_LD_SCRIPT.type, "application/ld+json");
  assert.equal(ORGANIZATION_JSON_LD_SCRIPT.dangerouslySetInnerHTML.__html, ORGANIZATION_JSON_LD);
});

test("while the Framer home exists, the helper is byte-for-byte its block", () => {
  if (!existsSync("app/route.ts")) return; // converted to React: the build test guards the output instead
  const source = readFileSync("app/route.ts", "utf8");
  const escaped = ORGANIZATION_JSON_LD.replaceAll('"', '\\"');
  assert.ok(source.includes(`id=\\"almar-organization-schema\\" type=\\"application/ld+json\\">${escaped}</script>`));
});

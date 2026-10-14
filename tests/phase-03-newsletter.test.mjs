import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const routeSource = readFileSync("app/newsletter/route.ts", "utf8");
const footerSource = readFileSync("components/ui/footer.tsx", "utf8");
// 3.3 plan 04: the home is a React page. Its source is the route file, the page component and the home parts.
const homeSource = [
  "app/page.tsx",
  "components/pages/home-page.tsx",
  ...readdirSync("components/pages/home").map((name) => `components/pages/home/${name}`),
]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
const envExample = readFileSync(".env.example", "utf8");

test("the newsletter route calls contacts.create", () => {
  assert.equal(routeSource.includes("contacts.create"), true);
});

test("the newsletter route never calls emails.send", () => {
  assert.equal(routeSource.includes("emails.send"), false);
  assert.equal(footerSource.includes("emails.send"), false);
  assert.equal(homeSource.includes("emails.send"), false);
});

test("the newsletter route does not set a from address", () => {
  assert.equal(/\bfrom\s*:/.test(routeSource), false);
});

test("a non-empty title honeypot is a rejection path in the source", () => {
  assert.equal(routeSource.includes('"title"'), true);
  assert.equal(routeSource.includes("HONEYPOT_FIELDS"), true);
  // Plan 27 hardening: every refusal goes through refused(<status>) (JSON {"ok":false}, no-store).
  assert.match(routeSource, /isFilled\(formData\.get\(field\)\)\)\s*\{\s*return refused\(400\)/);
});

test("the other listed honeypot fields are present", () => {
  const fields = [
    "website",
    "company",
    "message",
    "subject",
    "description",
    "feedback",
    "notes",
    "details",
    "remarks",
    "comments",
  ];
  for (const field of fields) {
    assert.equal(routeSource.includes(`"${field}"`), true, `missing honeypot field ${field}`);
  }
});

test("a missing RESEND_API_KEY is a 503 and does not toast from this file", () => {
  assert.equal(routeSource.includes("RESEND_API_KEY"), true);
  assert.match(routeSource, /if \(!apiKey\) \{\s*return refused\(503\)/);
  // No toast from this file (the capped body reader's chunks.push is not one).
  assert.equal(/(?<!chunks\.)push\(|useToast/.test(routeSource), false);
});

test("the route source has no hardcoded re_ key string", () => {
  assert.equal(/re_[A-Za-z0-9]{10,}/.test(routeSource), false);
});

test(".env.example is not modified to hold a Resend key value", () => {
  const match = envExample.match(/RESEND_API_KEY\s*=\s*(.*)/);
  assert.ok(match, "RESEND_API_KEY line must exist");
  assert.equal(match[1].trim(), "");
});

test("the newsletter route reads the email from field name Email", () => {
  assert.equal(routeSource.includes('formData.get("Email")'), true);
});

test("success requires data.id to be a non-empty string, and the 200 is exactly {ok: true}: the id never leaves", () => {
  assert.match(routeSource, /data\?\.id/);
  assert.match(routeSource, /return reply\(\{ ok: true \}, 200\)/);
  // Plan 27: the Resend contact id is not in any answer.
  assert.equal(/id:\s*data\.id|ok: true, id/.test(routeSource), false);
});

test("plan 27 hardening is in the source: origin, content type, size, rate limit, no-store, no address logged", () => {
  assert.match(routeSource, /if \(!sameOrigin\(request\)\) return refused\(403\)/);
  assert.match(routeSource, /return refused\(415\)/);
  assert.match(routeSource, /readBody\(request, MAX_BODY_BYTES\)/);
  assert.match(routeSource, /allowFormPost\(request, "newsletter"\)\)\) return refused\(429\)/);
  assert.match(routeSource, /"cache-control": "no-store"/);
  assert.equal(/console\.(log|info|warn|debug)|NODE_ENV/.test(routeSource), false);
  const logs = routeSource.match(/console\.\w+\([^;]*\);/g) ?? [];
  assert.equal(logs.length, 2);
  for (const line of logs) assert.equal(/mail|formData|data\b|error\)/i.test(line.replace("newsletter: add failed", "")), false, line);
  assert.equal(routeSource.includes("re_"), false);
});

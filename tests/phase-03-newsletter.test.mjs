import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("app/newsletter/route.ts", "utf8");
const shellSource = readFileSync("app/framer/framer-shell.tsx", "utf8");
const sourceRouteSource = readFileSync("app/framer/source/route.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");

test("the newsletter route calls contacts.create", () => {
  assert.equal(routeSource.includes("contacts.create"), true);
});

test("the newsletter route never calls emails.send", () => {
  assert.equal(routeSource.includes("emails.send"), false);
  assert.equal(shellSource.includes("emails.send"), false);
  assert.equal(sourceRouteSource.includes("emails.send"), false);
});

test("the newsletter route does not set a from address", () => {
  assert.equal(/\bfrom\s*:/.test(routeSource), false);
});

test("a non-empty title honeypot is a rejection path in the source", () => {
  assert.equal(routeSource.includes('"title"'), true);
  assert.equal(routeSource.includes("HONEYPOT_FIELDS"), true);
  assert.match(routeSource, /status:\s*400/);
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
  assert.match(routeSource, /status:\s*503/);
  assert.equal(routeSource.includes("push("), false);
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

test("success requires data.id to be a non-empty string", () => {
  assert.match(routeSource, /data\?\.id/);
  assert.match(routeSource, /status:\s*200/);
});

test("the framer/source injection retargets the existing form to /newsletter", () => {
  assert.equal(sourceRouteSource.includes("framer-8a2tsb"), true);
  assert.equal(sourceRouteSource.includes("/newsletter"), true);
  assert.equal(sourceRouteSource.includes("Subscribe"), true);
});

test("the framer/source injection does not add a hero-search-submit class to the newsletter button", () => {
  const idx = sourceRouteSource.indexOf("newsletterScript");
  assert.notEqual(idx, -1);
});

test("the framer/source injection never uses innerHTML to insert the response body", () => {
  assert.equal(sourceRouteSource.includes(".innerHTML ="), false);
});

test("the shell pushes Subscribed. only from the newsletter ok message path", () => {
  assert.equal(shellSource.includes('push("Subscribed.")'), true);
  assert.equal(shellSource.includes("Check your inbox."), false);
  const pushCount = shellSource.split('push("Subscribed.")').length - 1;
  assert.equal(pushCount, 1);
});

test("the shell does not import SiteFooter", () => {
  assert.equal(shellSource.includes("SiteFooter"), false);
});

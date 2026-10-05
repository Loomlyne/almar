import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { OWNER_EMAIL } = await loadTs("lib/auth/rules.ts");
const { ownerDecision } = await loadTs("lib/auth/owner-decision.ts");

const owner = { role: "owner", email: OWNER_EMAIL };

test("not on the ops host: not_owner, even for the owner", () => {
  assert.equal(ownerDecision({ shell: null, profile: owner, hasAdmin: true }), "not_owner");
  assert.equal(ownerDecision({ shell: "marketing", profile: owner, hasAdmin: true }), "not_owner");
  assert.equal(ownerDecision({ shell: "", profile: owner, hasAdmin: true }), "not_owner");
});

test("no session: not_owner", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: null, hasAdmin: true }), "not_owner");
});

test("the owner role with another email is not the owner", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: { role: "owner", email: "someone@else.com" }, hasAdmin: true }), "not_owner");
});

test("the owner email with the guest role is not the owner", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: { role: "guest", email: OWNER_EMAIL }, hasAdmin: true }), "not_owner");
});

test("the owner without a service-role client: unavailable", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: owner, hasAdmin: false }), "unavailable");
});

test("a non-owner without a service-role client is still not_owner, never unavailable", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: null, hasAdmin: false }), "not_owner");
  assert.equal(ownerDecision({ shell: null, profile: owner, hasAdmin: false }), "not_owner");
});

test("the owner on the ops host with a client: ok", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: owner, hasAdmin: true }), "ok");
  assert.equal(ownerDecision({ shell: "ops", profile: { role: "owner", email: OWNER_EMAIL.toUpperCase() }, hasAdmin: true }), "ok");
});

const code = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

test("source guard: requireOwner reads the middleware header and the verified user, builds no key itself", () => {
  const src = code("lib/auth/require-owner.ts");
  assert.match(src, /import \{[^}]*\bSHELL_HEADER\b[^}]*\} from "\.\.\/host"/);
  assert.match(src, /import \{[^}]*\breadSessionProfile\b[^}]*\} from "\.\.\/supabase\/clients"/);
  assert.match(src, /import \{[^}]*\bcreateSupabaseAdmin\b[^}]*\} from "\.\.\/supabase\/clients"/);
  assert.match(src, /import \{ ownerDecision \} from "\.\/owner-decision"/);
  assert.match(src, /\(await headers\(\)\)\.get\(SHELL_HEADER\)/);
  assert.equal(/getSession/.test(src), false, "never getSession");
  assert.equal(/SUPABASE_SERVICE_ROLE_KEY/.test(src), false, "the key is read in lib/supabase/clients.ts only");
  assert.equal(/\bprocess\.env\b/.test(src), false);
  assert.equal(/new Response|Response\.json|NextResponse/.test(src), false, "it builds no Response");
});

test("source guard: the pure rule uses isOwnerProfile and nothing else", () => {
  const src = code("lib/auth/owner-decision.ts");
  assert.match(src, /import \{ isOwnerProfile \} from "\.\/rules"/);
  assert.equal((src.match(/^import /gm) ?? []).length, 1);
  assert.match(src, /input\.shell !== "ops"/);
});

test("the shell header the gate trusts is dropped from the client and set only for the ops host", () => {
  const middleware = code("middleware.ts");
  const drop = middleware.indexOf("forwarded.delete(SHELL_HEADER);");
  const set = middleware.indexOf('if (isOpsHost(host)) forwarded.set(SHELL_HEADER, "ops");');
  assert.ok(drop > -1 && set > drop, "client copy dropped, then set for the ops host only");
  assert.equal(middleware.split("forwarded.set(SHELL_HEADER").length - 1, 1, "set in one place");
});

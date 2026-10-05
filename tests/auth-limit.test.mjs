import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { ipLimitKey, isTokenHashShape, limiterHash, visitorIpKey } from "../lib/auth/limit.ts";
import { signContinue, verifyContinue } from "../lib/auth/continue.ts";
import { OPS_HOST_LIVE, opsHandoffOpen } from "../lib/host.ts";

const code = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

test("IPv4 is limited by the full address", () => {
  assert.equal(ipLimitKey("203.0.113.7"), "v4:203.0.113.7");
  assert.notEqual(ipLimitKey("203.0.113.7"), ipLimitKey("203.0.113.8"));
});

test("IPv6 is limited by its /64: same prefix, same key; another prefix, another key", () => {
  const a = ipLimitKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
  assert.equal(a, "v6:2001:0db8:0001:0002");
  assert.equal(ipLimitKey("2001:db8:1:2::1"), a);
  assert.equal(ipLimitKey("2001:DB8:1:2:ffff:ffff:ffff:ffff"), a);
  assert.notEqual(ipLimitKey("2001:db8:1:3::1"), a);
});

test("IPv6 forms: :: compression at the start, middle and end, zone id, brackets", () => {
  assert.equal(ipLimitKey("::1"), "v6:0000:0000:0000:0000");
  assert.equal(ipLimitKey("2001:db8::"), "v6:2001:0db8:0000:0000");
  assert.equal(ipLimitKey("2001:db8::5:1"), "v6:2001:0db8:0000:0000");
  assert.equal(ipLimitKey("fe80::1%en0"), "v6:fe80:0000:0000:0000");
  assert.equal(ipLimitKey("[2001:db8:1:2::9]"), "v6:2001:0db8:0001:0002");
  assert.equal(ipLimitKey("1:2:3:4:5:6:7:8"), "v6:0001:0002:0003:0004");
});

test("an IPv4-mapped IPv6 address is the IPv4 address", () => {
  assert.equal(ipLimitKey("::ffff:203.0.113.7"), "v4:203.0.113.7");
  assert.equal(ipLimitKey("::FFFF:cb00:7107"), "v4:203.0.113.7");
  assert.equal(ipLimitKey("0:0:0:0:0:ffff:10.1.2.3"), "v4:10.1.2.3");
  assert.equal(ipLimitKey("::ffff:203.0.113.7"), ipLimitKey("203.0.113.7"));
});

test("missing or unreadable addresses are one 'none' bucket", () => {
  for (const bad of [null, undefined, "", "  ", "nonsense", "1.2.3", "1.2.3.256", "1:2:3", "1::2::3", "12345::1", "1:2:3:4:5:6:7:8:9", "::g"]) {
    assert.equal(ipLimitKey(bad), "none", String(bad));
  }
  assert.equal(visitorIpKey(null), "none");
  assert.equal(visitorIpKey("203.0.113.7, 10.0.0.1"), "v4:203.0.113.7");
});

test("token_hash shape: lowercase hex, 40 to 128 characters", () => {
  const sha224 = "a".repeat(56);
  assert.equal(isTokenHashShape(sha224), true);
  assert.equal(isTokenHashShape("0123456789abcdef".repeat(2) + "01234567"), true);
  for (const bad of ["", "hash123", "A".repeat(56), "a".repeat(39), "a".repeat(129), `${"a".repeat(55)}g`, `${"a".repeat(56)}\n`, " " + "a".repeat(56), null, undefined, 42, new Blob([])]) {
    assert.equal(isTokenHashShape(bad), false, String(bad));
  }
});

test("limiterHash is keyed: another key, kind or value changes it; the plain SHA-256 is never the output", () => {
  const k1 = Buffer.from("k1");
  const k2 = Buffer.from("k2");
  const h = limiterHash(k1, "ip", "v4:1.2.3.4");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, limiterHash(k1, "ip", "v4:1.2.3.4"));
  assert.notEqual(h, limiterHash(k2, "ip", "v4:1.2.3.4"));
  assert.notEqual(h, limiterHash(k1, "email", "v4:1.2.3.4"));
  assert.notEqual(h, limiterHash(k1, "confirm", "v4:1.2.3.4"));
  assert.equal(h, createHmac("sha256", k1).update("ip\nv4:1.2.3.4").digest("hex"));
});

test("clients.ts derives both keys from the service-role key with their own labels, and is the only reader", () => {
  const clients = code("lib/supabase/clients.ts");
  assert.match(clients, /export function authSigningKey\(label: "continue" \| "limit"\): Buffer \| null/);
  assert.match(clients, /createHmac\("sha256", serviceKey\)\.update\(`almar-\$\{label\}-v1`\)\.digest\(\)/);
  for (const path of ["lib/auth/magic-link-server.ts", "app/auth/confirm/page.tsx", "app/auth/confirm/actions.ts"]) {
    assert.equal(code(path).includes("SUPABASE_SERVICE_ROLE_KEY"), false, path);
  }
  assert.match(code("app/auth/confirm/page.tsx"), /authSigningKey\("continue"\)/);
  assert.match(code("lib/auth/magic-link-server.ts"), /authSigningKey\("continue"\)/);
});

test("Continue signatures verify with a derived Buffer key and not with another label's", () => {
  const derive = (label) => createHmac("sha256", "service").update(`almar-${label}-v1`).digest();
  const s = signContinue(derive("continue"), "h".repeat(56), "l•••@gmail.com");
  assert.equal(verifyContinue(derive("continue"), "h".repeat(56), "l•••@gmail.com", s), true);
  assert.equal(verifyContinue(derive("limit"), "h".repeat(56), "l•••@gmail.com", s), false);
  assert.equal(verifyContinue("service", "h".repeat(56), "l•••@gmail.com", s), false);
  assert.equal(signContinue(null, "h", "m"), undefined);
});

test("confirmSignIn: shape first, then the slot, then verifyOtp; a limiter error or no key goes to expired", () => {
  const action = code("app/auth/confirm/actions.ts");
  const shape = action.indexOf("isTokenHashShape(tokenHash)");
  const slot = action.indexOf('rpc("claim_confirm_slot"');
  const verify = action.indexOf("verifyOtp");
  assert.ok(shape > -1 && slot > shape && verify > slot);
  assert.match(action, /p_ip_key: limiterHash\(limitKey, "confirm", visitorIpKey\(/);
  assert.match(action, /allowed = !error && data === true/);
  assert.match(action, /catch \{\s*allowed = false;/);
  assert.match(action, /if \(!allowed\) redirect\(expired\)/);
  assert.match(action, /if \(!limitKey \|\| !admin \|\| !supabase\) redirect\(expired\)/);
  assert.equal(/createSupabaseServer\(\)[\s\S]*isTokenHashShape/.test(action), false, "no Supabase client is made before the shape check");
});

test("OPS_HOST_LIVE is false; the handoff is open outside production only", () => {
  assert.equal(OPS_HOST_LIVE, false);
  assert.equal(opsHandoffOpen("production"), false);
  assert.equal(opsHandoffOpen("development"), true);
  assert.equal(opsHandoffOpen("test"), true);
  assert.equal(opsHandoffOpen(undefined), true);
});

test("TOUCHWORD is hidden in production and /auth/handoff/start redirects home before any work", () => {
  assert.match(code("components/ui/account-menu.tsx"), /account\.opsHref && opsHandoffOpen\(process\.env\.NODE_ENV\)/);
  const route = code("app/auth/handoff/start/route.ts");
  const gate = route.indexOf("if (!opsHandoffOpen(process.env.NODE_ENV)) return home;");
  assert.ok(gate > -1);
  for (const work of ["readSessionProfile()", "createSupabaseAdmin()", ".insert("]) assert.ok(route.indexOf(work) > gate, work);
  assert.match(route, /status: 303, headers: NO_TRACE/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.match(readFileSync("lib/host.ts", "utf8"), /export const OPS_HOST_LIVE = false;/);
});

test("saveProfile treats zero updated rows as failed", () => {
  const source = code("app/account/actions.ts");
  const save = source.slice(source.indexOf("export async function saveProfile"), source.indexOf("export async function savePreferences"));
  assert.match(save, /\.select\("id"\)/);
  assert.match(save, /updated\.length === 0 \? \{ status: "failed" \}/);
});

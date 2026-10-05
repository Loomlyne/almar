// Security fix (job 02, low): the almar-return cookie (where to go after sign-in) gets the same production __Host-
// prefix as the link nonce cookie. A __Host- cookie is only accepted with Secure, Path=/ and no Domain, so the
// writers, the reader and the clearing all have to use the helpers: a plain delete() carries no Secure and would be
// dropped by the browser for a __Host- name.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { RETURN_COOKIE_MAX_AGE, returnCookieName, returnCookieOptions } from "../lib/auth/rules.ts";

test("returnCookieName: __Host- prefixed in production only", () => {
  assert.equal(returnCookieName("production"), "__Host-almar-return");
  assert.equal(returnCookieName("development"), "almar-return");
  assert.equal(returnCookieName("test"), "almar-return");
  assert.equal(returnCookieName(undefined), "almar-return");
});

test("returnCookieName reads NODE_ENV when called", () => {
  const before = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.equal(returnCookieName(), "__Host-almar-return");
    process.env.NODE_ENV = "development";
    assert.equal(returnCookieName(), "almar-return");
  } finally {
    process.env.NODE_ENV = before;
  }
});

test("returnCookieOptions: httpOnly, Lax, path /, one hour, Secure in production, never a Domain", () => {
  assert.equal(RETURN_COOKIE_MAX_AGE, 3600);
  assert.deepEqual(returnCookieOptions(RETURN_COOKIE_MAX_AGE, "production"), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 3600 });
  assert.deepEqual(returnCookieOptions(RETURN_COOKIE_MAX_AGE, "development"), { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 3600 });
  assert.equal(returnCookieOptions(0, "production").maxAge, 0, "clearing keeps every flag and sets maxAge 0");
  assert.equal(returnCookieOptions(0, "production").secure, true);
});

test("whatever name the helper returns, the options satisfy the __Host- rules for that name", () => {
  for (const env of ["production", "development", undefined]) {
    const name = returnCookieName(env);
    const options = returnCookieOptions(RETURN_COOKIE_MAX_AGE, env);
    if (name.startsWith("__Host-")) {
      assert.equal(options.secure, true, env);
      assert.equal(options.path, "/", env);
      assert.equal("domain" in options, false, env);
    }
  }
});

function files(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, acc);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) acc.push(path);
  }
  return acc;
}

test("the plain name lives in lib/auth/rules.ts only; nothing else spells it or imports RETURN_COOKIE", () => {
  const all = ["app", "components", "lib", "worker"].flatMap((dir) => files(dir)).concat(["middleware.ts"]);
  const spelled = all.filter((path) => /almar-return/.test(readFileSync(path, "utf8")));
  assert.deepEqual(spelled, [join("lib", "auth", "rules.ts")]);
  const oldName = all.filter((path) => /\bRETURN_COOKIE\b/.test(readFileSync(path, "utf8")));
  assert.deepEqual(oldName, []);
});

test("both sign-in actions write the return cookie with the helper name and options", () => {
  for (const file of ["app/login/actions.ts", "app/dashboard/actions.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /\.set\(\s*returnCookieName\(\)\s*,[^;]*returnCookieOptions\(\)/s, file);
    assert.equal(/httpOnly|sameSite|secure:/.test(source), false, `${file}: the flags come from returnCookieOptions only`);
  }
});

test("the reader of the return cookie (login page, confirm action) uses the helper name; the confirm action clears it with set(maxAge 0), not delete()", () => {
  const page = readFileSync("app/login/page.tsx", "utf8");
  assert.ok(page.includes("store.get(returnCookieName())"));
  const confirm = readFileSync("app/auth/confirm/actions.ts", "utf8");
  assert.ok(confirm.includes("store.get(returnCookieName())"));
  assert.match(confirm, /store\.set\(\s*returnCookieName\(\)\s*,\s*""\s*,\s*returnCookieOptions\(0\)\s*\)/);
  assert.equal(/store\.delete\(/.test(confirm), false, "delete() has no Secure flag; a __Host- cookie is only cleared with one");
});

test("serialised with Next's own cookie class, the write and the clear are valid __Host- Set-Cookie headers", async () => {
  const { ResponseCookies } = await import("next/dist/compiled/@edge-runtime/cookies/index.js");
  const headers = new Headers();
  const jar = new ResponseCookies(headers);
  jar.set(returnCookieName("production"), "/account", returnCookieOptions(RETURN_COOKIE_MAX_AGE, "production"));
  const written = headers.get("set-cookie");
  jar.set(returnCookieName("production"), "", returnCookieOptions(0, "production"));
  const cleared = headers.get("set-cookie");
  for (const header of [written, cleared]) {
    const parts = header.split(";").map((part) => part.trim().toLowerCase());
    assert.ok(header.startsWith("__Host-almar-return="), header);
    for (const required of ["secure", "path=/", "httponly", "samesite=lax"]) assert.ok(parts.includes(required), `${required}: ${header}`);
    assert.equal(parts.some((part) => part.startsWith("domain=")), false, header);
  }
  assert.ok(written.toLowerCase().includes("max-age=3600"), written);
  assert.ok(cleared.toLowerCase().includes("max-age=0"), cleared);
});

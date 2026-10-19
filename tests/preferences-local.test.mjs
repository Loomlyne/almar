// Plan 02-05 (addendum 2026-10-11), against this worktree's local stack: saveOwnPreferences with a guest's own session
// client writes her own profiles row, and the same client cannot write another guest's row (RLS "update own row") or a
// column outside the grant. lockStack(t): skipped without a stack, FAILS under ALMAR_REQUIRE_STACK=1.
// Two throwaway users are made and deleted here; nothing else in the database is touched, so no reset is needed.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { lockStack, requireStack } from "./helpers/local-supabase.mjs";
import { loadTs } from "./helpers/load-ts.mjs";

const { saveOwnPreferences } = await loadTs("lib/preferences-route.ts");

const NO_PERSIST = { auth: { persistSession: false, autoRefreshToken: false } };
const made = [];
let admin = null;
let release = null;

after(async () => {
  try {
    for (const id of made) await admin?.auth.admin.deleteUser(id);
  } finally {
    release?.();
  }
});

async function guest(stack) {
  const email = `p05-${randomUUID()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  assert.ifError(error);
  made.push(data.user.id);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  assert.ifError(link.error);
  const client = createClient(stack.url, stack.anonKey, NO_PERSIST);
  const verified = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  assert.ifError(verified.error);
  return { id: data.user.id, client, user: verified.data.user };
}

async function row(id) {
  const { data, error } = await admin.from("profiles").select("locale, currency, role").eq("id", id).single();
  assert.ifError(error);
  return data;
}

test("her session writes her own locale and currency, and nobody else's", async (t) => {
  const locked = await lockStack(t);
  if (!locked) return;
  release = locked.release;
  const stack = locked.stack;
  admin = createClient(stack.url, stack.serviceKey, NO_PERSIST);

  const a = await guest(stack);
  const b = await guest(stack);
  assert.deepEqual(await row(a.id), { locale: "en", currency: "AED", role: "guest" });

  assert.equal(await saveOwnPreferences(a.client, a.id, { locale: "ar", currency: "USD" }), true);
  assert.deepEqual(await row(a.id), { locale: "ar", currency: "USD", role: "guest" });

  assert.equal(await saveOwnPreferences(a.client, a.id, { currency: "EUR" }), true);
  assert.deepEqual(await row(a.id), { locale: "ar", currency: "EUR", role: "guest" }, "one field leaves the other");

  // Her client aimed at another guest's row: RLS hides it, zero rows, false; B is unchanged.
  assert.equal(await saveOwnPreferences(a.client, b.id, { locale: "es", currency: "USD" }), false);
  assert.deepEqual(await row(b.id), { locale: "en", currency: "AED", role: "guest" });

  // Outside the column grant: the database refuses, whatever the app sends.
  const { error } = await a.client.from("profiles").update({ role: "owner" }).eq("id", a.id).select("id");
  assert.ok(error, "role is not writable by her session");
  assert.equal((await row(a.id)).role, "guest");

  // A value outside the check constraint is refused by the database too.
  const bad = await a.client.from("profiles").update({ locale: "fr" }).eq("id", a.id).select("id");
  assert.ok(bad.error);
});

test("followAccount on real sessions: a new account saves the browser's language, a returning one restores hers", async (t) => {
  // The first test may hold the lock already; otherwise the lock comes before the stack look.
  const locked = release ? { stack: requireStack(t), release } : await lockStack(t);
  const stack = locked?.stack;
  if (!stack) return;
  release = locked.release;
  admin ??= createClient(stack.url, stack.serviceKey, NO_PERSIST);
  const { followAccount } = await loadTs("lib/account-follow.ts");
  const { isFirstSignIn } = await loadTs("lib/account-preferences.ts");

  const fresh = await guest(stack);
  const set = {};
  const common = { readCookie: (name) => (name === "almar-locale" ? "es" : undefined), setCookie: (n, v) => (set[n] = v), ops: false, production: false };
  // The real verifyOtp user of a just-confirmed account reads as its first sign-in.
  assert.equal(isFirstSignIn(fresh.user), true);
  assert.equal(await followAccount({ ...common, firstSignIn: true, client: fresh.client, userId: fresh.id, now: Date.now() }), "es");
  assert.equal((await row(fresh.id)).locale, "es");
  assert.equal(set["almar-prefs-sync"], "push");

  // The same account an hour later is a returning account: her saved row wins over the browser.
  await saveOwnPreferences(fresh.client, fresh.id, { locale: "ar", currency: "EUR" });
  const later = {};
  const locale = await followAccount({ ...common, setCookie: (n, v) => (later[n] = v), firstSignIn: false, client: fresh.client, userId: fresh.id, now: Date.now() + 60 * 60 * 1000 });
  assert.equal(locale, "ar");
  assert.deepEqual(later, { "almar-locale": "ar", "almar-prefs-sync": "EUR" });
});

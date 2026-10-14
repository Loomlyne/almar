// Plan 02-06 (PR #14 review round 2), against this worktree's local stack: postSettings with the service-role client
// saves through public.save_site_settings, so the settings row and the owner's language and currency change together;
// a refused call (not the owner) changes neither and replies with the error. requireStack(t): skipped without a stack,
// FAILS under ALMAR_REQUIRE_STACK=1. The owner user is made here when missing (and then deleted); the settings row and
// her profile are put back after.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { acquireStackLock, requireStack } from "./helpers/local-supabase.mjs";
import { loadTs } from "./helpers/load-ts.mjs";

const h = await loadTs("lib/settings/handlers.ts");

const NO_PERSIST = { auth: { persistSession: false, autoRefreshToken: false } };
const OWNER_EMAIL = "maria@almarprivatejourney.com";
const SAVE = {
  colors: { teal: "#7a1f3b", charcoal: "#262626", gold: "#d4ba8a", ivory: "#fffaf0", white: "#ffffff" },
  title_face: "Questa",
  body_face: "Lato",
  vat_percent: "7.50",
  deposit_percent: null,
  maintenance: false,
  logo_media_id: null,
  locale: "ar",
  currency: "USD",
};
let admin = null;
let release = null;
let madeOwner = null;
let before = null;

after(async () => {
  try {
    if (before) {
      await admin.from("site_settings").update(before.settings).eq("id", 1);
      if (!madeOwner) await admin.from("profiles").update(before.profile).eq("id", before.ownerId);
    }
    if (madeOwner) await admin.auth.admin.deleteUser(madeOwner);
  } finally {
    release?.();
  }
});

async function ownerProfile() {
  const found = await admin.from("profiles").select("id, locale, currency").eq("email", OWNER_EMAIL).maybeSingle();
  assert.ifError(found.error);
  if (found.data) return found.data;
  const created = await admin.auth.admin.createUser({ email: OWNER_EMAIL, email_confirm: true });
  assert.ifError(created.error);
  madeOwner = created.data.user.id;
  const made = await admin.from("profiles").select("id, locale, currency").eq("id", madeOwner).single();
  assert.ifError(made.error);
  return made.data;
}

async function state(ownerId) {
  const s = await admin.from("site_settings").select("teal, vat_percent, deposit_percent, maintenance").eq("id", 1).single();
  const p = await admin.from("profiles").select("locale, currency").eq("id", ownerId).single();
  assert.ifError(s.error);
  assert.ifError(p.error);
  return { ...s.data, ...p.data };
}

test("a Settings save goes through the one-transaction function: both change, or (refused) neither", async (t) => {
  const stack = requireStack(t);
  if (!stack) return;
  release = await acquireStackLock();
  admin = createClient(stack.url, stack.serviceKey, NO_PERSIST);
  const profile = await ownerProfile();
  const row = await admin.from("site_settings").select("teal, vat_percent, deposit_percent, maintenance").eq("id", 1).single();
  assert.ifError(row.error);
  before = { settings: row.data, profile: { locale: profile.locale, currency: profile.currency }, ownerId: profile.id };
  await admin.from("site_settings").update({ teal: null, vat_percent: 5, deposit_percent: 30, maintenance: false }).eq("id", 1);
  await admin.from("profiles").update({ locale: "en", currency: "AED" }).eq("id", profile.id);

  // Not the owner: the function refuses, nothing changes, the handler hands the error back.
  const refused = await h.postSettings({ owner: { profile: { id: "00000000-0000-4000-8000-0000000000ff", locale: "en", currency: "AED" }, admin }, body: SAVE, requestRebuild: async () => assert.fail("no rebuild on a refused save") });
  assert.ok(refused.dbError, "the reply is the error");
  assert.deepEqual(await state(profile.id), { teal: null, vat_percent: 5, deposit_percent: 30, maintenance: false, locale: "en", currency: "AED" });

  // The owner: one call changes the row and her language and currency.
  let rebuilds = 0;
  const saved = await h.postSettings({ owner: { profile, admin }, body: SAVE, requestRebuild: async () => { rebuilds += 1; } });
  assert.deepEqual(saved.body, { ok: true, affects_site: true });
  assert.equal(rebuilds, 1);
  assert.deepEqual(await state(profile.id), { teal: "#7a1f3b", vat_percent: 7.5, deposit_percent: null, maintenance: false, locale: "ar", currency: "USD" });
});

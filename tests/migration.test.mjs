import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260925120000_platform_spine.sql", "utf8")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

test("no storage and no password column", () => {
  assert.equal(/storage\./i.test(sql), false);
  assert.equal(/password/i.test(sql), false);
});

test("RLS is on for every table", () => {
  for (const table of ["profiles", "site_settings", "host_handoff"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test("a guest can update only her names, phone, language and currency", () => {
  assert.match(sql, /grant update \(first_name, last_name, phone, locale, currency\) on public\.profiles to authenticated/);
  assert.equal(/grant update[^;]*\b(role|email)\b/i.test(sql), false);
  assert.equal(/grant (insert|delete|all)[^;]*to (anon|authenticated)/i.test(sql), false);
});

test("the public settings view is read-only: everything revoked before select", () => {
  const revoke = sql.indexOf("revoke all on public.site_settings_public from public, anon, authenticated;");
  const grant = sql.indexOf("grant select on public.site_settings_public to anon, authenticated;");
  assert.ok(revoke > -1 && grant > revoke);
  assert.equal(/grant (insert|update|delete|all)[^;]*site_settings_public/i.test(sql), false);
  for (const table of ["profiles", "site_settings", "host_handoff"]) {
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated;`));
  }
});

test("profiles.email follows a changed sign-in email; the role does not", () => {
  const fn = sql.slice(sql.indexOf("function public.handle_auth_email_change"));
  const body = fn.slice(0, fn.indexOf("$$;"));
  assert.match(body, /update public\.profiles set email = lower\(new\.email\) where id = new\.id/);
  assert.equal(/role/.test(body), false);
  assert.match(sql, /after update of email on auth\.users/);
});

test("the handoff stores a hash, never the raw token", () => {
  assert.match(sql, /token_hash text primary key/);
  assert.equal(/\btoken text\b/.test(sql), false);
});

test("the public settings view leaves the logo bytes out", () => {
  const view = sql.slice(sql.indexOf("create or replace view public.site_settings_public"));
  assert.equal(view.slice(0, view.indexOf(";")).includes("logo_bytes"), false);
});

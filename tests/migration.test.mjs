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

test("the handoff stores a hash, never the raw token", () => {
  assert.match(sql, /token_hash text primary key/);
  assert.equal(/\btoken text\b/.test(sql), false);
});

test("the public settings view leaves the logo bytes out", () => {
  const view = sql.slice(sql.indexOf("create or replace view public.site_settings_public"));
  assert.equal(view.slice(0, view.indexOf(";")).includes("logo_bytes"), false);
});

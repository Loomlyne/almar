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
  for (const table of ["profiles", "site_settings", "host_handoff", "auth_link_requests"]) {
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

function fnBody(name) {
  const at = sql.indexOf(`function public.${name}`);
  const rest = sql.slice(at);
  return rest.slice(0, rest.indexOf("$$;", rest.indexOf("$$") + 2));
}

test("a profile exists only for a confirmed email, and the owner role only on that path", () => {
  const body = fnBody("handle_new_auth_user");
  assert.match(body, /new\.email_confirmed_at is not null/);
  assert.match(body, /on conflict \(id\) do nothing/);
  assert.match(body, /'maria@almarprivatejourney\.com' then 'owner'/);
  assert.match(sql, /create trigger on_auth_user_confirmed\s+after update of email_confirmed_at on auth\.users\s+for each row\s+when \(old\.email_confirmed_at is null and new\.email_confirmed_at is not null\)\s+execute function public\.handle_new_auth_user\(\)/);
  assert.match(sql, /drop trigger if exists on_auth_user_confirmed on auth\.users/);
  assert.match(sql, /where u\.email is not null and u\.email_confirmed_at is not null/);
});

test("profiles carry length and phone checks that match the app rules", () => {
  assert.match(sql, /drop constraint if exists profiles_first_name_length;\s*alter table public\.profiles add constraint profiles_first_name_length check \(char_length\(first_name\) <= 80\)/);
  assert.match(sql, /add constraint profiles_last_name_length check \(char_length\(last_name\) <= 80\)/);
  assert.match(sql, /add constraint profiles_phone_shape check \(phone is null or phone ~ '\^\\\+\?\[0-9\]\{6,15\}\$'\)/);
});

test("the trigger functions cannot be called through the API", () => {
  for (const fn of ["handle_new_auth_user()", "handle_auth_email_change()"]) {
    assert.ok(sql.includes(`revoke execute on function public.${fn} from public, anon, authenticated;`), fn);
  }
});

test("auth_link_requests is closed to every API role and indexed", () => {
  assert.match(sql, /revoke all on public\.auth_link_requests from public, anon, authenticated;/);
  assert.match(sql, /on public\.auth_link_requests \(email_hash, created_at\)/);
  assert.match(sql, /on public\.auth_link_requests \(ip_hash, created_at\)/);
  assert.equal(/grant[^;]*auth_link_requests/i.test(sql), false);
});

test("claim_link_slot is security definer, pinned, and only the service role runs it", () => {
  const body = fnBody("claim_link_slot");
  assert.match(body, /returns boolean/);
  assert.match(body, /security definer/);
  assert.match(body, /set search_path = ''/);
  assert.match(body, /pg_advisory_xact_lock\(hashtextextended\(p_email_hash, 0\)\)/);
  assert.match(body, /interval '60 seconds'/);
  assert.match(body, /\) >= 5 then/);
  assert.match(body, /\) >= 20 then/);
  assert.match(body, /created_at < now\(\) - interval '1 day'/);
  assert.equal(/\bfrom (?!public\.)\w/.test(body.replace(/\bfrom public\./g, "")), false);
  assert.ok(sql.includes("revoke execute on function public.claim_link_slot(text, text) from public, anon, authenticated;"));
  assert.ok(sql.includes("grant execute on function public.claim_link_slot(text, text) to service_role;"));
  assert.equal(/grant execute on function public\.claim_link_slot[^;]*(anon|authenticated|public)/.test(sql), false);
});

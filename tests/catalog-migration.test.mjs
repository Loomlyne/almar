// Static lint of the catalogue migration text (plan 03.2-01). No database: the pgTAP files in supabase/tests prove the
// behaviour; this file refuses the shapes that would open a hole, so a later edit cannot add one unnoticed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const FILE = "supabase/migrations/20261005100000_catalog_and_team.sql";
const sql = readFileSync(FILE, "utf8")
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

const tables = [...sql.matchAll(/create table public\.(\w+)\s*\(/g)].map((m) => m[1]);
const views = [...sql.matchAll(/create view public\.(\w+)\b/g)].map((m) => m[1]);
const functions = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);

test("the migration sorts after job 02's and is the only 3.2 catalogue file", () => {
  const names = readdirSync("supabase/migrations").sort();
  assert.ok(names.indexOf("20260925120000_platform_spine.sql") < names.indexOf("20261005100000_catalog_and_team.sql"));
  assert.equal(names.filter((n) => n.includes("catalog_and_team")).length, 1);
});

test("the file knows its tables, views and functions", () => {
  assert.equal(tables.length, 21);
  assert.equal(views.length, 14);
  assert.ok(functions.length >= 40);
});

test("RLS is on, and everything is revoked from public, anon and authenticated, for every table", () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`), `${table}: RLS`);
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated;`), `${table}: revoke`);
  }
});

test("every function is invoker, has an empty search_path and runs for service_role only", () => {
  const headers = [...sql.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\$\$/g)];
  assert.equal(headers.length, functions.length);
  for (const [text, name] of headers) {
    assert.match(text, /set search_path = ''/, `${name}: search_path`);
    assert.equal(/security definer/i.test(text), false, `${name}: no security definer`);
    assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`), `${name}: revoke`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role;`), `${name}: grant`);
  }
  assert.equal(/grant execute[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/i.test(sql), false, "no function is granted to anon, authenticated or public");
});

test("every api_ view is security_invoker = on, revoked first, granted to anon only", () => {
  for (const view of views) {
    assert.ok(view.startsWith("api_"), `${view}: public views are api_*`);
    assert.match(sql, new RegExp(`create view public\\.${view} with \\(security_invoker = on\\) as`), `${view}: invoker`);
    const revoke = sql.indexOf(`revoke all on public.${view} from public, anon, authenticated;`);
    const grant = sql.indexOf(`grant select on public.${view} to anon;`);
    assert.ok(revoke > -1 && grant > revoke, `${view}: revoke before grant`);
    assert.equal(new RegExp(`grant (?!select\\b)[^;]*on public\\.${view}\\b`, "i").test(sql), false, `${view}: nothing but select`);
  }
  assert.equal(/security_invoker\s*=\s*(false|off)/i.test(sql), false);
});

test("nothing is granted to anon or authenticated except select; authenticated gets nothing", () => {
  const grants = [...sql.matchAll(/\bgrant\b([\s\S]*?);/gi)].map((m) => m[1]);
  for (const g of grants) {
    if (/\bexecute\b/i.test(g)) continue;
    if (!/\b(anon|authenticated)\b/i.test(g.split(/\bto\b/i).pop() ?? "")) continue;
    assert.match(g, /^\s*select\b/i, `only select: grant ${g.trim().slice(0, 60)}`);
    assert.equal(/\bauthenticated\b/i.test(g.split(/\bto\b/i).pop() ?? ""), false, "no grant to authenticated");
  }
});

test("money, access, e-mail and reasons are never granted to the public key", () => {
  const anonGrants = [...sql.matchAll(/grant select \(([\s\S]*?)\)\s*on public\.(\w+)\s+to anon;/g)];
  assert.equal(anonGrants.length, 19, "every table but stay_rates and stay_access has a column grant");
  const forbidden = ["base_nightly_rate_aed", "pets_fee_aed", "pets_rule", "infants_count", "email", "reason", "created_by", "wifi_password", "door_code", "sha256"];
  for (const [, cols, table] of anonGrants) {
    assert.equal(["stay_rates", "stay_access"].includes(table), false, `${table} is never granted`);
    for (const col of forbidden) assert.equal(new RegExp(`\\b${col}\\b`).test(cols), false, `${table}.${col}`);
  }
  assert.equal(/on public\.(stay_rates|stay_access)\b[^;]*to (anon|authenticated)/i.test(sql), false);
  assert.equal(/grant[^;]*on public\.(stay_rates|stay_access)\b/i.test(sql), false);
});

test("a table the views read has an anon policy; stay_rates and stay_access have none", () => {
  for (const [, , table] of [...sql.matchAll(/grant select \(([\s\S]*?)\)\s*on public\.(\w+)\s+to anon;/g)]) {
    assert.match(sql, new RegExp(`create policy "[^"]+" on public\\.${table}\\s+for select to anon using`), `${table}: policy`);
  }
  assert.equal(/create policy[^;]*on public\.(stay_rates|stay_access)\b/i.test(sql), false);
  assert.equal(/create policy[^;]*for (insert|update|delete|all)/i.test(sql), false, "policies are select only");
});

test("the rates rule is a database constraint", () => {
  assert.match(sql, /create extension if not exists btree_gist with schema extensions;/);
  assert.match(sql, /exclude using gist \(stay_id with =, span_days with =, nights with &&\)/);
  assert.match(sql, /span_days int generated always as \(upper\(nights\) - lower\(nights\)\) stored/);
  assert.match(sql, /base_nightly_rate_aed numeric\(12, 2\) check \(base_nightly_rate_aed > 0\)/);
  assert.match(sql, /min_nights int not null default 1 check \(min_nights >= 1\)/);
  assert.match(sql, /create unique index catalog_items_one_home_pickup on public\.catalog_items \(\(true\)\) where is_home_pickup;/);
});

test("no storage, no hosted-project call, no key in the file", () => {
  assert.equal(/storage\./i.test(sql), false);
  assert.equal(/service_role_key|sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]{20,}/.test(sql), false);
});

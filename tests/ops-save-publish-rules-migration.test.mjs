// Follow-up 7: a Save keeps a published destination or catalog item inside the publish rules (migration
// 20261017120000_ops_save_publish_rules.sql). Static checks of the migration text; the behaviour is proved by
// supabase/tests/ops_save_publish_rules.test.sql on a local stack.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const BASE = "supabase/migrations/20261005100000_catalog_and_team.sql";
const FILE = "supabase/migrations/20261017120000_ops_save_publish_rules.sql";
const PGTAP = "supabase/tests/ops_save_publish_rules.test.sql";

const fn = (sql, name) => {
  const match = sql.match(new RegExp(`create or replace function public\\.${name}\\(p jsonb\\)[\\s\\S]*?\\n\\$\\$;`));
  assert.ok(match, `${name} is defined`);
  return match[0];
};

const DESTINATION_CHECK = `  -- A published destination keeps what ops_publish required of it: its hero photo.
  if v_pub and (select d.hero_media_id from public.destinations d where d.id = v_id) is null then
    perform public.catalog_invalid('hero_media_id');
  end if;
`;
const ITEM_CHECK = `  -- A published item keeps what ops_publish required of it: its photo and at least one destination.
  if v_pub and (select c.media_id from public.catalog_items c where c.id = v_id) is null then
    perform public.catalog_invalid('media_id');
  end if;
  if v_pub and not exists (select 1 from public.catalog_item_destinations cd where cd.item_id = v_id) then
    perform public.catalog_invalid('destination_ids');
  end if;
`;

const base = readFileSync(BASE, "utf8");
const sql = readFileSync(FILE, "utf8");

test("the two saves are the 03.2-01 functions plus the publish-rule check, and nothing else", () => {
  for (const [name, check] of [["ops_save_destination", DESTINATION_CHECK], ["ops_save_catalog_item", ITEM_CHECK]]) {
    const next = fn(sql, name);
    assert.ok(next.includes(check), `${name}: the check is there`);
    assert.equal(next.replace(check, ""), fn(base, name), `${name}: no other change`);
  }
});

test("the check runs after every write of the save, right before its answer", () => {
  const destination = fn(sql, "ops_save_destination");
  assert.ok(destination.indexOf("catalog_save_translations") < destination.indexOf(DESTINATION_CHECK));
  assert.match(destination, new RegExp(`${escape(DESTINATION_CHECK)}  return jsonb_build_object\\('id', v_id, 'affects_site', v_pub\\);`));
  const item = fn(sql, "ops_save_catalog_item");
  for (const write of ["catalog_save_translations", "insert into public.catalog_item_destinations", "insert into public.catalog_item_stays"]) {
    assert.ok(item.indexOf(write) < item.indexOf(ITEM_CHECK), `after ${write}`);
  }
  assert.match(item, new RegExp(`${escape(ITEM_CHECK)}  return jsonb_build_object\\('id', v_id, 'affects_site', v_pub\\);`));
});

test("the grants are the same as before: service_role only, invoker, empty search_path", () => {
  for (const name of ["ops_save_destination", "ops_save_catalog_item"]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\(jsonb\\) from public, anon, authenticated;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(jsonb\\) to service_role;`));
    assert.match(fn(sql, name), /set search_path = ''/);
    assert.doesNotMatch(fn(sql, name), /security definer/);
  }
  const outside = sql.replace(/--.*$/gm, "").replace(/\$\$[\s\S]*?\$\$/g, "");
  assert.doesNotMatch(outside, /\b(create table|alter table|drop |insert into|update |delete from)/i, "no table or row change");
});

test("no later migration replaces the two saves again", () => {
  const later = readdirSync("supabase/migrations")
    .sort()
    .filter((name) => name > "20261017120000_ops_save_publish_rules.sql")
    .filter((name) => /function public\.ops_save_(destination|catalog_item)\(/.test(readFileSync(`supabase/migrations/${name}`, "utf8")));
  assert.deepEqual(later, []);
});

test("the pgTAP plan counts its assertions", () => {
  const tap = readFileSync(PGTAP, "utf8");
  const planned = Number(tap.match(/select plan\((\d+)\);/)?.[1]);
  const asserts = tap.match(/^select (is|ok|throws_ok|lives_ok)\(/gm) ?? [];
  assert.equal(asserts.length, planned);
});

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The pure parts of tests/helpers/local-supabase.mjs: parallel worktrees must never share a project or a port.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildStackConfig, projectId, stackId, stackPorts } from "./helpers/local-supabase.mjs";

test("the id is the first 8 hex of sha256 of the worktree path", () => {
  assert.equal(stackId("/some/worktree"), createHash("sha256").update("/some/worktree").digest("hex").slice(0, 8));
  assert.match(stackId(), /^[0-9a-f]{8}$/);
  assert.notEqual(stackId("/a/one"), stackId("/a/two"));
  assert.equal(projectId("3101d813"), "almar-3101d813");
});

test("every port block sits inside 54400-54799 and holds seven distinct ports", () => {
  for (let i = 0; i < 2000; i++) {
    const id = createHash("sha256").update(`wt-${i}`).digest("hex").slice(0, 8);
    const ports = Object.values(stackPorts(id));
    assert.equal(new Set(ports).size, 7);
    for (const port of ports) assert.ok(port >= 54400 && port <= 54799, `${id}: ${port}`);
  }
  const p = stackPorts("00000000");
  assert.deepEqual(p, { shadow: 54400, api: 54401, db: 54402, studio: 54403, inbucket: 54404, analytics: 54407, pooler: 54409 });
});

test("the stack config keeps the template and swaps only the project id and the ports", () => {
  const template = readFileSync("supabase/config.toml", "utf8");
  const out = buildStackConfig(template, "3101d813");
  const ports = stackPorts("3101d813");
  assert.match(out, /^project_id = "almar-3101d813"$/m);
  assert.match(out, new RegExp(`\\[api\\][^\\[]*\\nport = ${ports.api}\\n`));
  assert.match(out, new RegExp(`\\[db\\][^\\[]*\\nport = ${ports.db}\\n[^\\[]*shadow_port = ${ports.shadow}\\n`));
  assert.match(out, new RegExp(`\\[db\\.pooler\\][^\\[]*\\nport = ${ports.pooler}\\n`));
  assert.match(out, new RegExp(`\\[studio\\][^\\[]*\\nport = ${ports.studio}\\n`));
  assert.match(out, new RegExp(`\\[local_smtp\\][^\\[]*\\nport = ${ports.inbucket}\\n`));
  assert.match(out, new RegExp(`\\[analytics\\][^\\[]*\\nport = ${ports.analytics}\\n`));
  assert.equal(out.split("\n").length, template.split("\n").length);
  // Storage stays off in every stack: media is never Supabase Storage.
  assert.match(out, /\[storage\]\nenabled = false/);
});

test("the committed template is the almar template with Storage off", () => {
  const template = readFileSync("supabase/config.toml", "utf8");
  assert.match(template, /^project_id = "almar"$/m);
  assert.match(template, /\[storage\]\nenabled = false/);
});

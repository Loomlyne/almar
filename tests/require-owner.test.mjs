import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { OWNER_EMAIL } = await loadTs("lib/auth/rules.ts");
const { ownerDecision } = await loadTs("lib/auth/owner-decision.ts");

const owner = { role: "owner", email: OWNER_EMAIL };

test("not on the ops host: not_owner, even for the owner", () => {
  assert.equal(ownerDecision({ shell: null, profile: owner, hasAdmin: true }), "not_owner");
  assert.equal(ownerDecision({ shell: "marketing", profile: owner, hasAdmin: true }), "not_owner");
  assert.equal(ownerDecision({ shell: "", profile: owner, hasAdmin: true }), "not_owner");
});

test("no session: not_owner", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: null, hasAdmin: true }), "not_owner");
});

test("the owner role with another email is not the owner", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: { role: "owner", email: "someone@else.com" }, hasAdmin: true }), "not_owner");
});

test("the owner email with the guest role is not the owner", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: { role: "guest", email: OWNER_EMAIL }, hasAdmin: true }), "not_owner");
});

test("the owner without a service-role client: unavailable", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: owner, hasAdmin: false }), "unavailable");
});

test("a non-owner without a service-role client is still not_owner, never unavailable", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: null, hasAdmin: false }), "not_owner");
  assert.equal(ownerDecision({ shell: null, profile: owner, hasAdmin: false }), "not_owner");
});

test("the owner on the ops host with a client: ok", () => {
  assert.equal(ownerDecision({ shell: "ops", profile: owner, hasAdmin: true }), "ok");
  assert.equal(ownerDecision({ shell: "ops", profile: { role: "owner", email: OWNER_EMAIL.toUpperCase() }, hasAdmin: true }), "ok");
});

const code = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");

test("source guard: requireOwner reads the middleware header and the verified user, builds no key itself", () => {
  const src = code("lib/auth/require-owner.ts");
  assert.match(src, /import \{[^}]*\bSHELL_HEADER\b[^}]*\} from "\.\.\/host"/);
  assert.match(src, /import \{[^}]*\breadSessionProfile\b[^}]*\} from "\.\.\/supabase\/clients"/);
  assert.match(src, /import \{[^}]*\bcreateSupabaseAdmin\b[^}]*\} from "\.\.\/supabase\/clients"/);
  assert.match(src, /import \{ ownerDecision \} from "\.\/owner-decision"/);
  assert.match(src, /\(await headers\(\)\)\.get\(SHELL_HEADER\)/);
  assert.equal(/getSession/.test(src), false, "never getSession");
  assert.equal(/SUPABASE_SERVICE_ROLE_KEY/.test(src), false, "the key is read in lib/supabase/clients.ts only");
  assert.equal(/\bprocess\.env\b/.test(src), false);
  assert.equal(/new Response|Response\.json|NextResponse/.test(src), false, "it builds no Response");
});

test("source guard: the pure rule uses isOwnerProfile and nothing else", () => {
  const src = code("lib/auth/owner-decision.ts");
  assert.match(src, /import \{ isOwnerProfile \} from "\.\/rules"/);
  assert.equal((src.match(/^import /gm) ?? []).length, 1);
  assert.match(src, /input\.shell !== "ops"/);
});

// Brace depth of `src` just before `index`: how many blocks are open there.
const depthAt = (src, index) => {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
  }
  return depth;
};

// The index of the `}` that closes the block opened by the `{` at `open`.
const closeOf = (src, open) => {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return i;
  }
  throw new Error("unbalanced braces in middleware.ts");
};

// The two headers the (ops) gate trusts. Each must be dropped from the client's copy first, as a plain statement at the
// function's top level, and written in exactly one place: directly inside the `if (isOpsHost(host)) {` block, never in
// another branch, never with append, never on another headers object.
test("the shell header the gate trusts is dropped from the client and set only for the ops host, and so is the ops-path header", () => {
  const middleware = code("middleware.ts");

  const gate = "if (isOpsHost(host)) {";
  assert.equal(middleware.split(gate).length - 1, 1, "one ops-host block");
  const open = middleware.indexOf(gate) + gate.length - 1;
  const close = closeOf(middleware, open);
  const outerDepth = depthAt(middleware, open);

  for (const header of ["SHELL_HEADER", "OPS_PATH_HEADER"]) {
    const drop = `forwarded.delete(${header});`;
    assert.equal(middleware.split(drop).length - 1, 1, `${drop} appears once`);
    const dropAt = middleware.indexOf(drop);
    assert.ok(dropAt < open, `${header}: dropped before the ops-host block`);
    assert.equal(depthAt(middleware, dropAt), outerDepth, `${header}: the drop is not inside any branch`);
    assert.match(middleware, new RegExp(`^[ \\t]*forwarded\\.delete\\(${header}\\);`, "m"), `${header}: the drop is a plain statement`);

    const writes = [...middleware.matchAll(new RegExp(`\\.(set|append)\\(\\s*${header}\\b`, "g"))];
    assert.equal(writes.length, 1, `${header}: written in exactly one place`);
    const [write] = writes;
    assert.equal(write[1], "set");
    const line = middleware.slice(middleware.lastIndexOf("\n", write.index) + 1, middleware.indexOf("\n", write.index));
    assert.match(line, /^\s*forwarded\.set\(/, `${header}: a plain statement on the forwarded headers, not under an inline condition`);
    assert.ok(write.index > dropAt, `${header}: dropped before it is set`);
    assert.ok(write.index > open && write.index < close, `${header}: set inside the ops-host block`);
    assert.equal(depthAt(middleware, write.index), outerDepth + 1, `${header}: set directly in the block, under no other condition`);
  }

  assert.match(middleware, /forwarded\.set\(SHELL_HEADER, "ops"\);/, "the shell header is only ever \"ops\"");
});

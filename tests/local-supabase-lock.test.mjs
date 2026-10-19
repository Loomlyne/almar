// Follow-up 3: a node test that writes to the local stack takes the stack lock BEFORE it looks for the stack
// (tests/helpers/local-supabase.mjs lockStack). Looked for first, `supabase status` could fail while another file held the
// lock and reset the database; localStack() remembers that failure, so the test skipped (or failed under
// ALMAR_REQUIRE_STACK=1). No stack is started here: the lock is a temporary folder and the stack look is a stand-in.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireStackLock, lockStack } from "./helpers/local-supabase.mjs";

const lockDir = () => join(mkdtempSync(join(tmpdir(), "almar-lock-")), "stack-test.lock");
const STACK = { url: "http://127.0.0.1:54421", anonKey: "a", serviceKey: "s", dbUrl: "postgresql://x" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fakeT = () => {
  const t = { skipped: null };
  t.skip = (why) => {
    t.skipped = why;
  };
  return t;
};

test("lockStack waits for the lock, and only then looks for the stack", async () => {
  const dir = lockDir();
  const other = await acquireStackLock({ dir }); // another file holds the lock (it is resetting the database)
  let lookedAt = 0;
  const pending = lockStack(fakeT(), {
    dir,
    probe: () => {
      lookedAt = Date.now();
      return STACK;
    },
  });
  let freedAt = 0;
  try {
    await sleep(600);
    assert.equal(lookedAt, 0, "no stack look while another file holds the lock");
  } finally {
    // Freed in any case, so a failure here never leaves the waiting call polling until its timeout.
    freedAt = Date.now();
    other();
  }
  const locked = await pending;
  assert.ok(lookedAt >= freedAt, "the look came after the lock was free");
  assert.equal(locked.stack, STACK);
  await assert.rejects(acquireStackLock({ dir, timeoutMs: 300 }), /timed out/, "the caller holds the lock now");
  locked.release();
  (await acquireStackLock({ dir, timeoutMs: 300 }))();
});

test("no stack: the lock is given back at once and the test is skipped", async () => {
  const dir = lockDir();
  const t = fakeT();
  const before = process.env.ALMAR_REQUIRE_STACK;
  delete process.env.ALMAR_REQUIRE_STACK;
  try {
    assert.equal(await lockStack(t, { dir, probe: () => null }), null);
  } finally {
    if (before !== undefined) process.env.ALMAR_REQUIRE_STACK = before;
  }
  assert.match(t.skipped ?? "", /no local Supabase stack/);
  (await acquireStackLock({ dir, timeoutMs: 300 }))();
});

test("no stack under ALMAR_REQUIRE_STACK=1: the test fails and the lock is given back", async () => {
  const dir = lockDir();
  const before = process.env.ALMAR_REQUIRE_STACK;
  process.env.ALMAR_REQUIRE_STACK = "1";
  try {
    await assert.rejects(lockStack(fakeT(), { dir, probe: () => null }), /ALMAR_REQUIRE_STACK=1/);
  } finally {
    if (before === undefined) delete process.env.ALMAR_REQUIRE_STACK;
    else process.env.ALMAR_REQUIRE_STACK = before;
  }
  (await acquireStackLock({ dir, timeoutMs: 300 }))();
});

test("a stack look that throws gives the lock back", async () => {
  const dir = lockDir();
  await assert.rejects(lockStack(fakeT(), { dir, probe: () => { throw new Error("status crashed"); } }), /status crashed/);
  (await acquireStackLock({ dir, timeoutMs: 300 }))();
});

test("every stack test file takes the lock through lockStack, never requireStack first and the lock after", () => {
  const files = readdirSync("tests").filter((name) => name.endsWith(".test.mjs") && name !== "local-supabase-lock.test.mjs");
  const direct = files.filter((name) => /\bacquireStackLock\s*\(/.test(readFileSync(join("tests", name), "utf8")));
  assert.deepEqual(direct, [], "a file that writes to the stack calls lockStack(t)");
  const helper = readFileSync("tests/helpers/local-supabase.mjs", "utf8");
  assert.match(helper, /probe = \(\) => localStack\(\{ fresh: true \}\)/, "the look after the lock is a fresh one, not one remembered from before");
});

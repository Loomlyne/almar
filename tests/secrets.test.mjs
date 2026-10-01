import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, acc);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) acc.push(path);
  }
  return acc;
}

const ALL = ["app", "components", "lib"].flatMap((dir) => files(dir)).concat(["middleware.ts"]);

test("the service-role key is read only in lib/supabase/clients.ts", () => {
  const hits = ALL.filter((path) => path !== join("lib", "supabase", "clients.ts") && readFileSync(path, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.deepEqual(hits, []);
});

test("no public env name carries a service key", () => {
  const hits = ALL.filter((path) => /NEXT_PUBLIC_[A-Z_]*SERVICE/.test(readFileSync(path, "utf8")));
  assert.deepEqual(hits, []);
});

test("client components never import the admin client", () => {
  const hits = ALL.filter((path) => {
    const text = readFileSync(path, "utf8");
    return /^"use client";/m.test(text) && /createSupabaseAdmin|lib\/supabase\/clients"/.test(text.replace(/import type[^\n]*\n/g, ""));
  });
  assert.deepEqual(hits, []);
});

test("Supabase storage is never called", () => {
  const hits = ALL.filter((path) => /\.storage\b|storage\.from\(/.test(readFileSync(path, "utf8")));
  assert.deepEqual(hits, []);
});

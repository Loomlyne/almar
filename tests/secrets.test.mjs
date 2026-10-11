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

// Everything that can reach a bundle, a Worker or a build: the app, its libraries, the build scripts and the Workers.
const ALL = ["app", "components", "lib", "scripts", "worker"].flatMap((dir) => files(dir)).concat(["middleware.ts"]);

// The service-role key is named in exactly two files: the server clients, and the controller's one-time import (plan 03.2-01).
const SERVICE_KEY_FILES = [join("lib", "supabase", "clients.ts"), join("scripts", "import-catalog.mjs")];

test("the service-role key is named only in lib/supabase/clients.ts and scripts/import-catalog.mjs", () => {
  const hits = ALL.filter((path) => readFileSync(path, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.deepEqual(hits.sort(), [...SERVICE_KEY_FILES].sort());
});

test("the scan covers the app, the libraries, the scripts and the Workers", () => {
  for (const dir of ["app", "components", "lib", "scripts", "worker"]) {
    assert.ok(ALL.some((path) => path.startsWith(`${dir}/`)), dir);
  }
  assert.ok(ALL.includes("middleware.ts"));
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

// Plan 04-04: Stripe. The webhook signing secret is read by the webhook route only; no Stripe value is ever a public
// build variable or a literal anywhere that can reach a bundle or a Worker.
test("the Stripe webhook signing secret is named only in app/api/stripe/webhook/route.ts", () => {
  const hits = ALL.filter((path) => readFileSync(path, "utf8").includes("STRIPE_WEBHOOK_SECRET"));
  assert.deepEqual(hits, [join("app", "api", "stripe", "webhook", "route.ts")]);
});

test("no public build variable carries a Stripe value", () => {
  const hits = ALL.filter((path) => /NEXT_PUBLIC_STRIPE/.test(readFileSync(path, "utf8")));
  assert.deepEqual(hits, []);
});

test("no Stripe key or signing secret appears as a literal under app/, components/ or lib/", () => {
  const KEY = /\b(sk|pk|rk)_(test|live)_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{8,}/;
  const hits = ALL.filter((path) => /^(app|components|lib)\//.test(path)).filter((path) => KEY.test(readFileSync(path, "utf8")));
  assert.deepEqual(hits, []);
});

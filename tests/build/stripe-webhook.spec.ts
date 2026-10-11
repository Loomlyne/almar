import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import Stripe from "stripe";

// Plan 04-04, the proof written first (research Pitfall 1): Stripe signs the RAW body, so the built Worker (OpenNext,
// job 10's worker/almar.mjs, job 02's middleware) must hand the route exactly the bytes Stripe sent. This spec starts its
// own `wrangler dev` (workerd, never --remote) on the assembled build with two FAKE local-proof variables and no Supabase
// settings, signs a fixed body with Stripe's own test-header helper, and checks:
//   - the signed body, POSTed twice in a row, passes the signature check (the route then answers 503 `unavailable`
//     because no database is configured: never 400);
//   - the same header with one byte of the body changed is 400;
//   - no signature header is 400; GET is 405.
// Run:
//   node scripts/assemble-cloudflare.mjs
//   PW_WEBHOOK_PORT=<free port> PW_PORT=<another free port> npx playwright test -c playwright.build.config.ts tests/build/stripe-webhook.spec.ts --workers=1
// (The config's own web server on PW_PORT is started anyway and is not used here.) The Worker started here is stopped by
// its port: the child process, then whatever still listens on that port. Nothing is ever killed by a name pattern.

const PORT = Number(process.env.PW_WEBHOOK_PORT ?? 0);
const SECRET = "whsec_local_proof_only";
const BASE = `http://127.0.0.1:${PORT}`;

test.skip(!Number.isInteger(PORT) || PORT < 1024, "set PW_WEBHOOK_PORT to a free port (see the header)");

let worker: ChildProcess | null = null;

function listeners(port: number): number[] {
  try {
    const out = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    return out.split("\n").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    return []; // lsof exits 1 when nothing listens
  }
}

test.beforeAll(async () => {
  expect(listeners(PORT), `port ${PORT} must be free`).toEqual([]);
  worker = spawn(
    "./node_modules/.bin/wrangler",
    [
      "dev", "--config", "wrangler.toml", "--ip", "127.0.0.1", "--port", String(PORT), "--show-interactive-dev-session=false",
      "--var", `STRIPE_WEBHOOK_SECRET:${SECRET}`, "--var", "STRIPE_SECRET_KEY:sk_test_local_proof_only",
    ],
    { env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: "ignore" },
  );
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error("the built Worker did not start in 120 s");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
});

test.afterAll(async () => {
  if (worker?.pid) {
    try {
      process.kill(worker.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  for (const pid of listeners(PORT)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
});

const PAYLOAD = JSON.stringify({
  id: "evt_local_proof_000001",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_localproof00001", object: "checkout.session", payment_status: "paid", note: "a café — line\nbreak" } },
});

function header(payload: string): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
}

test("a correctly signed body passes the signature check twice in a row (503 here: no database configured, never 400)", async () => {
  const signature = header(PAYLOAD);
  for (let i = 0; i < 2; i += 1) {
    const res = await fetch(`${BASE}/api/stripe/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: PAYLOAD,
    });
    expect(res.status, `delivery ${i + 1}`).toBe(503);
    expect(await res.text()).toBe("unavailable");
  }
});

test("the same header with one byte of the body changed is 400", async () => {
  const signature = header(PAYLOAD);
  const changed = PAYLOAD.replace("cs_test_localproof00001", "cs_test_localproof00002");
  expect(changed).not.toBe(PAYLOAD);
  expect(changed.length).toBe(PAYLOAD.length);
  const res = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: changed,
  });
  expect(res.status).toBe(400);
});

test("a header made for a stale time is 400 (the five-minute tolerance is on)", async () => {
  const stale = Stripe.webhooks.generateTestHeaderString({ payload: PAYLOAD, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 });
  const res = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": stale }, body: PAYLOAD });
  expect(res.status).toBe(400);
});

test("no stripe-signature header is 400, and a GET is 405", async () => {
  const none = await fetch(`${BASE}/api/stripe/webhook`, { method: "POST", body: PAYLOAD });
  expect(none.status).toBe(400);
  const get = await fetch(`${BASE}/api/stripe/webhook`);
  expect(get.status).toBe(405);
});

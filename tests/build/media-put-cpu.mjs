// Job 03.2-09b: real PUTs of /api/ops/media (1 KB, 10 MB, 10 MB + 1) on the built almar-ops Worker under `wrangler dev`
// (local workerd), with the V8 CPU profiler over the DevTools inspector, as the owner of the local stack. Not part of a
// suite (no .test / .spec name). Local stack only: it reads .tmp/ops-stack/.dev.vars and refuses any other URL.
//   node tests/helpers/local-supabase.mjs start && node scripts/assemble-cloudflare.mjs --target=ops
//   node tests/build/make-ops-test-config.mjs && node tests/build/make-ops-stack-config.mjs
//   node tests/build/media-put-cpu.mjs        (ports 8799 and 9339 must be free)
// Read the numbers as an upper bound: workerd does not mark idle time for the profiler, so time spent awaiting I/O is
// counted. Edge CPU time comes only from `wrangler tail` (cpuTime) on the deployed Worker.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const PORT = 8799;
const INSPECT = 9339;
const HOST = "dashboard.almarprivatejourney.com";
const ORIGIN = `https://${HOST}`;
const MB = 1024 * 1024;

const vars = new Map(
  readFileSync(".tmp/ops-stack/.dev.vars", "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const stack = { url: vars.get("NEXT_PUBLIC_SUPABASE_URL"), anonKey: vars.get("NEXT_PUBLIC_SUPABASE_ANON_KEY"), serviceKey: vars.get("SUPABASE_SERVICE_ROLE_KEY") };
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(stack.url)) throw new Error("not a local stack");

async function ownerCookie() {
  const email = "maria@almarprivatejourney.com";
  const admin = createClient(stack.url, stack.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error && !/already/i.test(created.error.message)) throw new Error(created.error.message);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const jar = new Map();
  const client = createServerClient(stack.url, stack.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const v = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (v.error) throw new Error(v.error.message);
  return [...jar].map(([n, val]) => `${n}=${val}`).join("; ");
}

function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: PORT, method, path, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    if (body) req.end(body);
    else req.end();
  });
}

function webp(size, seed) {
  const b = Buffer.alloc(size);
  for (let i = 0; i < size; i++) b[i] = (i * 31 + seed * 7) & 0xff;
  b.write("RIFF", 0, "ascii");
  b.write("WEBP", 8, "ascii");
  return b;
}

async function waitFor(fn, ms = 180_000) {
  const end = Date.now() + ms;
  for (;;) {
    try {
      const r = await fn();
      if (r) return r;
    } catch {}
    if (Date.now() > end) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const wrangler = spawn(
  "./node_modules/.bin/wrangler",
  ["dev", "--config", ".tmp/ops-stack/wrangler.ops.test.toml", "--ip", "127.0.0.1", "--port", String(PORT), "--inspector-port", String(INSPECT), "--show-interactive-dev-session=false"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let wlog = "";
wrangler.stdout.on("data", (d) => (wlog += d));
wrangler.stderr.on("data", (d) => (wlog += d));
const stop = () => wrangler.kill("SIGINT");
process.on("exit", stop);

try {
  await waitFor(async () => (await request("GET", "/api/health", {})).status === 200);
  const targets = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${INSPECT}/json`)).json();
    return list.length ? list : null;
  });
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl, { origin: "http://localhost" });
  await new Promise((r, j) => (ws.once("open", r), ws.once("error", j)));
  let id = 0;
  const pending = new Map();
  ws.on("message", (data) => {
    const m = JSON.parse(String(data));
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const cdp = (method, params = {}) =>
    new Promise((resolve) => {
      id += 1;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await cdp("Profiler.enable");
  await cdp("Profiler.setSamplingInterval", { interval: 50 });

  const cookie = await ownerCookie();
  const base = { host: HOST, origin: ORIGIN, cookie };

  async function profiled(label, run) {
    await cdp("Profiler.start");
    const t0 = Date.now();
    const res = await run();
    const wall = Date.now() - t0;
    const { result } = await cdp("Profiler.stop");
    const p = result.profile;
    const byId = new Map(p.nodes.map((n) => [n.id, n]));
    let busy = 0;
    const per = new Map();
    for (let i = 0; i < p.samples.length; i++) {
      const dt = (p.timeDeltas[i + 1] ?? 0) / 1000;
      const name = byId.get(p.samples[i])?.callFrame.functionName || "(anonymous)";
      if (name === "(idle)") continue;
      busy += dt;
      per.set(name, (per.get(name) ?? 0) + dt);
    }
    const top = [...per].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, t]) => `${n} ${t.toFixed(1)}`).join(", ");
    // Inclusive time by frame (url:line:function), so the layer that owns the time shows.
    const parent = new Map();
    for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const incl = new Map();
    for (let i = 0; i < p.samples.length; i++) {
      const dt = (p.timeDeltas[i + 1] ?? 0) / 1000;
      const leaf = byId.get(p.samples[i]);
      if (!leaf || leaf.callFrame.functionName === "(idle)") continue;
      const seen = new Set();
      for (let id = p.samples[i]; id !== undefined; id = parent.get(id)) {
        const cf = byId.get(id).callFrame;
        const key = `${(cf.url || "").split("/").slice(-2).join("/")}:${cf.lineNumber}:${cf.functionName || "anon"}`;
        if (seen.has(key)) continue;
        seen.add(key);
        incl.set(key, (incl.get(key) ?? 0) + dt);
      }
    }
    const want = [/convertFrom/, /middlewareHandler|handleMiddleware/, /uploadCore/, /sniffBody/, /pipeTo|pull/, /arrayBuffer/, /^.*:(\d+):handler$/];
    const inclTop = [...incl].filter(([k]) => want.some((w) => w.test(k))).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, t]) => `${k} ${t.toFixed(1)}`);
    const selfTop = [];
    {
      const self = new Map();
      for (let i = 0; i < p.samples.length; i++) {
        const dt = (p.timeDeltas[i + 1] ?? 0) / 1000;
        const cf = byId.get(p.samples[i])?.callFrame;
        if (!cf || cf.functionName === "(idle)") continue;
        const key = `${(cf.url || "").split("/").slice(-2).join("/")}:${cf.lineNumber}:${cf.functionName || "anon"}`;
        self.set(key, (self.get(key) ?? 0) + dt);
      }
      selfTop.push(...[...self].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, t]) => `${k} ${t.toFixed(1)}`));
    }
    return { label, status: res.status, cpuMs: Number(busy.toFixed(1)), wallMs: wall, selfTop, inclTop };
  }

  const rows = [];
  // Warm-up (first request compiles the bundle).
  await request("GET", "/api/ops/media?limit=1", base);
  for (let r = 0; r < 1; r++) rows.push(await profiled(`GET list limit 60`, () => request("GET", "/api/ops/media", base)));
  const sizes = [1024, 10 * MB, 10 * MB + 1];
  let seed = Date.now() % 1000;
  for (const size of sizes) {
    for (let r = 0; r < 3; r++) {
      const body = webp(size, (seed += 1));
      const sha = createHash("sha256").update(body).digest("hex");
      const headers = {
        ...base,
        "content-type": "image/webp",
        "content-length": String(size),
        "x-almar-sha256": sha,
        "x-almar-width": "2560",
        "x-almar-height": "1707",
        "x-almar-alt-en": encodeURIComponent("CPU probe"),
      };
      rows.push(await profiled(`PUT ${size} bytes`, () => request("PUT", "/api/ops/media", headers, body)));
    }
  }
  for (const row of rows) console.log(JSON.stringify(row));
  ws.close();
} catch (error) {
  console.error(String(error));
  console.error(wlog.slice(-3000));
  process.exitCode = 1;
} finally {
  stop();
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NEWSLETTER_ENDPOINT, NEWSLETTER_HONEYPOT_FIELDS, NEWSLETTER_TIMEOUT_MS, subscribeToNewsletter } from "../lib/newsletter.ts";

// Plan 03.3-27 Task 1: the footer newsletter's submit function, with fetch stubbed (no request leaves the test).

const routeSource = readFileSync("app/newsletter/route.ts", "utf8");

function routeHoneypots() {
  const block = /const HONEYPOT_FIELDS = \[([\s\S]*?)\] as const;/.exec(routeSource);
  assert.ok(block, "HONEYPOT_FIELDS in app/newsletter/route.ts");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** A fetch stub that records each call and answers with `answer()`. */
function stub(answer) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return answer();
  };
  return { fn, calls };
}

test("the honeypot list is the route's, same names and order; the endpoint is the relative /newsletter", () => {
  assert.deepEqual([...NEWSLETTER_HONEYPOT_FIELDS], routeHoneypots());
  assert.equal(NEWSLETTER_HONEYPOT_FIELDS.length, 11);
  assert.equal(NEWSLETTER_ENDPOINT, "/newsletter");
});

test("one same-origin POST of a FormData with exactly Email (trimmed) and the 11 honeypots, all empty", async () => {
  const { fn, calls } = stub(() => Response.json({ ok: true }));
  assert.equal(await subscribeToNewsletter(" a@b.co ", {}, fn), undefined);
  assert.equal(calls.length, 1);
  const [{ url, init }] = calls;
  assert.equal(url, "/newsletter");
  assert.deepEqual(Object.keys(init).sort(), ["body", "credentials", "method", "signal"]);
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal(init.signal.aborted, false);
  assert.equal(init.method, "POST");
  assert.equal(init.credentials, "same-origin");
  assert.ok(init.body instanceof FormData);
  const keys = [...init.body.keys()];
  assert.deepEqual(keys, ["Email", ...NEWSLETTER_HONEYPOT_FIELDS]);
  assert.equal(init.body.get("Email"), "a@b.co");
  for (const field of NEWSLETTER_HONEYPOT_FIELDS) assert.equal(init.body.get(field), "", field);
});

test("a bot's fill reaches the server untouched", async () => {
  const { fn, calls } = stub(() => Response.json({ ok: true }));
  await subscribeToNewsletter("a@b.co", { website: "x", comments: " y " }, fn);
  assert.equal(calls[0].init.body.get("website"), "x");
  assert.equal(calls[0].init.body.get("comments"), " y ");
  // A name that is not a honeypot is not sent.
  await subscribeToNewsletter("a@b.co", { extra: "z" }, fn);
  assert.equal(calls[1].init.body.has("extra"), false);
});

test("success only on 200 with JSON ok === true (the route's {\"ok\":true}; an extra field is ignored)", async () => {
  await subscribeToNewsletter("a@b.co", {}, stub(() => Response.json({ ok: true })).fn);
  await subscribeToNewsletter("a@b.co", {}, stub(() => Response.json({ ok: true, id: "c1" })).fn);
});

test("every other answer rejects, and the error carries the status only, never the body", async () => {
  const SECRET = "qzx-body-text-never-shown";
  const answers = [
    [() => Response.json({ ok: false, note: SECRET }, { status: 400 }), "newsletter 400"],
    [() => new Response(`<html>${SECRET}</html>`, { status: 404 }), "newsletter 404"],
    [() => Response.json({ ok: false }, { status: 429 }), "newsletter 429"],
    [() => new Response(SECRET, { status: 500 }), "newsletter 500"],
    [() => Response.json({ ok: false }, { status: 502 }), "newsletter 502"],
    [() => Response.json({ ok: false }, { status: 503 }), "newsletter 503"],
    [() => Response.json({ ok: false, note: SECRET }), "newsletter 200"],
    [() => Response.json({ ok: "true" }), "newsletter 200"],
    [() => Response.json([true]), "newsletter 200"],
    [() => Response.json(null), "newsletter 200"],
    [() => new Response(`<!doctype html><p>${SECRET}</p>`, { status: 200, headers: { "content-type": "text/html" } }), "newsletter 200"],
    [() => Response.json({ ok: true }, { status: 201 }), "newsletter 201"],
    [
      () => {
        throw new TypeError(`network down ${SECRET}`);
      },
      "newsletter network",
    ],
  ];
  for (const [answer, message] of answers) {
    await assert.rejects(subscribeToNewsletter("a@b.co", {}, stub(answer).fn), (error) => {
      assert.equal(error.message, message);
      assert.equal(String(error.stack ?? "").includes(SECRET) || error.message.includes(SECRET), false);
      return true;
    });
  }
});

test("lib/newsletter.ts imports nothing and touches no window at import", () => {
  const source = readFileSync("lib/newsletter.ts", "utf8");
  assert.equal(/^import\b/m.test(source), false);
  assert.equal(/\bwindow\b|document\./.test(source), false);
  assert.equal(/https?:\/\//.test(source), false, "no absolute URL: the endpoint is same-origin");
});

test("review fix: a stalled request is aborted after the timeout (20 s by default) and rejects as a network failure", async () => {
  assert.equal(NEWSLETTER_TIMEOUT_MS, 20_000);
  // A fetch that never answers on its own, only to its signal, as a real stalled fetch does.
  let seen;
  const stalled = (url, init) => {
    seen = init.signal;
    return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  };
  const started = Date.now();
  await assert.rejects(subscribeToNewsletter("a@b.co", {}, stalled, 50), { message: "newsletter network" });
  assert.equal(seen.aborted, true);
  assert.ok(Date.now() - started < 2000);
  // A body that stalls after a 200 is cut by the same signal.
  const slowBody = (url, init) =>
    Promise.resolve(
      new Response(
        new ReadableStream({
          start(controller) {
            init.signal.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  await assert.rejects(subscribeToNewsletter("a@b.co", {}, slowBody, 50), { message: "newsletter 200" });
  // A quick answer clears the timer: the signal is never aborted afterwards.
  let quick;
  await subscribeToNewsletter("a@b.co", {}, (url, init) => ((quick = init.signal), Promise.resolve(Response.json({ ok: true }))), 50);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(quick.aborted, false);
});

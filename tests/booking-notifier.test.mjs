// Plan 04-05 Task 4: the Resend sender (lib/email/send.ts) and the booking notifier (lib/email/booking-notifier.ts).
// Nothing reaches the network: sendWithResend runs on a fake package `load`, the notifier on a fake `send` and fake
// renderers (the real renderers are Task 1's, still waiting for the owner's signature), and the live notifier's methods
// are never called. RESEND_API_KEY is saved and restored around every case that sets it, with an obviously fake value.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const sendModule = await loadTs("lib/email/send.ts");
const { BOOKING_FROM, resendApiKey, sendWithResend, mailErrorName } = sendModule;
const notifierModule = await loadTs("lib/email/booking-notifier.ts");
const { createBookingNotifier, liveBookingNotifier, liveNotifierFrom } = notifierModule;
const notify = await loadTs("lib/booking/notify.ts");
const { deliverMail, getNotifier, mailKey, NOT_READY_NOTIFIER } = notify;

const INQUIRIES = "inquiries@almarprivatejourney.com";
const BOOKING = "77777777-7777-4777-8777-777777777777";
const PAYMENT = "88888888-8888-4888-8888-888888888888";
const REQUEST = "99999999-9999-4999-8999-999999999999";
const FAKE_KEY = "test-not-a-real-key-0000";
const GUEST = "guest@example.com";

/** Strips comment lines and trailing comments, as the plan's `nc` does, before a source rule. */
function nc(path) {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .map((line) => line.replace(/\s\/\/.*$/, ""))
    .join("\n");
}

async function withKey(value, fn) {
  const saved = process.env.RESEND_API_KEY;
  if (value === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = value;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = saved;
  }
}

/** Fails the test if anything is written to the console while fn runs. */
async function silent(fn) {
  const names = ["log", "info", "warn", "error", "debug"];
  const saved = names.map((n) => console[n]);
  const calls = [];
  for (const n of names) console[n] = (...args) => calls.push([n, args]);
  try {
    return await fn();
  } finally {
    names.forEach((n, i) => (console[n] = saved[i]));
    assert.deepEqual(calls, [], "nothing is logged");
  }
}

// ---------------------------------------------------------------- fixtures

function view(over = {}) {
  return {
    ref: "ALMAR-TEST22",
    status: "awaiting_payment",
    locale: "en",
    guest: { name: "[Guest name]", email: GUEST },
    stay: { slug: "test-stay", title: "[Stay title]", destinationName: "[Destination]", image: null },
    money: { paidFils: 0 },
    transfer: null,
    access: null,
    ...over,
  };
}

const requestJob = (over = {}) => ({ bookingId: BOOKING, view: view(), isTest: false, bookingUrl: "https://almarprivatejourney.com/bookings/trip?ref=ALMAR-TEST22&t=x", ...over });
const paymentJob = (over = {}) => ({
  bookingId: BOOKING,
  paymentId: PAYMENT,
  view: view(),
  isTest: false,
  bookingUrl: null,
  amountFils: 111111,
  receivedOn: "2026-10-20",
  statusBefore: "awaiting_payment",
  statusAfter: "deposit_paid",
  attentionReason: null,
  recordedByEmail: null,
  ...over,
});
const lapseJob = (over = {}) => ({
  bookingId: BOOKING,
  ref: "ALMAR-TEST22",
  email: GUEST,
  guestName: "[Guest name]",
  locale: "ar",
  isTest: false,
  staySlug: "test-stay",
  stayTitle: "[Stay title]",
  arrive: "2026-11-01",
  leave: "2026-11-04",
  deadline: "2026-10-22T10:00:00Z",
  ...over,
});

const GUEST_COPY = { en: { lang: "en" }, ar: { lang: "ar" }, es: { lang: "es" } };
const RENDERERS = [
  "renderRequestReceivedEmail",
  "renderPaymentReceiptEmail",
  "renderRequestLapsedEmail",
  "renderRequestOwnerEmail",
  "renderPaymentOwnerEmail",
  "renderWithdrawnOwnerEmail",
];

/** Fake renderers that record their calls; `throwWith` makes one renderer throw that message. */
function fakeMail({ throwWith = null, only = null } = {}) {
  const calls = [];
  const mail = { guestCopy: GUEST_COPY };
  for (const name of RENDERERS) {
    mail[name] = (job, ctx) => {
      calls.push({ name, job, ctx });
      if (throwWith && (only === null || only === name)) throw new Error(throwWith);
      return { subject: `${job.isTest ? "[TEST] " : ""}${name} ALMAR-TEST22`, html: `<p>${name}</p>`, text: name };
    };
  }
  return { calls, mail };
}

/** A fake send that records (mail, key) and answers `result`, or throws when `result` is an Error. */
function fakeSend(result = { ok: true }) {
  const calls = [];
  const send = async (mail, key) => {
    calls.push({ mail, key });
    if (result instanceof Error) throw result;
    return result;
  };
  return { calls, send };
}

function notifier({ send = fakeSend().send, brand = () => null, mail = fakeMail().mail } = {}) {
  return createBookingNotifier({ send, brand, mail });
}

const METHODS = {
  requestReceived: { job: requestJob, key: `request/${BOOKING}`, renderer: "renderRequestReceivedEmail", to: GUEST, replyTo: INQUIRIES },
  ownerRequest: { job: requestJob, key: `request-owner/${BOOKING}`, renderer: "renderRequestOwnerEmail", to: INQUIRIES, replyTo: GUEST },
  paymentReceipt: { job: paymentJob, key: `receipt/${PAYMENT}`, renderer: "renderPaymentReceiptEmail", to: GUEST, replyTo: INQUIRIES },
  ownerPayment: { job: paymentJob, key: `payment-owner/${PAYMENT}`, renderer: "renderPaymentOwnerEmail", to: INQUIRIES, replyTo: GUEST },
  requestLapsed: { job: lapseJob, key: `lapse/${BOOKING}`, renderer: "renderRequestLapsedEmail", to: GUEST, replyTo: INQUIRIES },
  ownerWithdrawn: { job: requestJob, key: `withdrawn-owner/${BOOKING}`, renderer: "renderWithdrawnOwnerEmail", to: INQUIRIES, replyTo: GUEST },
};
const VIEW_METHODS = ["requestReceived", "ownerRequest", "paymentReceipt", "ownerPayment", "ownerWithdrawn"];

// ================================================================ lib/email/send.ts

test("send: BOOKING_FROM is the sign-in email's FROM text (lib/auth/magic-link-server.ts)", () => {
  const source = readFileSync("lib/auth/magic-link-server.ts", "utf8");
  const from = source.match(/const FROM = "([^"]+)";/);
  assert.ok(from, "FROM found in magic-link-server.ts");
  assert.equal(BOOKING_FROM, from[1]);
  assert.equal(BOOKING_FROM, `ALMAR Private Journey <${INQUIRIES}>`);
});

test("send: resendApiKey reads RESEND_API_KEY trimmed; null when missing or blank", async () => {
  await withKey(undefined, () => assert.equal(resendApiKey(), null));
  await withKey("", () => assert.equal(resendApiKey(), null));
  await withKey("   \n", () => assert.equal(resendApiKey(), null));
  await withKey(`  ${FAKE_KEY}  `, () => assert.equal(resendApiKey(), FAKE_KEY));
});

/** A fake `resend` package: records the client key, the payload and the options; answers `answer` or throws. */
function fakeLoad(answer) {
  const seen = { keys: [], sends: [] };
  const load = async () => ({
    Resend: class {
      constructor(key) {
        seen.keys.push(key);
        this.emails = {
          send: async (payload, options) => {
            seen.sends.push({ payload, options });
            if (answer instanceof Error) throw answer;
            if (answer === "hang") return new Promise(() => {});
            return answer;
          },
        };
      }
    },
  });
  return { seen, load };
}

const OUT = { to: GUEST, replyTo: INQUIRIES, subject: "Request received: ALMAR-TEST22", html: "<p>x</p>", text: "x" };

test("send: one emails.send with from, to as a list, subject, html, text, replyTo and the idempotency key", async () => {
  const { seen, load } = fakeLoad({ data: { id: "email-id-1" }, error: null });
  const key = `request/${BOOKING}`;
  assert.deepEqual(await silent(() => sendWithResend(FAKE_KEY, OUT, key, load)), { ok: true });
  assert.deepEqual(seen.keys, [FAKE_KEY]);
  assert.equal(seen.sends.length, 1);
  assert.deepEqual(seen.sends[0].payload, { from: BOOKING_FROM, to: [GUEST], subject: OUT.subject, html: OUT.html, text: OUT.text, replyTo: INQUIRIES });
  assert.deepEqual(seen.sends[0].options, { idempotencyKey: key });
});

test("send: replyTo is left out of the payload when undefined", async () => {
  const { seen, load } = fakeLoad({ data: { id: "email-id-2" }, error: null });
  const { replyTo, ...noReply } = OUT;
  assert.equal(replyTo, INQUIRIES);
  await sendWithResend(FAKE_KEY, noReply, `lapse/${BOOKING}`, load);
  assert.equal(Object.hasOwn(seen.sends[0].payload, "replyTo"), false);
});

test("send: a Resend error answers its short name; no id answers no_id; a throw or a failed load answers threw", async () => {
  const cases = [
    [{ data: null, error: { name: "rate_limit_exceeded", statusCode: 429, message: `limit for ${GUEST}` } }, "rate_limit_exceeded"],
    [{ data: null, error: { name: "Validation_Error", statusCode: 422, message: "bad" } }, "validation_error"],
    [{ data: null, error: { name: "not a code!", statusCode: 503, message: "x" } }, "http_503"],
    [{ data: null, error: { message: "x" } }, "send_error"],
    [{ data: {}, error: null }, "no_id"],
    [{ data: { id: "" }, error: null }, "no_id"],
    [{ data: null, error: null }, "no_id"],
    [new Error(`boom ${FAKE_KEY}`), "threw"],
  ];
  for (const [answer, error] of cases) {
    const { load } = fakeLoad(answer);
    const outcome = await silent(() => sendWithResend(FAKE_KEY, OUT, `request/${BOOKING}`, load));
    assert.deepEqual(outcome, { ok: false, error }, error);
    assert.doesNotMatch(JSON.stringify(outcome), new RegExp(`${FAKE_KEY}|example`), "no key, no address");
  }
  const failedLoad = await sendWithResend(FAKE_KEY, OUT, `request/${BOOKING}`, async () => {
    throw new Error("cannot load");
  });
  assert.deepEqual(failedLoad, { ok: false, error: "threw" });
});

test("send: an error name that would carry the key answers send_error", async () => {
  const { load } = fakeLoad({ data: null, error: { name: FAKE_KEY.replace(/-/g, "_"), statusCode: 400 } });
  const key = FAKE_KEY.replace(/-/g, "_");
  const outcome = await sendWithResend(key, OUT, `request/${BOOKING}`, load);
  assert.deepEqual(outcome, { ok: false, error: "send_error" });
});

test("send: a send that never answers resolves timeout after timeoutMs; never throws", async () => {
  const { load } = fakeLoad("hang");
  const outcome = await sendWithResend(FAKE_KEY, OUT, `request/${BOOKING}`, load, 20);
  assert.deepEqual(outcome, { ok: false, error: "timeout" });
});

test("send: mailErrorName lower-cases a code name, else http_<status>, else send_error", () => {
  assert.equal(mailErrorName({ name: "daily_quota_exceeded" }), "daily_quota_exceeded");
  assert.equal(mailErrorName({ name: "INVALID_FROM_ADDRESS" }), "invalid_from_address");
  assert.equal(mailErrorName({ name: "x".repeat(61), statusCode: 500 }), "http_500");
  assert.equal(mailErrorName({ name: "has space", statusCode: "429" }), "http_429");
  assert.equal(mailErrorName({ statusCode: 42 }), "send_error");
  assert.equal(mailErrorName({ statusCode: 4290 }), "send_error");
  assert.equal(mailErrorName(null), "send_error");
  assert.equal(mailErrorName("rate_limit_exceeded"), "send_error");
  assert.equal(mailErrorName({ name: `${GUEST}` }), "send_error");
});

test("send: source rules (one environment read, the package imported lazily, no console)", () => {
  const source = nc("lib/email/send.ts");
  assert.equal((source.match(/process\.env/g) ?? []).length, 1, "one process.env read");
  assert.equal((source.match(/import\("resend"\)/g) ?? []).length, 1, "one lazy import");
  assert.doesNotMatch(source, /^import.*from "resend"/m, "no top-level import of the package");
  assert.doesNotMatch(source, /console\./);
});

// ================================================================ lib/email/booking-notifier.ts

test("notifier: ready, with the six methods of 04-08's BookingNotifier", () => {
  const n = notifier();
  assert.equal(n.ready, true);
  for (const method of Object.keys(METHODS)) assert.equal(typeof n[method], "function", method);
});

for (const [method, c] of Object.entries(METHODS)) {
  test(`notifier ${method}: renders with ${c.renderer}, sends to ${c.to === GUEST ? "the guest" : "inquiries@"} with its reply-to and the key unchanged`, async () => {
    const { calls, send } = fakeSend({ ok: true });
    const { calls: renders, mail } = fakeMail();
    const n = notifier({ send, mail });
    const job = c.job();
    assert.deepEqual(await silent(() => n[method](job, { idempotencyKey: c.key })), { ok: true });
    assert.equal(renders.length, 1);
    assert.equal(renders[0].name, c.renderer);
    assert.equal(renders[0].job, job);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].key, c.key);
    assert.deepEqual(calls[0].mail, { to: c.to, replyTo: c.replyTo, subject: `${c.renderer} ALMAR-TEST22`, html: `<p>${c.renderer}</p>`, text: c.renderer });
  });
}

test("notifier: guest renderers get the booking's language copy (else English); owner renderers get only the brand", async () => {
  const { calls, mail } = fakeMail();
  const n = notifier({ mail });
  await n.requestReceived(requestJob({ view: view({ locale: "ar" }) }), { idempotencyKey: `request/${BOOKING}` });
  await n.paymentReceipt(paymentJob({ view: view({ locale: "es" }) }), { idempotencyKey: `receipt/${PAYMENT}` });
  await n.requestLapsed(lapseJob({ locale: "fr" }), { idempotencyKey: `lapse/${BOOKING}` });
  await n.ownerRequest(requestJob({ view: view({ locale: "ar" }) }), { idempotencyKey: `request-owner/${BOOKING}` });
  assert.deepEqual(calls.map((c) => c.ctx), [
    { copy: GUEST_COPY.ar, brand: null },
    { copy: GUEST_COPY.es, brand: null },
    { copy: GUEST_COPY.en, brand: null },
    { brand: null },
  ]);
});

test("notifier: the saved brand is passed; a brand reader that throws or rejects means the design system and still sends", async () => {
  const brand = { teal: "#1f3b40", white: "#ffffff", ivory: "#fffaf0", ink: "#262626", titleFace: "Questa", bodyFace: "Lato", logoUrl: null };
  for (const [reader, expected] of [
    [() => brand, brand],
    [async () => brand, brand],
    [() => { throw new Error("settings down"); }, null],
    [async () => { throw new Error("settings down"); }, null],
    [async () => null, null],
  ]) {
    const { calls, send } = fakeSend();
    const { calls: renders, mail } = fakeMail();
    const outcome = await createBookingNotifier({ send, brand: reader, mail }).ownerPayment(paymentJob(), { idempotencyKey: `payment-owner/${PAYMENT}` });
    assert.deepEqual(outcome, { ok: true });
    assert.equal(renders[0].ctx.brand, expected);
    assert.equal(calls.length, 1);
  }
});

test("notifier: a saved brand the shell refuses is rendered again with the design system", async () => {
  const brand = { teal: "not-a-hex", white: "#ffffff", ivory: "#fffaf0", ink: "#262626", titleFace: "Questa", bodyFace: "Lato", logoUrl: null };
  const calls = [];
  const mail = fakeMail().mail;
  mail.renderRequestOwnerEmail = (job, ctx) => {
    calls.push(ctx.brand);
    if (ctx.brand) throw new Error("email brand: teal is not #rrggbb");
    return { subject: "s", html: "h", text: "t" };
  };
  const { calls: sent, send } = fakeSend();
  const outcome = await notifier({ send, brand: () => brand, mail }).ownerRequest(requestJob(), { idempotencyKey: `request-owner/${BOOKING}` });
  assert.deepEqual(outcome, { ok: true });
  assert.deepEqual(calls, [brand, null]);
  assert.equal(sent.length, 1);
});

test("notifier: owner notices leave out replyTo when the guest's address is not one plain address", async () => {
  for (const email of ["two@example.com, three@example.com", "bad\r\nBcc: x@example.com", "", null, undefined]) {
    const { calls, send } = fakeSend();
    const job = requestJob({ view: view({ guest: { name: "[Guest name]", email } }) });
    assert.deepEqual(await notifier({ send }).ownerWithdrawn(job, { idempotencyKey: `withdrawn-owner/${BOOKING}` }), { ok: true });
    assert.equal(calls[0].mail.to, INQUIRIES);
    assert.equal(Object.hasOwn(calls[0].mail, "replyTo"), false, String(email));
  }
});

test("notifier: a guest recipient that is not one plain address answers bad_address without rendering or sending", async () => {
  for (const email of ["two@example.com, three@example.com", "bad\r\nBcc: x@example.com", "no-at-sign", "", null, 42]) {
    const { calls, send } = fakeSend();
    const { calls: renders, mail } = fakeMail();
    const n = notifier({ send, mail });
    const guestView = view({ guest: { name: "[Guest name]", email } });
    assert.deepEqual(await n.requestReceived(requestJob({ view: guestView }), { idempotencyKey: `request/${BOOKING}` }), { ok: false, error: "bad_address" });
    assert.deepEqual(await n.paymentReceipt(paymentJob({ view: guestView }), { idempotencyKey: `receipt/${PAYMENT}` }), { ok: false, error: "bad_address" });
    assert.deepEqual(await n.requestLapsed(lapseJob({ email }), { idempotencyKey: `lapse/${BOOKING}` }), { ok: false, error: "bad_address" });
    assert.equal(calls.length, 0, String(email));
    assert.equal(renders.length, 0, String(email));
  }
});

test("notifier: a key outside the mail key shapes answers bad_key without sending", async () => {
  const bad = ["", "request", "request/", "unknown/abc", `request/${BOOKING}/x/y`, "request/a b", `request/${"a".repeat(81)}`, "../request/abc", "request/abc\n", 42, undefined];
  for (const key of bad) {
    const { calls, send } = fakeSend();
    const n = notifier({ send });
    for (const [method, c] of Object.entries(METHODS)) {
      assert.deepEqual(await n[method](c.job(), { idempotencyKey: key }), { ok: false, error: "bad_key" }, `${method} ${String(key)}`);
    }
    assert.equal(calls.length, 0);
  }
  const { calls, send } = fakeSend();
  assert.deepEqual(await notifier({ send }).paymentReceipt(paymentJob(), undefined), { ok: false, error: "bad_key" });
  assert.equal(calls.length, 0);
});

test("notifier: the dashboard resend key resend/<bookingId>/<requestId> reaches send unchanged", async () => {
  const key = `resend/${BOOKING}/${REQUEST}`;
  for (const method of ["paymentReceipt", "requestReceived"]) {
    const { calls, send } = fakeSend();
    assert.deepEqual(await notifier({ send })[method](METHODS[method].job(), { idempotencyKey: key }), { ok: true });
    assert.equal(calls[0].key, key);
  }
});

test("notifier: a job whose view is null or missing answers no_view without rendering or sending (decision 5)", async () => {
  for (const method of VIEW_METHODS) {
    for (const job of [{ ...METHODS[method].job(), view: null }, { bookingId: BOOKING }, null, undefined]) {
      const { calls, send } = fakeSend();
      const { calls: renders, mail } = fakeMail();
      assert.deepEqual(await notifier({ send, mail })[method](job, { idempotencyKey: METHODS[method].key }), { ok: false, error: "no_view" }, method);
      assert.equal(calls.length, 0);
      assert.equal(renders.length, 0);
    }
  }
  const { calls, send } = fakeSend();
  assert.deepEqual(await notifier({ send }).requestLapsed(null, { idempotencyKey: `lapse/${BOOKING}` }), { ok: false, error: "no_view" });
  assert.equal(calls.length, 0);
});

test("notifier: renderer refusals map to bad_reference, bad_link, no_transfer; any other throw to threw; nothing sends", async () => {
  for (const [message, error] of [
    ["email: bad reference", "bad_reference"],
    ["email: bad link", "bad_link"],
    ["email: no transfer", "no_transfer"],
    [`something else about ${GUEST}`, "threw"],
  ]) {
    for (const [method, c] of Object.entries(METHODS)) {
      const { calls, send } = fakeSend();
      const { mail } = fakeMail({ throwWith: message });
      assert.deepEqual(await silent(() => notifier({ send, mail })[method](c.job(), { idempotencyKey: c.key })), { ok: false, error }, `${method} ${message}`);
      assert.equal(calls.length, 0);
    }
  }
});

test("notifier: a send that throws resolves threw; a refused send keeps its short name; an odd answer is send_error", async () => {
  for (const [method, c] of Object.entries(METHODS)) {
    const thrown = await notifier({ send: fakeSend(new Error(`down ${GUEST}`)).send })[method](c.job(), { idempotencyKey: c.key });
    assert.deepEqual(thrown, { ok: false, error: "threw" }, method);
    const refused = await notifier({ send: fakeSend({ ok: false, error: "http_429" }).send })[method](c.job(), { idempotencyKey: c.key });
    assert.deepEqual(refused, { ok: false, error: "http_429" }, method);
    for (const odd of [{ ok: false, error: `Rate limit for ${GUEST}` }, null, "sent", { ok: "yes" }]) {
      const answer = await notifier({ send: fakeSend(odd).send })[method](c.job(), { idempotencyKey: c.key });
      assert.deepEqual(answer, { ok: false, error: "send_error" }, `${method} ${JSON.stringify(odd)}`);
    }
  }
});

test("notifier ownerWithdrawn (R2): inquiries@ with the guest as reply-to; the withdrawn-owner key unchanged; TEST subject; null view; throw", async () => {
  const key = mailKey("ownerWithdrawn", BOOKING);
  assert.equal(key, `withdrawn-owner/${BOOKING}`);
  const { calls, send } = fakeSend();
  assert.deepEqual(await notifier({ send }).ownerWithdrawn(requestJob({ isTest: true }), { idempotencyKey: key }), { ok: true });
  assert.equal(calls[0].mail.to, INQUIRIES);
  assert.equal(calls[0].mail.replyTo, GUEST);
  assert.equal(calls[0].key, key);
  assert.match(calls[0].mail.subject, /^\[TEST\] /);
  const empty = fakeSend();
  assert.deepEqual(await notifier({ send: empty.send }).ownerWithdrawn(requestJob({ view: null }), { idempotencyKey: key }), { ok: false, error: "no_view" });
  assert.equal(empty.calls.length, 0);
  assert.deepEqual(await notifier({ send: fakeSend(new Error("x")).send }).ownerWithdrawn(requestJob(), { idempotencyKey: key }), { ok: false, error: "threw" });
});

test("notifier: every method resolves and none rejects, whatever the input", async () => {
  const hostile = [undefined, null, 42, "x", {}, { view: 42 }, { view: {} }];
  const n = notifier({ send: fakeSend(new Error("x")).send });
  for (const method of Object.keys(METHODS)) {
    for (const job of hostile) {
      for (const opts of [undefined, null, {}, { idempotencyKey: METHODS[method].key }]) {
        const outcome = await n[method](job, opts);
        assert.equal(outcome.ok, false, `${method} ${JSON.stringify(job)} ${JSON.stringify(opts)}`);
        assert.match(outcome.error, /^[a-z0-9_]{1,60}$/);
      }
    }
  }
});

// ---------------------------------------------------------------- through 04-08's real deliverMail

function logDb() {
  const events = [];
  return {
    events,
    rpc: async (name, args) => {
      if (name !== "log_booking_event") throw new Error(`unexpected rpc ${name}`);
      events.push(args);
      return { data: null, error: null };
    },
  };
}

const TEMPLATE = {
  requestReceived: "request_received",
  ownerRequest: "request_owner",
  paymentReceipt: "payment_receipt",
  ownerPayment: "payment_owner",
  requestLapsed: "request_lapsed",
  ownerWithdrawn: "request_withdrawn_owner",
};

test("deliverMail + notifier: email_sent { template, key }, email_failed { template, key, error }, email_pending { template, key }; key = the idempotency key", async () => {
  const keys = { ...Object.fromEntries(Object.entries(METHODS).map(([m, c]) => [m, c.key])) };
  for (const [method, c] of Object.entries(METHODS)) {
    const template = TEMPLATE[method];
    const key = keys[method];
    // sent
    const okDb = logDb();
    const okSend = fakeSend();
    const okNotifier = notifier({ send: okSend.send });
    const sent = await deliverMail(okDb, { bookingId: BOOKING, template, idempotencyKey: key, ready: okNotifier.ready, send: () => okNotifier[method](c.job(), { idempotencyKey: key }) });
    assert.equal(sent, "sent", method);
    assert.deepEqual(okDb.events.map((e) => [e.p_action, e.p_detail]), [["email_sent", { template, key }]]);
    assert.equal(okSend.calls[0].key, key);
    // failed: the notifier's own error name
    const failDb = logDb();
    const failNotifier = notifier({ send: fakeSend(new Error("x")).send });
    await deliverMail(failDb, { bookingId: BOOKING, template, idempotencyKey: key, ready: true, send: () => failNotifier[method](c.job(), { idempotencyKey: key }) });
    assert.deepEqual(failDb.events.map((e) => [e.p_action, e.p_detail]), [["email_failed", { template, key, error: "threw" }]]);
    // pending: the not-ready default
    const pendDb = logDb();
    await deliverMail(pendDb, { bookingId: BOOKING, template, idempotencyKey: key, ready: NOT_READY_NOTIFIER.ready, send: () => NOT_READY_NOTIFIER[method](c.job(), { idempotencyKey: key }) });
    assert.deepEqual(pendDb.events.map((e) => [e.p_action, e.p_detail]), [["email_pending", { template, key }]]);
  }
});

test("deliverMail + notifier: bad_address and no_view reach email_failed with the key; the resend and withdrawn-owner keys too", async () => {
  const cases = [
    ["requestReceived", "request_received", `request/${BOOKING}`, requestJob({ view: view({ guest: { name: "x", email: "bad" } }) }), "bad_address"],
    ["ownerWithdrawn", "request_withdrawn_owner", `withdrawn-owner/${BOOKING}`, requestJob({ view: null }), "no_view"],
    ["paymentReceipt", "payment_receipt", `resend/${BOOKING}/${REQUEST}`, paymentJob({ view: null }), "no_view"],
  ];
  for (const [method, template, key, job, error] of cases) {
    const db = logDb();
    const n = notifier();
    await deliverMail(db, { bookingId: BOOKING, template, idempotencyKey: key, ready: true, send: () => n[method](job, { idempotencyKey: key }) });
    assert.deepEqual(db.events.map((e) => [e.p_action, e.p_detail]), [["email_failed", { template, key, error }]]);
  }
  const db = logDb();
  const { calls, send } = fakeSend();
  const n = notifier({ send });
  const key = `resend/${BOOKING}/${REQUEST}`;
  await deliverMail(db, { bookingId: BOOKING, template: "request_received", idempotencyKey: key, ready: true, send: () => n.requestReceived(requestJob(), { idempotencyKey: key }) });
  assert.deepEqual(db.events[0].p_detail, { template: "request_received", key });
  assert.equal(calls[0].key, key);
  const withdrawnKey = mailKey("ownerWithdrawn", BOOKING);
  const wdb = logDb();
  const w = fakeSend();
  const wn = notifier({ send: w.send });
  await deliverMail(wdb, { bookingId: BOOKING, template: "request_withdrawn_owner", idempotencyKey: withdrawnKey, ready: true, send: () => wn.ownerWithdrawn(requestJob(), { idempotencyKey: withdrawnKey }) });
  assert.deepEqual(wdb.events[0].p_detail, { template: "request_withdrawn_owner", key: `withdrawn-owner/${BOOKING}` });
  assert.equal(w.calls[0].key, `withdrawn-owner/${BOOKING}`);
});

// ---------------------------------------------------------------- the live wiring and getNotifier (E-16)

test("live: liveNotifierFrom is null without a key or without the renderers; ready with both (methods never called)", () => {
  const { mail } = fakeMail();
  assert.equal(liveNotifierFrom(null, mail), null);
  assert.equal(liveNotifierFrom(FAKE_KEY, null), null);
  const live = liveNotifierFrom(FAKE_KEY, mail);
  assert.equal(live.ready, true);
  for (const method of Object.keys(METHODS)) assert.equal(typeof live[method], "function", method);
});

test("live: liveBookingNotifier is null without RESEND_API_KEY", async () => {
  await withKey(undefined, () => assert.equal(liveBookingNotifier(), null));
  await withKey("  ", () => assert.equal(liveBookingNotifier(), null));
});

test("live: getNotifier without RESEND_API_KEY is the NOT_READY_NOTIFIER object itself", async () => {
  await withKey(undefined, () => {
    assert.equal(getNotifier(), NOT_READY_NOTIFIER);
    assert.equal(getNotifier().ready, false);
  });
});

test(
  "live (E-16, after the flip): with RESEND_API_KEY set, liveBookingNotifier and getNotifier are ready and not NOT_READY_NOTIFIER; decided on each call",
  { todo: "the flip waits for the Task 1 renderers (BOOKING_MAIL in lib/email/booking-notifier.ts, getNotifier's TODO)" },
  async () => {
    await withKey(FAKE_KEY, () => {
      const live = liveBookingNotifier();
      assert.notEqual(live, null);
      assert.equal(live.ready, true);
      const n = getNotifier();
      assert.notEqual(n, NOT_READY_NOTIFIER);
      assert.equal(n.ready, true);
    });
    await withKey(undefined, () => assert.equal(getNotifier(), NOT_READY_NOTIFIER));
  },
);

test("source rules: the notifier and the seam read no environment, never import the package at the top, never log", () => {
  for (const path of ["lib/booking/notify.ts", "lib/email/booking-notifier.ts"]) {
    const source = nc(path);
    assert.doesNotMatch(source, /process\.env/, path);
    assert.doesNotMatch(source, /console\./, path);
    assert.doesNotMatch(source, /^import.*from "resend"/m, path);
  }
  const notifierSource = nc("lib/email/booking-notifier.ts");
  assert.match(notifierSource, /sendWithResend\(/);
  assert.match(notifierSource, /renderWithdrawnOwnerEmail\(/);
  // Types only from the seam: no runtime import back into lib/booking/notify.ts (no cycle).
  assert.match(notifierSource, /^import type \{[^}]*\} from "\.\.\/booking\/notify";$/m);
  assert.doesNotMatch(notifierSource, /^import \{[^}]*\} from "\.\.\/booking\/notify";$/m);
});

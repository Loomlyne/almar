// Plan 04-06, Task 3: lib/booking/after-request.ts, the pure part of Send request and of resume after a refresh
// (requestOutcome, resumeOutcome, sentFromView, sentFromRequest, requestPhaseReducer, holdEndNow), plus the source rules
// of after-request.ts and request-client.ts. Symbolic values only: fils such as 30000, references of isBookingRef's
// alphabet, a fixed nowMs. No date formatting test here: that is 04-03's uaeDateTime.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const {
  requestOutcome,
  resumeOutcome,
  sentFromView,
  sentFromRequest,
  requestPhaseReducer,
  holdEndNow,
  INITIAL_REQUEST_PHASE,
} = await loadTs("lib/booking/after-request.ts");
const { REQUEST_TIMEOUT_MS } = await loadTs("lib/booking/request-client.ts");

const REF = "ALMAR-7K3P9Q";
const NOW = Date.parse("2026-11-02T08:00:00Z");
const DEADLINE = "2026-11-03T08:00:00+00:00";
const DUE_NOW = 30000;
const SUMMARY_KEYS = ["deadline", "dueNowFils", "emailSent", "plan", "ref"];

const sentBody = (o = {}) => ({ ok: true, ref: REF, status: "awaiting_payment", deadline: DEADLINE, firstTime: true, emailSent: true, ...o });
const refused = (...codes) => ({ ok: false, reasons: codes.map((code) => ({ code })) });

// A whole view with a bank block of documentation values: the summary must never copy it.
function view(o = {}) {
  return {
    ref: REF,
    status: "awaiting_payment",
    locale: "en",
    guest: { name: "[Guest name]", email: "guest@example.com" },
    stay: { slug: "test-stay", title: "[Stay name]", destinationName: "[Destination]", image: null },
    arrive: "2026-12-10",
    leave: "2026-12-15",
    nights: 5,
    adults: 2,
    children: 0,
    infants: 0,
    travellers: [],
    lines: [],
    airport: "DXB",
    pickupAddress: null,
    plan: "deposit",
    money: {
      nightsFils: 60000,
      addonsFils: 0,
      subtotalFils: 60000,
      vatBp: 500,
      vatFils: 3000,
      grandFils: 63000,
      depositFils: DUE_NOW,
      balanceFils: 33000,
      paidFils: 0,
      refundedFils: 0,
      dueNowFils: DUE_NOW,
      stillDueFils: 63000,
    },
    holdExpiresAt: null,
    deadline: DEADLINE,
    balanceDueDate: "2026-11-26",
    flags: { partReceived: false, overpaid: false, writtenOff: false },
    withdrawable: true,
    payments: [],
    refunds: [],
    transfer: {
      accountName: "[Account name]",
      bankName: "[Bank name]",
      iban: "GB82 WEST 1234 5698 7654 32",
      swift: "TESTAEAAXXX",
      bankAddress: "[Bank address]",
      note: "[Note line]",
      currency: "AED",
      amountFils: DUE_NOW,
      reference: REF,
      payBy: DEADLINE,
      dueBy: null,
    },
    access: null,
    ...o,
  };
}
const viewBody = (o = {}) => ({ ok: true, booking: view(o) });

// ---------------------------------------------------------------- requestOutcome

test("requestOutcome: 200 with a checked reference is sent, with the deadline, firstTime and emailSent", () => {
  assert.deepEqual(requestOutcome(200, sentBody()), { kind: "sent", ref: REF, deadline: DEADLINE, firstTime: true, emailSent: true });
  assert.deepEqual(requestOutcome(200, sentBody({ firstTime: false, emailSent: false })), {
    kind: "sent",
    ref: REF,
    deadline: DEADLINE,
    firstTime: false,
    emailSent: false,
  });
  assert.deepEqual(requestOutcome(200, sentBody({ deadline: null })), { kind: "sent", ref: REF, deadline: null, firstTime: true, emailSent: true });
});

test("requestOutcome: the deadline passes only in the shape uaeDateTime reads, else null", () => {
  const accepted = ["2026-11-03T08:00:00Z", "2026-11-03T08:00Z", "2026-11-03T12:00:00+04:00", "2026-11-03T08:00:00.123456+00:00", "2026-11-03T03:00:00-05:00"];
  for (const d of accepted) assert.equal(requestOutcome(200, sentBody({ deadline: d })).deadline, d, d);
  const rejected = [
    "2026-11-03",
    "2026-11-03T08:00:00",
    "2026-11-03 08:00:00+00:00",
    "03/11/2026 12:00",
    "2026-11-03T08:00:00+0400",
    "2026-13-45T08:00:00Z",
    "tomorrow",
    "",
    "<b>2026-11-03T08:00:00Z</b>",
  ];
  for (const d of rejected) assert.equal(requestOutcome(200, sentBody({ deadline: d })).deadline, null, d);
});

test("requestOutcome: a 200 not of the answer's shape is retry", () => {
  const bad = [
    null,
    "ok",
    [],
    { ...sentBody(), ok: false },
    sentBody({ ok: "true" }),
    sentBody({ ref: "ALMAR-7K3P9" }),
    sentBody({ ref: "almar-7k3p9q" }),
    sentBody({ ref: "ALMAR-7K3P9I" }),
    sentBody({ ref: `${REF} ` }),
    sentBody({ ref: undefined }),
    sentBody({ status: "pending" }),
    sentBody({ status: undefined }),
    sentBody({ deadline: 1_781_000 }),
    sentBody({ firstTime: "yes" }),
    sentBody({ firstTime: undefined }),
    sentBody({ emailSent: 1 }),
    sentBody({ emailSent: undefined }),
  ];
  for (const body of bad) assert.deepEqual(requestOutcome(200, body), { kind: "retry" }, JSON.stringify(body));
});

test("requestOutcome: the status table", () => {
  const rows = [
    [404, { ok: false }, { kind: "ended" }],
    [404, null, { kind: "ended" }],
    [409, refused("hold_ended"), { kind: "ended" }],
    [409, refused("sold_out"), { kind: "taken", reasons: [{ code: "sold_out" }] }],
    [409, refused("blocked"), { kind: "taken", reasons: [{ code: "blocked" }] }],
    [429, refused("too_many_open"), { kind: "refused", reasons: [{ code: "too_many_open" }] }],
    [503, refused("requests_closed"), { kind: "closed", reasons: [{ code: "requests_closed" }] }],
    [503, refused("unavailable"), { kind: "retry" }],
    [503, null, { kind: "retry" }],
    [400, refused("invalid"), { kind: "retry" }],
    [403, refused("invalid"), { kind: "retry" }],
    [413, refused("invalid"), { kind: "retry" }],
    [500, refused("requests_closed"), { kind: "retry" }],
    [502, null, { kind: "retry" }],
    [0, null, { kind: "retry" }],
    [201, sentBody(), { kind: "retry" }],
  ];
  for (const [status, body, want] of rows) assert.deepEqual(requestOutcome(status, body), want, `${status} ${JSON.stringify(body)}`);
});

test("requestOutcome: a code not expected for its status, or a body of another shape, is retry", () => {
  const rows = [
    [409, refused("too_many_open")],
    [409, refused("requests_closed")],
    [409, refused("unavailable")],
    [409, { ok: false }],
    [409, { ok: false, reasons: "sold_out" }],
    [409, { ok: true, reasons: [{ code: "sold_out" }] }],
    [409, { reasons: [{ code: "sold_out" }] }],
    [409, null],
    [429, refused("hold_limit")],
    [429, refused("sold_out")],
    [429, null],
    [503, refused("too_many_open")],
    [503, { ok: false, reasons: [{ code: 7 }] }],
    [200, refused("sold_out")],
  ];
  for (const [status, body] of rows) assert.deepEqual(requestOutcome(status, body), { kind: "retry" }, `${status} ${JSON.stringify(body)}`);
});

test("requestOutcome: reasons are rebuilt from the code alone; no other server string passes", () => {
  const taken = requestOutcome(409, { ok: false, reasons: [{ code: "sold_out", nights: ["2026-12-10"], field: "<script>", id: "x" }] });
  assert.deepEqual(taken, { kind: "taken", reasons: [{ code: "sold_out" }] });
  const refusedOne = requestOutcome(429, { ok: false, reasons: [{ code: "too_many_open", max: 3, field: "email" }] });
  assert.deepEqual(refusedOne, { kind: "refused", reasons: [{ code: "too_many_open" }] });
  const sent = requestOutcome(200, { ...sentBody(), extra: "<img>", transfer: { iban: "GB82 WEST 1234 5698 7654 32" } });
  assert.deepEqual(Object.keys(sent).sort(), ["deadline", "emailSent", "firstTime", "kind", "ref"]);
  assert.doesNotMatch(JSON.stringify(sent), /GB82|<img>/);
});

test("requestOutcome: never throws", () => {
  const odd = [undefined, null, 0, "", [], {}, { ok: false, reasons: [null, 1, "x", []] }, Object.create(null), sentBody({ deadline: {} })];
  for (const status of [0, 200, 400, 404, 409, 429, 503, -1, Number.NaN]) {
    for (const body of odd) assert.doesNotThrow(() => requestOutcome(status, body), `${status} ${String(body)}`);
  }
});

// ---------------------------------------------------------------- resumeOutcome

test("resumeOutcome: held with an end later than nowMs is held, with the server's end", () => {
  const end = "2026-11-02T08:20:00+00:00";
  assert.deepEqual(resumeOutcome(200, viewBody({ status: "held", holdExpiresAt: end, deadline: null }), NOW), { kind: "held", holdExpiresAt: end });
  const oneMsAhead = new Date(NOW + 1).toISOString();
  assert.deepEqual(resumeOutcome(200, viewBody({ status: "held", holdExpiresAt: oneMsAhead }), NOW), { kind: "held", holdExpiresAt: oneMsAhead });
});

test("resumeOutcome: held with its end past, at nowMs or missing is ended", () => {
  for (const holdExpiresAt of ["2026-11-02T07:59:00+00:00", new Date(NOW).toISOString(), null, undefined]) {
    assert.deepEqual(resumeOutcome(200, viewBody({ status: "held", holdExpiresAt }), NOW), { kind: "ended" }, String(holdExpiresAt));
  }
});

test("resumeOutcome: awaiting_payment is sent, from the view, with emailSent null", () => {
  const out = resumeOutcome(200, viewBody(), NOW);
  assert.deepEqual(out, { kind: "sent", summary: { ref: REF, plan: "deposit", dueNowFils: DUE_NOW, deadline: DEADLINE, emailSent: null } });
  assert.deepEqual(Object.keys(out.summary).sort(), SUMMARY_KEYS);
  assert.doesNotMatch(JSON.stringify(out), /GB82|Account name|Bank name|TESTAEAAXXX|transfer/);
  const full = resumeOutcome(200, viewBody({ plan: "full" }), NOW);
  assert.equal(full.summary.plan, "full");
});

test("resumeOutcome: the local clock never decides an awaiting request (its deadline already past on the device)", () => {
  const late = NOW + 3 * 24 * 60 * 60 * 1000;
  assert.equal(resumeOutcome(200, viewBody(), late).kind, "sent");
  assert.equal(resumeOutcome(200, viewBody({ holdExpiresAt: "2026-11-02T07:00:00+00:00" }), late).kind, "sent");
});

test("resumeOutcome: expired and 404 are ended; every later status is elsewhere with the reference", () => {
  assert.deepEqual(resumeOutcome(200, viewBody({ status: "expired", deadline: null }), NOW), { kind: "ended" });
  assert.deepEqual(resumeOutcome(404, { ok: false }, NOW), { kind: "ended" });
  assert.deepEqual(resumeOutcome(404, null, NOW), { kind: "ended" });
  for (const status of ["deposit_paid", "paid_in_full", "confirmed", "completed", "cancelled"]) {
    assert.deepEqual(resumeOutcome(200, viewBody({ status, deadline: null }), NOW), { kind: "elsewhere", ref: REF }, status);
  }
});

test("resumeOutcome: anything else is retry", () => {
  const rows = [
    [503, viewBody()],
    [503, null],
    [0, null],
    [400, null],
    [403, null],
    [413, null],
    [500, viewBody()],
    [200, null],
    [200, { ok: false }],
    [200, { ok: true }],
    [200, { ok: true, booking: null }],
    [200, { ok: true, booking: [] }],
    [200, viewBody({ ref: "ALMAR-7K3P9O" })],
    [200, viewBody({ ref: undefined })],
    [200, viewBody({ status: "pending" })],
    [200, viewBody({ status: undefined })],
    [200, viewBody({ plan: "half" })],
    [200, viewBody({ plan: undefined })],
    [200, viewBody({ money: undefined })],
    [200, viewBody({ money: null })],
    [200, viewBody({ money: { grandFils: 63000 } })],
    [200, viewBody({ money: { dueNowFils: -1 } })],
    [200, viewBody({ money: { dueNowFils: 300.5 } })],
    [200, viewBody({ money: { dueNowFils: "30000" } })],
    [200, viewBody({ deadline: 1_781_000 })],
    [200, viewBody({ status: "held", holdExpiresAt: "in ten minutes" })],
    [200, viewBody({ status: "held", holdExpiresAt: 1_781_000 })],
  ];
  for (const [status, body] of rows) assert.deepEqual(resumeOutcome(status, body, NOW), { kind: "retry" }, `${status} ${JSON.stringify(body)}`);
});

test("resumeOutcome: an awaiting deadline uaeDateTime cannot read becomes null; never throws", () => {
  assert.equal(resumeOutcome(200, viewBody({ deadline: "2026-11-03" }), NOW).summary.deadline, null);
  assert.equal(resumeOutcome(200, viewBody({ deadline: null }), NOW).summary.deadline, null);
  for (const status of [0, 200, 404, 503]) {
    for (const body of [undefined, null, {}, [], "x", { ok: true, booking: { money: [] } }]) {
      assert.doesNotThrow(() => resumeOutcome(status, body, NOW));
      assert.doesNotThrow(() => resumeOutcome(status, body, Number.NaN));
    }
  }
});

// ---------------------------------------------------------------- the summaries

test("sentFromView: exactly ref, plan, dueNowFils, deadline, emailSent; never the bank block", () => {
  for (const emailSent of [true, false, null]) {
    const s = sentFromView(view(), emailSent);
    assert.deepEqual(Object.keys(s).sort(), SUMMARY_KEYS);
    assert.deepEqual(s, { ref: REF, plan: "deposit", dueNowFils: DUE_NOW, deadline: DEADLINE, emailSent });
    assert.doesNotMatch(JSON.stringify(s), /GB82|Account name|Bank name|Bank address|Note line|TESTAEAAXXX/);
  }
  assert.equal(sentFromView(view({ deadline: "2026-11-03T08:00:00" }), true).deadline, null);
  assert.equal(sentFromView(view({ deadline: null }), true).deadline, null);
  assert.equal(sentFromView(view({ plan: "full" }), true).plan, "full");
});

test("sentFromRequest: the same keys with plan and dueNowFils null", () => {
  const answer = requestOutcome(200, sentBody({ firstTime: false, emailSent: false }));
  const s = sentFromRequest(answer);
  assert.deepEqual(Object.keys(s).sort(), SUMMARY_KEYS);
  assert.deepEqual(s, { ref: REF, plan: null, dueNowFils: null, deadline: DEADLINE, emailSent: false });
  assert.equal(sentFromRequest({ kind: "sent", ref: REF, deadline: "soon", firstTime: true, emailSent: true }).deadline, null);
  assert.equal(sentFromRequest(requestOutcome(200, sentBody({ deadline: null }))).deadline, null);
});

// ---------------------------------------------------------------- requestPhaseReducer

const SUMMARY = { ref: REF, plan: "deposit", dueNowFils: DUE_NOW, deadline: DEADLINE, emailSent: true };
const TOO_MANY = [{ code: "too_many_open" }];
const CLOSED = [{ code: "requests_closed" }];
const TAKEN = [{ code: "sold_out" }];

const PHASES = {
  idle: () => ({ kind: "idle" }),
  checking: () => ({ kind: "checking", failed: false }),
  checkingFailed: () => ({ kind: "checking", failed: true }),
  sending: () => ({ kind: "sending" }),
  refused: () => ({ kind: "refused", reasons: TOO_MANY }),
  closed: () => ({ kind: "closed", reasons: CLOSED }),
  retry: () => ({ kind: "retry" }),
  taken: () => ({ kind: "taken", reasons: TAKEN }),
  sent: () => ({ kind: "sent", summary: SUMMARY }),
  ended: () => ({ kind: "ended" }),
  elsewhere: () => ({ kind: "elsewhere", ref: REF }),
};

const ACTIONS = [
  { type: "send" },
  { type: "answer", result: { kind: "sent", summary: SUMMARY } },
  { type: "answer", result: { kind: "retry" } },
  { type: "answer", result: { kind: "ended" } },
  { type: "resume" },
  { type: "resumed", outcome: { kind: "held", holdExpiresAt: "2026-11-02T08:20:00+00:00" } },
  { type: "resumed", outcome: { kind: "retry" } },
  { type: "resumed", outcome: { kind: "sent", summary: { ...SUMMARY, emailSent: null } } },
];

test("INITIAL_REQUEST_PHASE is idle", () => {
  assert.deepEqual(INITIAL_REQUEST_PHASE, { kind: "idle" });
});

test("send: from idle, refused or retry -> sending; from any other phase the same state object", () => {
  for (const name of ["idle", "refused", "retry"]) {
    assert.deepEqual(requestPhaseReducer(PHASES[name](), { type: "send" }), { kind: "sending" }, name);
  }
  for (const name of ["checking", "checkingFailed", "sending", "closed", "taken", "sent", "ended", "elsewhere"]) {
    const s = PHASES[name]();
    assert.equal(requestPhaseReducer(s, { type: "send" }), s, name);
  }
});

test("a double send while sending changes nothing (one request in flight)", () => {
  const sending = requestPhaseReducer(INITIAL_REQUEST_PHASE, { type: "send" });
  assert.equal(requestPhaseReducer(sending, { type: "send" }), sending);
});

test("answer: applied only from sending, to that phase", () => {
  const rows = [
    [{ kind: "sent", summary: SUMMARY }, { kind: "sent", summary: SUMMARY }],
    [{ kind: "elsewhere", ref: REF }, { kind: "elsewhere", ref: REF }],
    [{ kind: "ended" }, { kind: "ended" }],
    [{ kind: "taken", reasons: TAKEN }, { kind: "taken", reasons: TAKEN }],
    [{ kind: "refused", reasons: TOO_MANY }, { kind: "refused", reasons: TOO_MANY }],
    [{ kind: "closed", reasons: CLOSED }, { kind: "closed", reasons: CLOSED }],
    [{ kind: "retry" }, { kind: "retry" }],
  ];
  for (const [result, want] of rows) assert.deepEqual(requestPhaseReducer(PHASES.sending(), { type: "answer", result }), want, result.kind);
  for (const name of ["idle", "checking", "checkingFailed", "refused", "retry", "closed", "taken", "sent", "ended", "elsewhere"]) {
    const s = PHASES[name]();
    assert.equal(requestPhaseReducer(s, { type: "answer", result: { kind: "sent", summary: SUMMARY } }), s, name);
  }
});

test("resume: from idle or a failed check -> checking { failed: false }; otherwise the same state object", () => {
  for (const name of ["idle", "checkingFailed"]) {
    assert.deepEqual(requestPhaseReducer(PHASES[name](), { type: "resume" }), { kind: "checking", failed: false }, name);
  }
  for (const name of ["checking", "sending", "refused", "retry", "closed", "taken", "sent", "ended", "elsewhere"]) {
    const s = PHASES[name]();
    assert.equal(requestPhaseReducer(s, { type: "resume" }), s, name);
  }
});

test("resumed: applied only from checking; held -> idle, retry -> a failed check, the others -> that phase", () => {
  const summary = { ...SUMMARY, emailSent: null };
  const rows = [
    [{ kind: "held", holdExpiresAt: "2026-11-02T08:20:00+00:00" }, { kind: "idle" }],
    [{ kind: "retry" }, { kind: "checking", failed: true }],
    [{ kind: "sent", summary }, { kind: "sent", summary }],
    [{ kind: "ended" }, { kind: "ended" }],
    [{ kind: "elsewhere", ref: REF }, { kind: "elsewhere", ref: REF }],
  ];
  for (const from of ["checking", "checkingFailed"]) {
    for (const [outcome, want] of rows) {
      assert.deepEqual(requestPhaseReducer(PHASES[from](), { type: "resumed", outcome }), want, `${from} ${outcome.kind}`);
    }
  }
  for (const name of ["idle", "sending", "refused", "retry", "closed", "taken", "sent", "ended", "elsewhere"]) {
    const s = PHASES[name]();
    assert.equal(requestPhaseReducer(s, { type: "resumed", outcome: { kind: "sent", summary } }), s, name);
  }
});

test("closed, taken, sent, ended and elsewhere are final: every action returns the same object", () => {
  for (const name of ["closed", "taken", "sent", "ended", "elsewhere"]) {
    const s = PHASES[name]();
    for (const action of ACTIONS) assert.equal(requestPhaseReducer(s, action), s, `${name} ${action.type}`);
  }
});

test("the paths: send -> retry -> send -> sent; resume -> failed -> Check again -> held -> send", () => {
  let s = INITIAL_REQUEST_PHASE;
  s = requestPhaseReducer(s, { type: "send" });
  s = requestPhaseReducer(s, { type: "answer", result: { kind: "retry" } });
  assert.deepEqual(s, { kind: "retry" });
  s = requestPhaseReducer(s, { type: "send" });
  assert.deepEqual(s, { kind: "sending" });
  s = requestPhaseReducer(s, { type: "answer", result: { kind: "sent", summary: SUMMARY } });
  assert.deepEqual(s, { kind: "sent", summary: SUMMARY });

  let r = INITIAL_REQUEST_PHASE;
  r = requestPhaseReducer(r, { type: "resume" });
  r = requestPhaseReducer(r, { type: "resumed", outcome: { kind: "retry" } });
  assert.deepEqual(r, { kind: "checking", failed: true });
  r = requestPhaseReducer(r, { type: "resume" });
  assert.deepEqual(r, { kind: "checking", failed: false });
  r = requestPhaseReducer(r, { type: "resumed", outcome: { kind: "held", holdExpiresAt: "2026-11-02T08:20:00+00:00" } });
  assert.deepEqual(r, { kind: "idle" });
  assert.deepEqual(requestPhaseReducer(r, { type: "send" }), { kind: "sending" });

  // too_many_open keeps the hold and Send on: a second send is allowed.
  const refusedPhase = requestPhaseReducer(PHASES.sending(), { type: "answer", result: { kind: "refused", reasons: TOO_MANY } });
  assert.deepEqual(requestPhaseReducer(refusedPhase, { type: "send" }), { kind: "sending" });
});

// ---------------------------------------------------------------- holdEndNow

test("holdEndNow: false only while sending", () => {
  for (const [name, make] of Object.entries(PHASES)) assert.equal(holdEndNow(make()), name !== "sending", name);
});

// ---------------------------------------------------------------- source rules

test("after-request.ts is pure: type imports from ./types, isBookingRef the only runtime import; no money arithmetic", () => {
  const src = readFileSync("lib/booking/after-request.ts", "utf8");
  const imports = src.match(/^import .*$/gm) ?? [];
  assert.deepEqual(imports.sort(), ['import type { BookingReason, BookingStatus, BookingView } from "./types";', 'import { isBookingRef } from "./ref";'].sort());
  assert.doesNotMatch(src, /\bfetch\(|sessionStorage|localStorage|\bwindow\b|\bdocument\.|from "react"|useState|useReducer/);
  assert.doesNotMatch(src, /\* ?100|\/ ?100|toFixed|Math\.round|Fils *[-+*/] *[A-Za-z0-9(]/);
  assert.doesNotMatch(src, /Intl\.DateTimeFormat|dubaiDateTime/);
});

test("after-request.ts and request-client.ts: no card words, no bank field names, no storage, no re_ or eyJ", () => {
  for (const file of ["lib/booking/after-request.ts", "lib/booking/request-client.ts"]) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /stripe|clientSecret|session_id|payment ?element|\/api\/booking\/pay|iban|swift|accountName|bankName/i, file);
    assert.doesNotMatch(src, /sessionStorage|localStorage/, file);
    assert.doesNotMatch(src, /re_|eyJ/, file);
  }
});

test("request-client.ts: postJson to the two paths with the 20 s timeout, no Origin of its own", () => {
  assert.equal(REQUEST_TIMEOUT_MS, 20000);
  const src = readFileSync("lib/booking/request-client.ts", "utf8");
  assert.match(src, /"\/api\/booking\/request"/);
  assert.match(src, /"\/api\/booking\/view"/);
  assert.match(src, /from "\.\/client"/);
  assert.equal((src.match(/timeoutMs: REQUEST_TIMEOUT_MS/g) ?? []).length, 2);
  assert.doesNotMatch(src, /\bfetch\(/);
  assert.doesNotMatch(src, /["']?origin["']?\s*:/i);
});

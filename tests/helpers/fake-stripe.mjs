// A fake of the few Stripe API calls the booking routes make (plan 04-04), for tests that run the real route handlers
// against the local database. It replaces `globalThis.fetch` for https://api.stripe.com only; every other host (the local
// Supabase stack) goes through the real fetch. No key, no network, nothing leaves the machine. stripe-node is built with
// the fetch HTTP client and reads `globalThis.fetch` when each client is made, so installing this before a route runs is
// enough.
//
// What it speaks: create a Checkout Session (idempotent per Idempotency-Key, like Stripe), expire one, retrieve one,
// retrieve a PaymentIntent with its latest charge expanded, list refunds (none). `markPaid(sessionId)` makes the session
// complete and paid and gives it a payment intent and a Visa ending 4242.
export function installFakeStripe() {
  const real = globalThis.fetch;
  const sessions = new Map();
  const byKey = new Map();
  const log = [];
  let counter = 0;

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_fake" } });
  const stripeError = (status, code, message) => json({ error: { type: "invalid_request_error", code, message } }, status);

  const sessionJson = (s) => ({
    id: s.id,
    object: "checkout.session",
    status: s.status,
    payment_status: s.paid ? "paid" : "unpaid",
    client_secret: s.status === "open" ? `${s.id}_secret_fake` : null,
    amount_total: s.amount,
    currency: s.currency,
    metadata: s.metadata,
    payment_intent: s.paid ? s.intent : null,
    expires_at: s.expiresAt,
    customer_email: s.email,
  });

  function parseForm(body) {
    const flat = {};
    for (const [key, value] of new URLSearchParams(typeof body === "string" ? body : "").entries()) flat[key] = value;
    return flat;
  }

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "api.stripe.com") return real(input, init);
    const method = (init.method ?? "GET").toUpperCase();
    // stripe-node hands fetch its headers as an array of pairs; a Headers object or a plain object are read the same way.
    const given = init.headers ?? {};
    const raw = Array.isArray(given) ? given : given instanceof Headers ? [...given.entries()] : Object.entries(given);
    const headers = Object.fromEntries(raw.map(([k, v]) => [k.toLowerCase(), String(v)]));
    const path = url.pathname;
    log.push({ method, path, idempotencyKey: headers["idempotency-key"] ?? null, form: method === "POST" ? parseForm(init.body) : null, query: Object.fromEntries(url.searchParams) });

    if (method === "POST" && path === "/v1/checkout/sessions") {
      const key = headers["idempotency-key"];
      if (key && byKey.has(key)) return json(sessionJson(sessions.get(byKey.get(key))));
      const form = parseForm(init.body);
      counter += 1;
      const id = `cs_test_fake${String(counter).padStart(12, "0")}`;
      const metadata = {};
      for (const [k, v] of Object.entries(form)) {
        const m = /^metadata\[(\w+)\]$/.exec(k);
        if (m) metadata[m[1]] = v;
      }
      const s = {
        id,
        status: "open",
        paid: false,
        amount: Number(form["line_items[0][price_data][unit_amount]"]),
        currency: form.currency,
        metadata,
        intentAmount: form["payment_intent_data[metadata][amount_fils]"],
        intentMetadata: {
          booking_id: form["payment_intent_data[metadata][booking_id]"],
          payment_id: form["payment_intent_data[metadata][payment_id]"],
          amount_fils: form["payment_intent_data[metadata][amount_fils]"],
        },
        expiresAt: Number(form.expires_at),
        email: form.customer_email,
        intent: `pi_test_fake${String(counter).padStart(12, "0")}`,
        charge: `ch_test_fake${String(counter).padStart(12, "0")}`,
      };
      sessions.set(id, s);
      if (key) byKey.set(key, id);
      return json(sessionJson(s));
    }
    const expire = /^\/v1\/checkout\/sessions\/([\w]+)\/expire$/.exec(path);
    if (method === "POST" && expire) {
      const s = sessions.get(expire[1]);
      if (!s) return stripeError(404, "resource_missing", "No such checkout.session");
      if (s.status !== "open") return stripeError(400, undefined, "Only Checkout Sessions with a status of `open` can be expired.");
      s.status = "expired";
      return json(sessionJson(s));
    }
    const retrieve = /^\/v1\/checkout\/sessions\/([\w]+)$/.exec(path);
    if (method === "GET" && retrieve) {
      const s = sessions.get(retrieve[1]);
      return s ? json(sessionJson(s)) : stripeError(404, "resource_missing", "No such checkout.session");
    }
    const intent = /^\/v1\/payment_intents\/([\w]+)$/.exec(path);
    if (method === "GET" && intent) {
      const s = [...sessions.values()].find((x) => x.intent === intent[1]);
      if (!s) return stripeError(404, "resource_missing", "No such payment_intent");
      return json({
        id: s.intent,
        object: "payment_intent",
        amount: s.amount,
        currency: s.currency,
        metadata: s.intentMetadata,
        latest_charge: { id: s.charge, object: "charge", payment_method_details: { type: "card", card: { brand: "visa", last4: "4242", wallet: null } } },
      });
    }
    if (method === "GET" && path === "/v1/refunds") return json({ object: "list", data: [], has_more: false, url: "/v1/refunds" });
    return stripeError(404, "resource_missing", `fake Stripe has no ${method} ${path}`);
  };

  return {
    log,
    sessions,
    /** The session as Stripe would send it in an event or an API answer. */
    object: (id) => sessionJson(sessions.get(id)),
    /** The guest paid: the session is complete and paid, with a payment intent and a card. */
    markPaid(id) {
      const s = sessions.get(id);
      s.paid = true;
      s.status = "complete";
      return { intent: s.intent, charge: s.charge };
    },
    calls: (op) => log.filter((c) => (op === "create" ? c.method === "POST" && c.path === "/v1/checkout/sessions" : op === "expire" ? c.path.endsWith("/expire") : true)),
    restore() {
      globalThis.fetch = real;
    },
  };
}

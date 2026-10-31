"use client";

// Plan 04-05 Task 1: the booking emails as the guest and the owner receive them, for the pictures. Each state renders
// the REAL renderer's html (lib/email/booking-guest-mail.ts, lib/email/booking-owner-mail.ts) with the copy of the
// harness language (BOOKING_EMAIL_COPY[locale]) and brand null (the design system) inside a sandboxed iframe (no
// scripts), at 100% width; its height follows the document once it has loaded (data-height). Above it the review line
// (subject, to, reply-to), as on the signed picture page. The states are the signed ones of pictures/04-05/index.html
// (owner, 2026-10-26) without the E-11 alternative: the owner chose English notices (E-11 = A), so
// `request-owner-in-language` and its Arabic owner drafts are gone; the owner states draw the English notice of a
// booking made in the harness language. Fixture values only (E-06). Not in tests/journey/matrix.ts (no baselines).

import { useState } from "react";
import { BOOKING_EMAIL_COPY } from "../../../lib/copy/booking-email";
import { INQUIRY_ADDRESS } from "../../../lib/contact-inquiry";
import {
  renderPaymentReceiptEmail,
  renderRefundReceiptEmail,
  renderRequestLapsedEmail,
  renderRequestReceivedEmail,
} from "../../../lib/email/booking-guest-mail";
import {
  renderPaymentOwnerEmail,
  renderRequestOwnerEmail,
  renderWithdrawnOwnerEmail,
} from "../../../lib/email/booking-owner-mail";
import type { RenderedEmail } from "../../../lib/email/shell";
import type { PaymentMailJob, RefundMailJob } from "../../../lib/booking/notify";
import {
  FILS,
  bookingUrlFixture,
  FIXTURE_BOOKING_ID,
  lapseJobFixture,
  paymentJobFixture,
  requestJobFixture,
  viewFixture,
  withdrawnJobFixture,
  type FixtureLocale,
} from "../../helpers/booking-view-fixtures";
import type { SceneContext, Scenes } from "../scene-types";

type Shown = { mail: RenderedEmail; to: string; replyTo: string };

function EmailFrame({ shown }: { shown: Shown }) {
  const [height, setHeight] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p data-email-meta dir="ltr" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
        <span>Subject: {shown.mail.subject}</span> · <span>To: {shown.to}</span> · <span>Reply-to: {shown.replyTo}</span>
      </p>
      <iframe
        data-email
        data-height={height ?? undefined}
        title={shown.mail.subject}
        srcDoc={shown.mail.html}
        sandbox="allow-same-origin"
        style={{ display: "block", width: "100%", border: 0, height: height ?? 800 }}
        onLoad={(event) => {
          const doc = event.currentTarget.contentDocument;
          if (doc) setHeight(Math.ceil(doc.documentElement.scrollHeight));
        }}
      />
    </div>
  );
}

const loc = (ctx: SceneContext): FixtureLocale => ctx.locale;
const guestCtx = (ctx: SceneContext) => ({ copy: BOOKING_EMAIL_COPY[loc(ctx)], brand: null });
const OWNER = { brand: null };

function guestPayment(job: PaymentMailJob, ctx: SceneContext): Shown {
  return { mail: renderPaymentReceiptEmail(job, guestCtx(ctx)), to: job.view.guest.email, replyTo: INQUIRY_ADDRESS };
}

function ownerPayment(job: PaymentMailJob): Shown {
  return { mail: renderPaymentOwnerEmail(job, OWNER), to: INQUIRY_ADDRESS, replyTo: job.view.guest.email };
}

/** E-31: the second payment on the same request gets its own receipt (received after the pay-by date, as drawn). */
function secondPartPayment(locale: FixtureLocale): PaymentMailJob {
  const job = structuredClone(paymentJobFixture("part", locale));
  const money = job.view.money;
  job.amountFils = FILS.extra;
  job.receivedOn = "2026-11-04";
  money.paidFils = FILS.part + FILS.extra;
  money.dueNowFils = FILS.deposit - money.paidFils;
  money.stillDueFils = FILS.grand - money.paidFils;
  if (job.view.transfer) job.view.transfer.amountFils = money.dueNowFils;
  job.view.payments = [
    { receivedOn: "2026-11-02", method: "bank_transfer", amountFils: FILS.part },
    { receivedOn: "2026-11-04", method: "bank_transfer", amountFils: FILS.extra },
  ];
  return job;
}

/** Plan 05-03: a refund email of a fully paid booking; symbolic fixture amount, no bank reference and no reason on it. */
function refundJob(locale: FixtureLocale, isTest: boolean): RefundMailJob {
  return {
    bookingId: FIXTURE_BOOKING_ID,
    refundId: 7,
    view: viewFixture("paid-full", locale),
    isTest,
    bookingUrl: bookingUrlFixture(locale),
    amountFils: FILS.extra,
    refundedOn: "2026-11-04",
  };
}

export const scenes: Scenes = {
  "request-received": (ctx) => {
    const job = requestJobFixture(loc(ctx), { plan: "deposit" });
    return <EmailFrame shown={{ mail: renderRequestReceivedEmail(job, guestCtx(ctx)), to: job.view.guest.email, replyTo: INQUIRY_ADDRESS }} />;
  },
  "request-received-test": (ctx) => {
    const job = requestJobFixture(loc(ctx), { plan: "full", isTest: true });
    return <EmailFrame shown={{ mail: renderRequestReceivedEmail(job, guestCtx(ctx)), to: job.view.guest.email, replyTo: INQUIRY_ADDRESS }} />;
  },
  "request-owner": (ctx) => {
    const job = requestJobFixture(loc(ctx));
    return <EmailFrame shown={{ mail: renderRequestOwnerEmail(job, OWNER), to: INQUIRY_ADDRESS, replyTo: job.view.guest.email }} />;
  },
  "receipt-part": (ctx) => <EmailFrame shown={guestPayment(paymentJobFixture("part", loc(ctx)), ctx)} />,
  "receipt-part-2": (ctx) => <EmailFrame shown={guestPayment(secondPartPayment(loc(ctx)), ctx)} />,
  "receipt-deposit": (ctx) => <EmailFrame shown={guestPayment(paymentJobFixture("deposit", loc(ctx)), ctx)} />,
  "receipt-full": (ctx) => <EmailFrame shown={guestPayment(paymentJobFixture("full", loc(ctx)), ctx)} />,
  "receipt-written-off": (ctx) => <EmailFrame shown={guestPayment(paymentJobFixture("written-off", loc(ctx)), ctx)} />,
  "receipt-overpaid": (ctx) => <EmailFrame shown={guestPayment(paymentJobFixture("overpaid", loc(ctx)), ctx)} />,
  "receipt-after-expiry": (ctx) => <EmailFrame shown={guestPayment(paymentJobFixture("after-expiry", loc(ctx)), ctx)} />,
  "receipt-no-link": (ctx) => <EmailFrame shown={guestPayment({ ...paymentJobFixture("part", loc(ctx)), bookingUrl: null }, ctx)} />,
  "refund-receipt": (ctx) => {
    const job = refundJob(loc(ctx), false);
    return <EmailFrame shown={{ mail: renderRefundReceiptEmail(job, guestCtx(ctx)), to: job.view.guest.email, replyTo: INQUIRY_ADDRESS }} />;
  },
  "refund-receipt-test": (ctx) => {
    const job = refundJob(loc(ctx), true);
    return <EmailFrame shown={{ mail: renderRefundReceiptEmail(job, guestCtx(ctx)), to: job.view.guest.email, replyTo: INQUIRY_ADDRESS }} />;
  },
  "request-lapsed": (ctx) => {
    const job = lapseJobFixture(loc(ctx));
    return <EmailFrame shown={{ mail: renderRequestLapsedEmail(job, guestCtx(ctx)), to: job.email, replyTo: INQUIRY_ADDRESS }} />;
  },
  "payment-owner": (ctx) => <EmailFrame shown={ownerPayment(paymentJobFixture("after-expiry", loc(ctx)))} />,
  "payment-owner-deadline": (ctx) => (
    <EmailFrame shown={ownerPayment({ ...paymentJobFixture("part", loc(ctx)), attentionReason: "deadline_passed_part_paid" })} />
  ),
  "withdrawn-owner": (ctx) => {
    const job = withdrawnJobFixture(loc(ctx), { isTest: false });
    return <EmailFrame shown={{ mail: renderWithdrawnOwnerEmail(job, OWNER), to: INQUIRY_ADDRESS, replyTo: job.view.guest.email }} />;
  },
};

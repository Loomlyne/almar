// Plan 04-05 Task 4: the booking notifier behind 04-08's seam (lib/booking/notify.ts BookingNotifier, six methods).
//
// createBookingNotifier is pure: it takes the sender, the brand reader and the six renderers with the guest copy, so
// the node tests run it on fakes and nothing reaches the network. liveBookingNotifier wires the real ones: Resend with
// this Worker's key (lib/email/send.ts) and the saved brand read at send time (E-13). It imports only TYPES from
// lib/booking/notify.ts, so notify.ts can import this file without a cycle.
//
// Every method resolves and none rejects: a job without a view answers `no_view` (cross-plan decision 5), a bad key
// `bad_key`, a recipient that is not one plain address `bad_address`, a renderer refusal `bad_reference`, `bad_link` or
// `no_transfer`, anything else `threw`; none of them sends. The idempotency key reaches the sender unchanged (deliverMail
// writes the same key as `detail.key`, cross-plan decision 1). No error value carries an address, a payload or a key.
// Guest mails go to the booking's own address with inquiries@ as reply-to; owner notices go to inquiries@ with the guest
// as reply-to (only when the guest's address is one plain address) and carry no bank value and no guest link (E-03).

import type { EmailBrand } from "./magic-link";
import type { BookingNotifier, LapseMailJob, MailOptions, MailOutcome, PaymentMailJob, RequestMailJob } from "../booking/notify";
import { INQUIRY_ADDRESS } from "../contact-inquiry";
import { isPlainEmail } from "../email-address";
import { isLocale, type Locale } from "../locale-path";
import { emailBrand, readSiteSettings, siteSettingsEnv } from "../site-settings-read";
import { resendApiKey, sendWithResend, type OutgoingMail } from "./send";
import { BOOKING_EMAIL_COPY, type BookingEmailCopy } from "../copy/booking-email";
import { renderPaymentReceiptEmail, renderRequestLapsedEmail, renderRequestReceivedEmail } from "./booking-guest-mail";
import { renderPaymentOwnerEmail, renderRequestOwnerEmail, renderWithdrawnOwnerEmail } from "./booking-owner-mail";

/** What every renderer answers (lib/email/booking-guest-mail.ts and booking-owner-mail.ts, 04-05 Task 1). */
export type RenderedMail = { subject: string; html: string; text: string };

/** The guest renderers' context: the booking's language copy (BOOKING_EMAIL_COPY[locale]) and the saved brand or null. */
export type GuestMailContext<C> = { copy: C; brand: EmailBrand | null };

/** The owner renderers' context as the notifier passes it: English only (E-11 = A, signed 2026-10-26), so only the brand. */
export type OwnerMailContext = { brand: EmailBrand | null };

/**
 * The six renderers by the names Task 1 exports, and the guest copy table they read (BOOKING_MAIL below; fakes in the
 * node tests).
 */
export type BookingMailRenderers<C> = {
  guestCopy: Record<Locale, C>;
  renderRequestReceivedEmail(job: RequestMailJob, ctx: GuestMailContext<C>): RenderedMail;
  renderPaymentReceiptEmail(job: PaymentMailJob, ctx: GuestMailContext<C>): RenderedMail;
  renderRequestLapsedEmail(job: LapseMailJob, ctx: GuestMailContext<C>): RenderedMail;
  renderRequestOwnerEmail(job: RequestMailJob, ctx: OwnerMailContext): RenderedMail;
  renderPaymentOwnerEmail(job: PaymentMailJob, ctx: OwnerMailContext): RenderedMail;
  renderWithdrawnOwnerEmail(job: RequestMailJob, ctx: OwnerMailContext): RenderedMail;
};

export type BookingNotifierDeps<C> = {
  /** One send with the idempotency key unchanged; lib/email/send.ts sendWithResend in production. */
  send: (mail: OutgoingMail, idempotencyKey: string) => Promise<MailOutcome>;
  /** The saved brand; a throw, a rejection or null means the design system (E-13). */
  brand: () => Promise<EmailBrand | null> | EmailBrand | null;
  mail: BookingMailRenderers<C>;
};

/** The keys mailKey writes (04-08) plus the dashboard's resend key `resend/<bookingId>/<requestId>` (04-09). */
const MAIL_KEY = /^(request|request-owner|receipt|payment-owner|lapse|resend|withdrawn-owner)\/[A-Za-z0-9-]{1,80}(\/[A-Za-z0-9-]{1,80})?$/;
const ERROR_NAME = /^[a-z0-9_]{1,60}$/;

/** The renderers' refusals (Task 1: `email: bad reference`, `email: bad link`, `email: no transfer`) as error names. */
const REFUSALS: Record<string, string> = {
  "email: bad reference": "bad_reference",
  "email: bad link": "bad_link",
  "email: no transfer": "no_transfer",
};

function hasView(job: unknown): boolean {
  if (typeof job !== "object" || job === null) return false;
  const view = (job as { view?: unknown }).view;
  return typeof view === "object" && view !== null;
}

function localeOf(value: unknown): Locale {
  return isLocale(value) ? value : "en";
}

function plainAddress(value: unknown): string | null {
  return typeof value === "string" && isPlainEmail(value) ? value : null;
}

/** How long the saved-brand read may take; a slower read renders with the design system (the mail never waits on it). */
export const BRAND_TIMEOUT_MS = 2_000;

async function readBrand(brand: BookingNotifierDeps<unknown>["brand"], timeoutMs: number = BRAND_TIMEOUT_MS): Promise<EmailBrand | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return (await Promise.race([Promise.resolve().then(brand), late])) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Renders with the saved brand; a saved brand the shell refuses (`email brand: …`, as lib/email/magic-link.ts refuses
 * one) is rendered again with the design system, so a bad saved colour never stops a booking mail.
 */
function render(draw: (brand: EmailBrand | null) => RenderedMail, brand: EmailBrand | null): RenderedMail {
  try {
    return draw(brand);
  } catch (error) {
    if (brand !== null && error instanceof Error && error.message.startsWith("email brand:")) return draw(null);
    throw error;
  }
}

function refusalName(error: unknown): string {
  if (error instanceof Error && Object.hasOwn(REFUSALS, error.message)) return REFUSALS[error.message];
  return "threw";
}

function outcomeOf(answer: unknown): MailOutcome {
  if (typeof answer === "object" && answer !== null && (answer as { ok?: unknown }).ok === true) return { ok: true };
  const error = typeof answer === "object" && answer !== null ? (answer as { error?: unknown }).error : undefined;
  return { ok: false, error: typeof error === "string" && ERROR_NAME.test(error) ? error : "send_error" };
}

/** A notifier over the given sender, brand and renderers. Ready by construction; liveBookingNotifier decides `ready`. */
export function createBookingNotifier<C>(deps: BookingNotifierDeps<C>): BookingNotifier {
  const { mail } = deps;

  /**
   * One mail: the view check (when the job needs one), the key check, the recipient check, the brand, the renderer,
   * then one send with the key unchanged. Resolves on every path.
   */
  async function deliver(
    job: unknown,
    opts: MailOptions,
    needsView: boolean,
    address: () => { to: unknown; replyTo?: string },
    draw: (brand: EmailBrand | null) => RenderedMail,
  ): Promise<MailOutcome> {
    try {
      if (needsView ? !hasView(job) : typeof job !== "object" || job === null) return { ok: false, error: "no_view" };
      const key = opts?.idempotencyKey;
      if (typeof key !== "string" || !MAIL_KEY.test(key)) return { ok: false, error: "bad_key" };
      const { to, replyTo } = address();
      const recipient = plainAddress(to);
      if (recipient === null) return { ok: false, error: "bad_address" };
      const rendered = render(draw, await readBrand(deps.brand));
      const outgoing: OutgoingMail = {
        to: recipient,
        ...(replyTo === undefined ? {} : { replyTo }),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      };
      return outcomeOf(await deps.send(outgoing, key));
    } catch (error) {
      return { ok: false, error: refusalName(error) };
    }
  }

  const guestCopy = (locale: unknown): C => mail.guestCopy[localeOf(locale)];
  /** The guest's address as the owner notice's reply-to, only when it is one plain address. */
  const guestReplyTo = (view: { guest?: { email?: unknown } }): { replyTo?: string } => {
    const address = plainAddress(view.guest?.email);
    return address === null ? {} : { replyTo: address };
  };

  return Object.freeze({
    ready: true,
    requestReceived: (job: RequestMailJob, opts: MailOptions) =>
      deliver(
        job,
        opts,
        true,
        () => ({ to: job.view.guest?.email, replyTo: INQUIRY_ADDRESS }),
        (brand) => mail.renderRequestReceivedEmail(job, { copy: guestCopy(job.view.locale), brand }),
      ),
    ownerRequest: (job: RequestMailJob, opts: MailOptions) =>
      deliver(
        job,
        opts,
        true,
        () => ({ to: INQUIRY_ADDRESS, ...guestReplyTo(job.view) }),
        (brand) => mail.renderRequestOwnerEmail(job, { brand }),
      ),
    paymentReceipt: (job: PaymentMailJob, opts: MailOptions) =>
      deliver(
        job,
        opts,
        true,
        () => ({ to: job.view.guest?.email, replyTo: INQUIRY_ADDRESS }),
        (brand) => mail.renderPaymentReceiptEmail(job, { copy: guestCopy(job.view.locale), brand }),
      ),
    ownerPayment: (job: PaymentMailJob, opts: MailOptions) =>
      deliver(
        job,
        opts,
        true,
        () => ({ to: INQUIRY_ADDRESS, ...guestReplyTo(job.view) }),
        (brand) => mail.renderPaymentOwnerEmail(job, { brand }),
      ),
    requestLapsed: (job: LapseMailJob, opts: MailOptions) =>
      deliver(
        job,
        opts,
        false,
        () => ({ to: job.email, replyTo: INQUIRY_ADDRESS }),
        (brand) => mail.renderRequestLapsedEmail(job, { copy: guestCopy(job.locale), brand }),
      ),
    ownerWithdrawn: (job: RequestMailJob, opts: MailOptions) =>
      deliver(
        job,
        opts,
        true,
        () => ({ to: INQUIRY_ADDRESS, ...guestReplyTo(job.view) }),
        (brand) => mail.renderWithdrawnOwnerEmail(job, { brand }),
      ),
    // 05-01 seam only: 05-03 replaces this line with its renderer (the wording is signed on the plan-gate pictures, P5-03).
    refundReceipt: async () => ({ ok: false, error: "not_ready" }),
  });
}

/**
 * The renderers this Worker sends with: the six signed templates (04-05 Task 1, owner signature 2026-10-26) and the
 * guest copy table they read. Owner notices are English (E-11 = A), so the owner renderers get the brand only.
 */
const BOOKING_MAIL: BookingMailRenderers<BookingEmailCopy> = {
  guestCopy: BOOKING_EMAIL_COPY,
  renderRequestReceivedEmail,
  renderPaymentReceiptEmail,
  renderRequestLapsedEmail,
  renderRequestOwnerEmail,
  renderPaymentOwnerEmail,
  renderWithdrawnOwnerEmail,
};

/** Wiring with an explicit key and renderers: null when either is missing (exported for the node tests). */
export function liveNotifierFrom<C>(apiKey: string | null, mail: BookingMailRenderers<C> | null): BookingNotifier | null {
  if (apiKey === null || mail === null) return null;
  return createBookingNotifier({
    send: (outgoing, key) => sendWithResend(apiKey, outgoing, key),
    brand: async () => emailBrand(await readSiteSettings(siteSettingsEnv())),
    mail,
  });
}

/**
 * The notifier of this Worker, decided on every call (the cron copies its Worker env into the environment first): null without
 * RESEND_API_KEY or without the renderers, else a ready notifier on Resend.
 */
export function liveBookingNotifier(): BookingNotifier | null {
  return liveNotifierFrom(resendApiKey(), BOOKING_MAIL);
}

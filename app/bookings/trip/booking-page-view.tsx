"use client";

// Plan 04-05, Task 2 (signed by the owner 2026-10-26, pictures/04-05/index.html, all states approved as drawn): the
// guest booking page /<locale>/bookings/trip, presentational. Props in, nothing fetched, nothing stored: the screen
// (booking-trip-screen.tsx) reads the view and drives the Withdraw control; the scenes pass fixtures. Every block is
// decided once by bookingPageModel (status words and the Pay-by sentence come from 04-03's
// JOURNEY_COPY[locale].bookingStatus, decision 6). Amounts, days, times, the reference and the IBAN read left to right
// inside <bdi dir="ltr">, in every language. Square corners, gold only as lines, the kit's buttons as they are; the
// Withdraw control is the secondary button (E-21), its confirm the kit's ConfirmDialog (E-22). Print (E-07): the nav,
// the footer, every button and the action links are hidden; the transfer block, the money rows and the contact text
// stay. Not built (signature): the canvas k89/k90 rows (the balanceLine sentence replaces them); the Back link shows on
// Confirmed and Completed only.

import { useEffect, useState, type ReactNode } from "react";
import { PublicFrame, SITE_CONTACT, type PublicFrameLink } from "../../../components/site/public-frame";
import { AlertCircleIcon } from "../../../components/icons/icons";
import { Button } from "../../../components/ui/button";
import { Chip } from "../../../components/ui/chip";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { Link } from "../../../components/ui/link";
import { ToastProvider, useToast } from "../../../components/ui/toast";
import { formatIban, normalizeIban } from "../../../lib/booking/bank";
import { guestsText, stayDaysText } from "../../../lib/booking/display-text";
import { formatBp, formatIsoDate, uaeDateTime } from "../../../lib/booking/trip-format";
import type { BookingView, StayAccess, TransferInstructions } from "../../../lib/booking/types";
import type { BookingPageCopy } from "../../../lib/copy/booking-page";
import type { SiteLegalChrome } from "../../../lib/data/types";
import { HOME_COPY } from "../../../lib/copy/home";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { SITE_FOOTER_COPY } from "../../../lib/copy/site-footer";
import { formatPlural } from "../../../lib/journey-format";
import { localePath, siteHref, type Locale } from "../../../lib/locale-path";
import { formatAed } from "../../../lib/money/format";
import { BOOKING_PAGE_PATH } from "./booking-page-meta";
import { bookingPageModel, type BookingPageModel, type WithdrawControl } from "./booking-page-model";

/** What the page shows: the view once read (with the time it was read), or one of the three other states. */
export type BookingPageState =
  | { kind: "loading" }
  | { kind: "ready"; view: BookingView; nowMs: number }
  | { kind: "not_found"; signIn: boolean }
  | { kind: "unavailable" };

const WHATSAPP_URL = "https://wa.me/971563883302";

const PAGE_LINKS = [
  { key: "destinations", path: "/destinations" },
  { key: "experiences", path: "/experiences" },
  { key: "about", path: "/about" },
  { key: "contact", path: "/contact" },
] as const;

// The frame (PublicFrame) has no print hook and is not edited here: this block, scoped to the page's wrapper, hides
// its nav and footer in print, with every button (E-07). Fixed text, no value of the booking.
const PRINT_CSS =
  "@media print{[data-booking-page] header,[data-booking-page] footer,[data-booking-page] button,[data-booking-page] [data-print-hidden]{display:none!important}}";

const H1 = "m-0 font-display text-heading font-normal text-balance text-teal";
const H2 = "m-0 font-display text-title font-normal text-teal";
const BLOCK = "flex flex-col gap-2 border border-line bg-surface p-4";
const LINE = "m-0 border-s border-ink ps-3 text-body text-ink";
const KICKER = "text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal";

/** Fills `{slot}`s with nodes (an amount, a day or a time in <bdi dir="ltr">); unknown slots stay as written. */
function fillNodes(template: string, values: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return key !== undefined && key in values ? <span key={i}>{values[key]}</span> : part;
  });
}

const Ltr = ({ children }: { children: ReactNode }) => <bdi dir="ltr">{children}</bdi>;
const Aed = ({ fils }: { fils: number }) => <Ltr>{formatAed(fils)}</Ltr>;

/** An image address the page may load: https, or a path on this site. Anything else draws the empty frame. */
function isSafeImageSrc(src: string): boolean {
  return src.startsWith("https://") || (src.startsWith("/") && !src.startsWith("//"));
}

export function BookingPageView({
  locale,
  copy,
  state,
  localeHrefs,
  isTest,
  onRetry,
  showBackLink,
  withdraw,
  legal,
}: {
  locale: Locale;
  copy: BookingPageCopy;
  state: BookingPageState;
  /** The page in each language with the booking's ref (and t); undefined = the frame's plain links. */
  localeHrefs?: Record<Locale, string>;
  /** E-04: the preview host's TEST banner. */
  isTest: boolean;
  /** The unavailable state's Try again. Optional so the static page's loading fallback passes no function. */
  onRetry?: () => void;
  /** A signed-in guest without a link token (the screen decides); drawn on Confirmed and Completed only. */
  showBackLink: boolean;
  /** Absent: no Withdraw section, no dialog and no notice (a control is drawn only where it is wired). */
  withdraw?: WithdrawControl;
  /** The footer's legal row (plan 06-04, signed 2026-10-30); absent or nothing published: none. */
  legal?: SiteLegalChrome;
}) {
  const nav = HOME_COPY[locale].nav;
  const links: PublicFrameLink[] = PAGE_LINKS.map(({ key, path }) => ({ label: nav[key], href: siteHref(locale, path) }));

  return (
    <div data-booking-page="" className="contents">
      <style>{PRINT_CSS}</style>
      <ToastProvider dismissLabel={copy.toastDismiss}>
        <PublicFrame
          locale={locale}
          currentPath={BOOKING_PAGE_PATH}
          localeHrefs={localeHrefs}
          links={links}
          footerLinks={links}
          footerCopy={SITE_FOOTER_COPY[locale]}
          labels={nav}
          currency={false}
          whatsapp={false}
          legal={legal}
        >
          <main id="content" className="mx-auto box-border flex w-full max-w-column flex-col gap-4 px-4 py-12 md:px-8 lg:px-16">
            {isTest ? (
              <p data-testid="test-banner" className="m-0 border border-ink bg-surface px-4 py-3 text-label text-ink">
                {copy.testBanner}
              </p>
            ) : null}
            {state.kind !== "loading" && withdraw ? <WithdrawNotice copy={copy} withdraw={withdraw} /> : null}
            <Body locale={locale} copy={copy} state={state} onRetry={onRetry} showBackLink={showBackLink} withdraw={withdraw} />
          </main>
        </PublicFrame>
      </ToastProvider>
    </div>
  );
}

function Body({
  locale,
  copy,
  state,
  onRetry,
  showBackLink,
  withdraw,
}: {
  locale: Locale;
  copy: BookingPageCopy;
  state: BookingPageState;
  onRetry?: () => void;
  showBackLink: boolean;
  withdraw?: WithdrawControl;
}) {
  if (state.kind === "loading") {
    return (
      <>
        <h1 className={H1}>{copy.heading}</h1>
        <p role="status" className="m-0 text-body text-ink">
          {copy.loading}
        </p>
        <noscript>
          <p className="m-0 text-body text-ink">{copy.noscript}</p>
        </noscript>
      </>
    );
  }
  if (state.kind === "not_found") {
    return (
      <>
        <h1 className={H1}>{copy.heading}</h1>
        <p className="m-0 text-body text-ink">{copy.notFound}</p>
        {state.signIn ? (
          <>
            <p className="m-0 text-body text-ink">{copy.notFoundSignIn}</p>
            <Link href={`${localePath(locale, "/login")}?return=bookings`} className="print:hidden" data-print-hidden="">
              {copy.logIn}
            </Link>
          </>
        ) : null}
      </>
    );
  }
  if (state.kind === "unavailable") {
    return (
      <>
        <h1 className={H1}>{copy.heading}</h1>
        <p role="alert" className="m-0 flex items-center gap-2 text-body text-ink">
          <AlertCircleIcon size={16} aria-hidden="true" className="shrink-0" />
          {copy.unavailable}
        </p>
        <Button variant="secondary" onClick={onRetry} className="print:hidden">
          {copy.tryAgain}
        </Button>
      </>
    );
  }
  return <Ready locale={locale} copy={copy} view={state.view} nowMs={state.nowMs} showBackLink={showBackLink} withdraw={withdraw} />;
}

function WithdrawNotice({ copy, withdraw }: { copy: BookingPageCopy; withdraw: WithdrawControl }) {
  const ui = withdraw.ui;
  if (ui.step !== "done" && ui.step !== "refused") return null;
  const kind = ui.step === "done" ? "done" : ui.reason;
  return (
    <div
      data-testid="withdraw-notice"
      data-kind={kind}
      role="status"
      tabIndex={-1}
      className="flex flex-col items-start gap-2 border border-teal p-4"
    >
      {ui.step === "done" ? (
        <>
          <p className="m-0 text-body text-ink">{copy.withdrawDone}</p>
          <Link href={ui.stayPath} className="print:hidden" data-print-hidden="">
            {copy.withdrawStartAgain}
          </Link>
        </>
      ) : (
        <>
          <p className="m-0 text-body text-ink">
            {ui.reason === "part_paid" ? copy.withdrawRefusedPartPaid : copy.withdrawRefusedNotWithdrawable}
          </p>
          <ContactLine copy={copy} />
        </>
      )}
    </div>
  );
}

/** E-21, E-24, E-25, E-27: "To change or cancel this request, contact us:" with WhatsApp and inquiries@. */
function ContactLine({ copy }: { copy: BookingPageCopy }) {
  return (
    <p data-testid="contact-to-change" className="m-0 flex flex-wrap items-center gap-x-3 text-body text-ink">
      <span>{copy.contactToChange}</span>
      <span className="inline-flex flex-wrap items-center gap-x-4">
        <Link href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          {copy.contactWhatsapp}
        </Link>
        <Link href={`mailto:${SITE_CONTACT.email}`}>
          <Ltr>{SITE_CONTACT.email}</Ltr>
        </Link>
      </span>
    </p>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 break-words text-ink">{children}</dd>
    </>
  );
}

const DL = "m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-body";

function Ready({
  locale,
  copy,
  view,
  nowMs,
  showBackLink,
  withdraw,
}: {
  locale: Locale;
  copy: BookingPageCopy;
  view: BookingView;
  nowMs: number;
  showBackLink: boolean;
  withdraw?: WithdrawControl;
}) {
  const model = bookingPageModel(view, nowMs, locale);
  const status = JOURNEY_COPY[locale].bookingStatus;
  const step = withdraw?.ui.step ?? "idle";
  const refused = step === "refused";
  const backLink = showBackLink && (model.status === "confirmed" || model.status === "completed");
  const showWithdraw = withdraw !== undefined && model.canWithdraw && (step === "idle" || step === "confirm" || step === "failed");
  const dialogOpen = withdraw !== undefined && model.canWithdraw && (step === "confirm" || step === "failed");

  return (
    <>
      {backLink ? (
        <Link href={localePath(locale, "/bookings")} arrow={false} className="self-start print:hidden" data-print-hidden="">
          {`‹ ${copy.backToBookings}`}
        </Link>
      ) : null}
      <h1 className={H1}>{copy.heading}</h1>
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={KICKER}>{copy.reference}</span>
        <Ltr>{view.ref}</Ltr>
        <span data-testid="booking-status">
          <Chip interactive={false}>{status[view.status]}</Chip>
        </span>
      </p>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 md:col-span-2">
          <dl className={DL}>
            <Row label={copy.dates}>
              <span>
                <Ltr>{stayDaysText(view.arrive, view.leave)}</Ltr>
                {" · "}
                {formatPlural(copy.nightsCount, view.nights, locale)}
              </span>
            </Row>
            <Row label={copy.guests}>{guestsText({ adults: view.adults, children: view.children, infants: view.infants }, locale)}</Row>
          </dl>

          {model.notSent ? (
            <div className={`${LINE} flex flex-col items-start gap-2`}>
              <p className="m-0">{copy.notSent.line}</p>
              {view.holdExpiresAt ? <p className="m-0">{fillNodes(copy.notSent.heldUntil, uaeNodes(view.holdExpiresAt))}</p> : null}
              {model.finishPath ? (
                <Link href={model.finishPath} className="print:hidden" data-print-hidden="">
                  {copy.notSent.finish}
                </Link>
              ) : null}
            </div>
          ) : null}
          {model.status === "expired" ? (
            <div className={`${LINE} flex flex-col items-start gap-2`}>
              <p className="m-0">{copy.expired.line}</p>
              {model.startAgainPath ? (
                <Link href={model.startAgainPath} className="print:hidden" data-print-hidden="">
                  {copy.expired.startAgain}
                </Link>
              ) : null}
            </div>
          ) : null}
          {model.partReceived ? <p className={LINE}>{copy.flags.partReceived}</p> : null}
          {model.acceptedAsPaid ? <p className={LINE}>{copy.flags.acceptedAsPaid}</p> : null}
          {model.overpaid ? <p className={LINE}>{copy.flags.overpaid}</p> : null}
          {model.moneyOnClosed ? <p className={LINE}>{fillNodes(copy.flags.moneyOnClosed, { amount: <Aed fils={view.money.paidFils} /> })}</p> : null}
          {model.balanceLine ? (
            <p className={LINE}>
              {fillNodes(copy.money.balanceLine, {
                amount: <Aed fils={model.balanceLine.amountFils} />,
                date: <Ltr>{formatIsoDate(model.balanceLine.dueDate)}</Ltr>,
              })}
            </p>
          ) : null}
          {(model.partPaidContact || model.ownerMadeContact) && !refused ? <ContactLine copy={copy} /> : null}

          {model.transfer && view.transfer ? <TransferBlock locale={locale} copy={copy} view={view} model={model} transfer={view.transfer} /> : null}

          {showWithdraw && withdraw ? (
            <section data-testid="withdraw-section" className="flex flex-col items-start gap-2 border-t border-line pt-4">
              <p className="m-0 text-body text-ink">{copy.withdrawHint}</p>
              <Button variant="secondary" data-testid="withdraw" onClick={withdraw.onOpen} className="print:hidden">
                {copy.withdrawAction}
              </Button>
            </section>
          ) : null}

          {view.payments.length > 0 ? (
            <section className="flex flex-col gap-2 border-t border-line pt-4">
              <h2 className={H2}>{copy.payments.heading}</h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {view.payments.map((p, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-x-3 gap-y-1 border border-line bg-surface p-3 text-body text-ink">
                    <span>{p.receivedOn ? <Ltr>{formatIsoDate(p.receivedOn)}</Ltr> : copy.payments.dateNotRecorded}</span>
                    <span>{p.method === "bank_transfer" ? copy.payments.bankTransfer : copy.payments.other}</span>
                    <strong>
                      <Aed fils={p.amountFils} />
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-2 border-t border-line pt-4">
            <h2 className={H2}>{copy.travellers.heading}</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {view.travellers.map((t, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-body text-ink">
                  <span>{t.fullName}</span>
                  <span className="text-muted">
                    {t.kind === "adult"
                      ? copy.travellers.adult
                      : fillNodes(t.kind === "child" ? copy.travellers.child : copy.travellers.infant, { age: <Ltr>{t.age ?? ""}</Ltr> })}
                    {t.isBooker ? ` · ${copy.travellers.booker}` : null}
                    {t.notStaying ? ` · ${copy.travellers.notStaying}` : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {view.lines.length > 0 ? (
            <section className="flex flex-col gap-2 border-t border-line pt-4">
              <h2 className={H2}>{copy.addons.heading}</h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {view.lines.map((l, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-body text-ink">
                    <span>{fillNodes(copy.addons.line, { name: l.name, quantity: <Ltr>{l.quantity}</Ltr> })}</span>
                    <strong>
                      <Aed fils={l.lineFils} />
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {view.airport ? (
            <section className="flex flex-col gap-2 border-t border-line pt-4">
              <h2 className={H2}>{copy.airport.heading}</h2>
              <p className="m-0 text-body text-ink">{copy.airport.names[view.airport]}</p>
              {view.pickupAddress ? (
                <p className="m-0 text-body text-muted">
                  {copy.airport.pickup}: {view.pickupAddress}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className={BLOCK}>
            <h2 className={H2}>{copy.stay}</h2>
            {view.stay.image && isSafeImageSrc(view.stay.image.src) ? (
              <img src={view.stay.image.src} alt={view.stay.image.alt} className="block aspect-video w-full border border-line object-cover" />
            ) : (
              <div aria-hidden="true" className="aspect-video w-full border border-line bg-ivory" />
            )}
            <p className="m-0 flex flex-col text-body text-ink">
              <strong className="font-normal">{view.stay.title}</strong>
              <span className="text-muted">{view.stay.destinationName}</span>
            </p>
            {model.showAccess && view.access ? (
              <Access copy={copy} access={view.access} />
            ) : model.addressPending ? (
              <p className="m-0 text-body text-muted">{copy.addressPending}</p>
            ) : null}
          </section>

          <section className={BLOCK}>
            <h2 className={H2}>{copy.money.heading}</h2>
            <dl className={DL}>
              <Row label={copy.money.nights}>
                <Aed fils={view.money.nightsFils} />
              </Row>
              <Row label={copy.money.addons}>
                <Aed fils={view.money.addonsFils} />
              </Row>
              <Row label={copy.money.subtotal}>
                <Aed fils={view.money.subtotalFils} />
              </Row>
              <Row label={copy.money.vat.replace("[RATE]", formatBp(view.money.vatBp))}>
                <Aed fils={view.money.vatFils} />
              </Row>
              <Row label={<strong className="text-ink">{copy.money.total}</strong>}>
                <strong>
                  <Aed fils={view.money.grandFils} />
                </strong>
              </Row>
              <Row label={copy.money.plan}>{view.plan === "deposit" ? copy.money.planDeposit : copy.money.planFull}</Row>
              {view.plan === "deposit" ? (
                <Row label={copy.money.depositAmount}>
                  <Aed fils={view.money.depositFils} />
                </Row>
              ) : null}
              <Row label={copy.money.paid}>
                <Aed fils={view.money.paidFils} />
              </Row>
              <Row label={copy.money.stillDue}>{model.nothingMoreDue ? copy.money.nothingMoreDue : <Aed fils={view.money.stillDueFils} />}</Row>
            </dl>
          </section>

          <section className={BLOCK}>
            <h2 className={H2}>{copy.concierge.heading}</h2>
            <p className="m-0 text-body text-ink">{copy.concierge.line}</p>
            <p className="m-0 flex flex-wrap gap-x-4">
              <Link href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                {copy.concierge.whatsapp}
              </Link>
              <Link href={`mailto:${SITE_CONTACT.email}`}>{copy.concierge.email}</Link>
            </p>
          </section>
        </div>
      </div>

      {withdraw ? (
        <ConfirmDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) withdraw.onCancel();
          }}
          title={copy.withdrawConfirmTitle}
          description={
            <>
              <span>{copy.withdrawConfirmBody}</span>
              {step === "failed" ? (
                <>
                  {" "}
                  <span role="alert" data-testid="withdraw-failed" className="text-error">
                    {copy.withdrawFailed}
                  </span>
                </>
              ) : null}
            </>
          }
          confirmLabel={step === "failed" ? copy.withdrawRetry : copy.withdrawConfirmAction}
          cancelLabel={copy.withdrawKeep}
          onConfirm={withdraw.onConfirm}
        />
      ) : null}
    </>
  );
}

/** "Pay by {date}, {time} UAE time" and the other UAE-time sentences: both parts left to right. */
function uaeNodes(iso: string): { date: ReactNode; time: ReactNode } {
  const { date, time } = uaeDateTime(iso);
  return { date: <Ltr>{date}</Ltr>, time: <Ltr>{time}</Ltr> };
}

function TransferBlock({
  locale,
  copy,
  view,
  model,
  transfer,
}: {
  locale: Locale;
  copy: BookingPageCopy;
  view: BookingView;
  model: BookingPageModel;
  transfer: TransferInstructions;
}) {
  const block = model.transfer!;
  let when: ReactNode = null;
  if (model.partPaidLate && view.deadline) {
    // E-28: the Pay-by sentence gives way to the late line; the rest of the block stays.
    when = (
      <p data-testid="deadline-passed" className="m-0 border border-ink p-3 text-body text-ink">
        {fillNodes(copy.partPaidLate, uaeNodes(view.deadline))}
      </p>
    );
  } else if (block.kind === "deadline" && block.payBy) {
    when = <p className="m-0 text-body text-ink">{fillNodes(JOURNEY_COPY[locale].bookingStatus.payBy, uaeNodes(block.payBy))}</p>;
  } else if (block.kind === "balance" && block.dueBy) {
    when = <p className="m-0 text-body text-ink">{fillNodes(copy.transfer.dueBy, { date: <Ltr>{formatIsoDate(block.dueBy)}</Ltr> })}</p>;
  }
  return (
    <section data-testid="transfer" className={BLOCK}>
      <h2 className={H2}>{copy.transfer.heading}</h2>
      <p className="m-0 text-body text-ink">
        {copy.transfer.amount}:{" "}
        <strong className="text-title">
          <Aed fils={block.amountFils} />
        </strong>
      </p>
      {when}
      <dl className={DL}>
        <Row label={copy.transfer.reference}>
          <Ltr>{transfer.reference}</Ltr>
          <CopyValue value={transfer.reference} label={copy.copyValue.copyReference} copy={copy} />
        </Row>
        <Row label={copy.transfer.accountName}>{transfer.accountName}</Row>
        <Row label={copy.transfer.bankName}>{transfer.bankName}</Row>
        <Row label={copy.transfer.iban}>
          <Ltr>{formatIban(transfer.iban)}</Ltr>
          <CopyValue value={normalizeIban(transfer.iban)} label={copy.copyValue.copyIban} copy={copy} />
        </Row>
        <Row label={copy.transfer.swift}>
          <Ltr>{transfer.swift}</Ltr>
        </Row>
        <Row label={copy.transfer.bankAddress}>{transfer.bankAddress}</Row>
        <Row label={copy.transfer.currency}>
          <Ltr>{transfer.currency}</Ltr>
        </Row>
        <Row label={copy.transfer.note}>{transfer.note}</Row>
      </dl>
      <p className="m-0 text-body text-ink">{fillNodes(copy.transfer.referenceLine, { ref: <Ltr>{transfer.reference}</Ltr> })}</p>
      <p className="m-0 text-body text-ink">{copy.transfer.fees}</p>
      <p className="m-0 text-body text-ink">{copy.transfer.reply}</p>
      <p className="m-0 text-body text-muted">{copy.transfer.alsoInEmail}</p>
    </section>
  );
}

function Access({ copy, access }: { copy: BookingPageCopy; access: StayAccess }) {
  const rows: [string, string | null][] = [
    [copy.arrival.address, access.address],
    [copy.arrival.wifiName, access.wifiName],
    [copy.arrival.wifiPassword, access.wifiPassword],
    [copy.arrival.doorCode, access.doorCode],
    [copy.arrival.notes, access.notes],
  ];
  return (
    <div data-testid="access" className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="m-0 font-display text-body font-normal text-teal">{copy.arrival.heading}</h3>
      <dl className={DL}>
        {rows
          .filter((row): row is [string, string] => row[1] !== null && row[1] !== "")
          .map(([label, value]) => (
            <Row key={label} label={label}>
              {value}
            </Row>
          ))}
      </dl>
    </div>
  );
}

/**
 * E-07: copies one value (the reference, or the IBAN without spaces). Renders nothing on the server and wherever the
 * clipboard is missing, so no visitor sees a control that cannot work; hidden in print. Needs the page's ToastProvider.
 */
function CopyValue({ value, label, copy }: { value: string; label: string; copy: BookingPageCopy }) {
  const { push } = useToast();
  const [canCopy, setCanCopy] = useState(false);
  useEffect(() => {
    setCanCopy(typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function");
  }, []);
  if (!canCopy) return null;
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      push(copy.copyValue.copied);
    } catch {
      push(copy.copyValue.failed, "warning");
    }
  }
  return (
    <Button variant="secondary" onClick={onCopy} className="print:hidden">
      {label}
    </Button>
  );
}

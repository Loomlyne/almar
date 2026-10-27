"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button, LinkButton } from "../ui/button";
import { Link } from "../ui/link";
import type { JourneyCopy } from "./types";

// Plan 04-06 (signed 2026-10-27, pictures/04-06/index.html): the trip page after Send request and after a refresh.
// RequestSent hands the guest to the booking page (the reference, the plan with its amount due now, the deadline, the
// email line, the booking page button and the WhatsApp help); RequestElsewhere is a booking that moved on; RequestChecking
// is the server check after a refresh; RequestRetryNote is the one line under the step on a retry. Display strings and
// callbacks in: nothing fetched or stored here, no amount computed, no bank detail and no Pay button (P6-02, P6-13).

export type RequestSentProps = {
  /** "ALMAR-XXXXXX". */
  reference: string;
  /** "Deposit" or "Full payment"; with `amountText`, else the line says the amount is on the booking page. */
  planLabel: string | null;
  /** The booking's own amount due now ("AED 1,050.00"). */
  amountText: string | null;
  /** The pay-by line, built by the screen (bookingStatus.payBy with its date and time kept left to right). */
  deadlineText: ReactNode | null;
  /** "sent": the bank details were emailed; "page": they are on the booking page. */
  emailLine: "sent" | "page";
  /** The booking page (same tab). */
  bookingHref: string;
  /** The WhatsApp chat (new tab). */
  helpHref: string;
  copy: JourneyCopy;
};

const BAND = "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 bg-teal-tint px-6 py-4 text-teal";
const BAND_HEADING = "m-0 font-display text-title";
const BOX = "flex flex-col gap-3 border border-line bg-surface p-4";

function ReferenceBox({ reference, copy, hint }: { reference: string; copy: JourneyCopy; hint: boolean }) {
  const a = copy.afterRequest;
  return (
    <div className={BOX}>
      <p className="m-0 text-caption text-muted">{a.referenceLabel}</p>
      <p className="m-0 font-display text-title text-teal">
        <bdi dir="ltr">{reference}</bdi>
      </p>
      {hint ? <p className="m-0 text-label text-muted">{a.referenceHint}</p> : null}
    </div>
  );
}

/** Focus the heading once, when the state appears (the inquiry form's sent line does the same). */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

export function RequestSent({ reference, planLabel, amountText, deadlineText, emailLine, bookingHref, helpHref, copy }: RequestSentProps) {
  const a = copy.afterRequest;
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <section className="flex flex-col gap-6" aria-labelledby="trip-request-sent">
      <div className={BAND}>
        <h2 id="trip-request-sent" ref={heading} tabIndex={-1} className={BAND_HEADING}>
          {a.heading}
        </h2>
      </div>
      <p className="m-0 text-body text-ink">{a.lead}</p>
      <ReferenceBox reference={reference} copy={copy} hint />
      <div className="flex flex-col gap-3">
        <p className="m-0 text-body text-ink">
          {planLabel && amountText ? (
            <>
              {planLabel} · {a.dueNow} <bdi dir="ltr">{amountText}</bdi>
            </>
          ) : (
            a.amountOnPage
          )}
        </p>
        {deadlineText ? <p className="m-0 text-body text-ink">{deadlineText}</p> : null}
        <p className="m-0 text-body text-ink">{emailLine === "sent" ? a.emailSent : a.emailPage}</p>
        <p className="m-0 text-label text-muted">{a.lapse}</p>
      </div>
      <div>
        <LinkButton href={bookingHref}>{a.open}</LinkButton>
      </div>
      <div className="flex flex-col gap-1">
        <p className="m-0 text-label text-ink">{a.help}</p>
        <p className="m-0 text-label">
          <Link href={helpHref} target="_blank" rel="noopener noreferrer" className="min-h-8">
            {copy.reasons.actions.whatsapp}
          </Link>
        </p>
      </div>
    </section>
  );
}

export type RequestElsewhereProps = {
  reference: string;
  bookingHref: string;
  copy: JourneyCopy;
};

export function RequestElsewhere({ reference, bookingHref, copy }: RequestElsewhereProps) {
  const a = copy.afterRequest;
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <section className="flex flex-col gap-6" aria-labelledby="trip-request-elsewhere">
      <div className={BAND}>
        <h2 id="trip-request-elsewhere" ref={heading} tabIndex={-1} className={BAND_HEADING}>
          {a.elsewhereTitle}
        </h2>
      </div>
      <p className="m-0 text-body text-ink">{a.elsewhere}</p>
      <ReferenceBox reference={reference} copy={copy} hint={false} />
      <div>
        <LinkButton href={bookingHref}>{a.open}</LinkButton>
      </div>
    </section>
  );
}

export type RequestCheckingProps = {
  copy: JourneyCopy;
  /** The check could not be read: the reason (reasonsSlot) and Check again. */
  failed: boolean;
  onRetry: () => void;
  /** The screen passes BookingReasons with the unavailable reason. */
  reasonsSlot?: ReactNode;
};

export function RequestChecking({ copy, failed, onRetry, reasonsSlot }: RequestCheckingProps) {
  const a = copy.afterRequest;
  return (
    <section className="flex flex-col gap-6" aria-labelledby="trip-step-request">
      <h2 id="trip-step-request" className="m-0 font-display text-title text-teal">
        {copy.trip.stepTitle.request}
      </h2>
      <div className="flex flex-col items-start gap-4">
        {failed ? (
          <>
            <p className="m-0 text-label text-muted" aria-live="polite">
              {a.checking}
            </p>
            {reasonsSlot ? <div className="self-stretch">{reasonsSlot}</div> : null}
            <Button variant="secondary" onClick={onRetry}>
              {a.checkAgain}
            </Button>
          </>
        ) : (
          <p aria-live="polite" className="m-0 flex items-center gap-3 bg-teal-tint p-4 text-label text-teal">
            <span aria-hidden="true" className="size-4 shrink-0 border border-teal motion-safe:animate-spin" />
            <span>{a.checking}</span>
          </p>
        )}
      </div>
    </section>
  );
}

/** One line directly under the Request step on a retry ("Sending again is safe..."). */
export function RequestRetryNote({ text }: { text: string }) {
  return <p className="m-0 mt-4 text-body text-ink">{text}</p>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { formatPlural } from "../../lib/journey-format";
import { cn } from "../../lib/cn";
import { LinkButton } from "../ui/button";
import type { JourneyCopy, Locale } from "./types";

export type HoldTimerProps = {
  /** ISO time the server's hold ends (`holdExpiresAt`). The server's clock is the truth: this only displays it. */
  endsAt: string;
  /** Where "Start again" leads: the stay page in the guest's language. */
  restartHref: string;
  /** Called once when the clock reaches zero. */
  onEnd?: () => void;
  /** Injectable clock, in milliseconds, for the harness and tests. */
  getNow?: () => number;
  copy: JourneyCopy;
  locale: Locale;
  className?: string;
};

const SECOND = 1000;

function secondsLeft(endsAt: string, now: number): number {
  const end = Date.parse(endsAt);
  return Number.isNaN(end) ? 0 : Math.max(0, Math.ceil((end - now) / SECOND));
}

/** 1781 seconds as "29:41". Display only. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * "Your stay is held for mm:ss", ticking each second. The visible clock is not live (a screen reader would read every
 * second); a second, hidden region announces only at whole minutes. At zero it says the hold ended and offers to start
 * again from the stay (B-09).
 */
export function HoldTimer({ endsAt, restartHref, onEnd, getNow = Date.now, copy, locale, className }: HoldTimerProps) {
  const [left, setLeft] = useState(() => secondsLeft(endsAt, getNow()));
  const ended = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    ended.current = false;
    setLeft(secondsLeft(endsAt, getNow()));
    const id = window.setInterval(() => setLeft(secondsLeft(endsAt, getNow())), SECOND);
    return () => window.clearInterval(id);
  }, [endsAt, getNow]);

  useEffect(() => {
    if (left === 0 && !ended.current) {
      ended.current = true;
      onEndRef.current?.();
    }
  }, [left]);

  // The announcement changes only when the minute changes.
  const minutes = Math.ceil(left / 60);
  const [announced, setAnnounced] = useState(minutes);
  useEffect(() => {
    setAnnounced(minutes);
  }, [minutes]);

  const h = copy.hold;
  if (left === 0) {
    return (
      <div
        role="status"
        data-testid="hold-ended"
        className={cn("flex flex-col items-start gap-3 border border-error bg-surface p-4", className)}
      >
        <p className="m-0 text-body text-ink">{h.ended}</p>
        <LinkButton href={restartHref} variant="secondary">
          {h.restart}
        </LinkButton>
      </div>
    );
  }
  const [before, after] = h.timer.split("{time}");
  return (
    <div className={cn("flex flex-col gap-1 border border-teal bg-teal-tint px-4 py-3", className)} data-testid="hold-timer">
      <p className="m-0 text-body text-teal">
        {before}
        <span className="font-bold tabular-nums">
          <bdi dir="ltr">{clock(left)}</bdi>
        </span>
        {after}
      </p>
      <p className="sr-only" aria-live="polite">
        {announced > 0 ? formatPlural(h.minutes, announced, locale) : ""}
      </p>
    </div>
  );
}

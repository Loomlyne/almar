"use client";

import { useEffect, useRef, useState } from "react";
import { countdownParts, holdMsLeft, liveMinute } from "../../lib/booking/trip-format";
import { formatPlural } from "../../lib/journey-format";
import { cn } from "../../lib/cn";
import type { JourneyCopy, Locale } from "./types";

// Plan 04-03: the 30-minute hold's countdown. The visible line is a role="timer" (not announced every second); a
// separate hidden polite line speaks only at 10, 5 and 1 minutes and at the end. `onEnd` runs once, at 00:00.
// The clock is the only thing read here; the end time is the server's.

export type HoldTimerProps = {
  /** The server's holdExpiresAt (an instant with an offset). */
  endsAt: string;
  /**
   * The clock: the page passes the server's (the device clock plus the offset from the hold answer's serverNow); the
   * harness pictures pass a fixed time. The device clock alone only when absent.
   */
  now?: () => number;
  onEnd: () => void;
  copy: JourneyCopy;
  /** For the spoken line's plural ("1 minute", "دقيقة واحدة", "1 minuto"). */
  locale: Locale;
  className?: string;
};

const systemNow = () => Date.now();

export function HoldTimer({ endsAt, now = systemNow, onEnd, copy, locale, className }: HoldTimerProps) {
  const r = copy.request;
  const [left, setLeft] = useState(() => holdMsLeft(endsAt, now()));
  const [spoken, setSpoken] = useState("");
  const ended = useRef(false);
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    ended.current = false;
    let last: number | null = null;
    const tick = () => {
      const ms = holdMsLeft(endsAt, now());
      setLeft(ms);
      const minute = liveMinute(ms);
      if (minute !== null && minute !== last) {
        last = minute;
        setSpoken(minute === 0 ? r.announceEnd : formatPlural(r.announce, minute, locale));
      }
      if (ms === 0 && !ended.current) {
        ended.current = true;
        endRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, now, r.announce, r.announceEnd, locale]);

  const time = countdownParts(left).text;
  const [before, after] = r.heldFor.split("{time}");
  return (
    <>
      <span role="timer" className={cn("tabular-nums", className)}>
        {before}
        <bdi dir="ltr">{time}</bdi>
        {after ?? ""}
      </span>
      <span className="sr-only" aria-live="polite">
        {spoken}
      </span>
    </>
  );
}

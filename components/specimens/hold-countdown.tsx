"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./hold-countdown.module.css";

const START_SECONDS = 29 * 60 + 59;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function TickMarks() {
  return (
    <svg className={styles.ticks} aria-hidden="true" viewBox="0 0 160 160">
      {Array.from({ length: 12 }, (_, index) => {
        const major = index % 3 === 0;
        return (
          <rect
            key={index}
            x={79}
            y={8}
            width={2}
            height={major ? 12 : 7}
            fill="var(--color-charcoal)"
            transform={`rotate(${index * 30} 80 80)`}
          />
        );
      })}
    </svg>
  );
}

function Hand({
  angle,
  kind,
  ticking,
}: {
  angle: number;
  kind: "minute" | "second";
  ticking: boolean;
}) {
  const handStyle: CSSProperties = { transform: `rotate(${angle}deg)` };
  const className = ticking
    ? `${styles.hand} ${styles[kind]} ${styles.ticking}`
    : `${styles.hand} ${styles[kind]}`;

  return <span aria-hidden="true" className={className} style={handStyle} />;
}

export function HoldCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(START_SECONDS);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const finished = secondsLeft <= 0;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion !== false || finished) return;
    const id = window.setInterval(() => {
      setSecondsLeft((current) => (current <= 0 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [reduceMotion, finished]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const ticking = reduceMotion === false && !finished;
  // Unwrapped remaining time, so each second is a 6° backward tick.
  // Wrapping to 0–360 would spin the hand on every minute rollover.
  const secondAngle = secondsLeft * 6;
  const minuteAngle = secondsLeft * 0.1;

  return (
    <div className={styles.shell}>
      <div className={styles.dial} aria-hidden="true">
        <TickMarks />
        <Hand angle={minuteAngle} kind="minute" ticking={ticking} />
        <Hand angle={secondAngle} kind="second" ticking={ticking} />
        <span className={styles.hub} aria-hidden="true" />
      </div>
      <p className={`hold-clock ${styles.time}`} role="timer" aria-live="off">
        <span className={styles.hidden}>Time remaining </span>
        <span className={styles.slot}>{pad(minutes)}</span>
        <span className={styles.colon}>:</span>
        <span className={styles.slot}>{pad(seconds)}</span>
      </p>
    </div>
  );
}

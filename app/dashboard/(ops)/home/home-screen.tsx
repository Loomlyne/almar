"use client";

import { useEffect, useState } from "react";
import { DASHBOARD_COPY } from "../../../../lib/dashboard-copy";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";
import styles from "./home.module.css";

type DateRangeKey = "thisMonth" | "last30" | "custom";
type MetricSlotKey = "bookings" | "revenue" | "cost" | "outstanding" | "occupancy";

const METRIC_SLOTS: ReadonlyArray<{ key: MetricSlotKey; label: string }> = [
  { key: "bookings", label: "Bookings" },
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost" },
  { key: "outstanding", label: "Outstanding" },
  { key: "occupancy", label: "Occupancy" },
];

function readLocale(): DocumentLocale {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return isDocumentLocale(value) ? value : "en";
}

export function HomeScreen() {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [dateRange, setDateRange] = useState<DateRangeKey>("thisMonth");
  const copy = DASHBOARD_COPY[locale];

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  const dateOptions: ReadonlyArray<{ key: DateRangeKey; label: string }> = [
    { key: "thisMonth", label: copy.thisMonth },
    { key: "last30", label: copy.last30 },
    { key: "custom", label: copy.custom },
  ];

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{copy.rail.home}</h1>
      <div className={styles.dateControl} role="group" aria-label="Date range">
        {dateOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={styles.dateButton}
            aria-pressed={dateRange === option.key}
            onClick={() => setDateRange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        {METRIC_SLOTS.map((slot) => (
          <section
            key={slot.key}
            className={slot.key === "bookings" ? `${styles.slot} ${styles.slotPrimary}` : styles.slot}
            aria-label={slot.label}
          >
            <h2 className={styles.slotLabel}>{slot.label}</h2>
          </section>
        ))}
        <section className={styles.slot} aria-label="Reminders">
          <h2 className={styles.slotLabel}>Reminders</h2>
          <p className={styles.slotEmpty}>{copy.noRemindersYet}</p>
        </section>
        <section className={styles.slot} aria-label="Charts">
          <h2 className={styles.slotLabel}>Charts</h2>
        </section>
      </div>
    </div>
  );
}

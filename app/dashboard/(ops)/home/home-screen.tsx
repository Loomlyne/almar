"use client";

import { useEffect, useState } from "react";
import { cn } from "../../../../lib/cn";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";

type DateRangeKey = "thisMonth" | "last30" | "custom";
type MetricSlotKey = "bookings" | "revenue" | "cost" | "outstanding" | "occupancy";

const METRIC_SLOTS: ReadonlyArray<{ key: MetricSlotKey; label: string }> = [
  { key: "bookings", label: "Bookings" },
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost" },
  { key: "outstanding", label: "Outstanding" },
  { key: "occupancy", label: "Occupancy" },
];

const SLOT = "flex min-h-32 flex-col gap-1 rounded-none border bg-white p-4";

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
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.rail.home}</h1>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
        {dateOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className="inline-flex h-control min-w-11 cursor-pointer items-center justify-center rounded-none border border-line bg-white px-4 font-body text-label text-ink transition-colors duration-fast ease-standard hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal aria-pressed:border-teal aria-pressed:text-teal"
            aria-pressed={dateRange === option.key}
            onClick={() => setDateRange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">
        {METRIC_SLOTS.map((slot) => (
          <section
            key={slot.key}
            className={cn(SLOT, slot.key === "bookings" ? "border-teal" : "border-line")}
            aria-label={slot.label}
          >
            <h2
              className={cn(
                "m-0 font-display font-normal text-teal",
                slot.key === "bookings" ? "text-heading" : "text-label",
              )}
            >
              {slot.label}
            </h2>
          </section>
        ))}
        <section className={cn(SLOT, "border-line")} aria-label="Reminders">
          <h2 className="m-0 font-display text-label font-normal text-teal">Reminders</h2>
          <p className="m-0 text-pretty text-body text-ink">{copy.noRemindersYet}</p>
        </section>
        <section className={cn(SLOT, "border-line")} aria-label="Charts">
          <h2 className="m-0 font-display text-label font-normal text-teal">Charts</h2>
        </section>
      </div>
    </div>
  );
}

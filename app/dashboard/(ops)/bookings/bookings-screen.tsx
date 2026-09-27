"use client";

import { useEffect, useState } from "react";
import { Field } from "../../../../components/ui/field";
import { Sidebar } from "../../../../components/ui/sidebar";
import { DASHBOARD_COPY } from "../../../../lib/dashboard-copy";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";
import styles from "./bookings.module.css";

function readLocale(): DocumentLocale {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return isDocumentLocale(value) ? value : "en";
}

export function BookingsScreen() {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [open, setOpen] = useState(false);
  const copy = DASHBOARD_COPY[locale];

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{copy.rail.bookings}</h1>
      <div className={styles.empty}>
        <p className={styles.emptyText}>{copy.noBookingsYet}</p>
        <button type="button" className="hero-search-submit" onClick={() => setOpen(true)}>
          {copy.newBooking}
        </button>
      </div>
      <div className={styles.tableWrap}>
        <table className="ops-table">
          <thead>
            <tr>
              <th scope="col">Guest</th>
              <th scope="col">Destination</th>
              <th scope="col" className={styles.dates}>
                Dates
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody />
        </table>
      </div>
      <Sidebar open={open} onOpenChange={setOpen} title={copy.newBooking} closeLabel={copy.close}>
        <Field id="booking-guest" label="Guest" name="guest" />
        <Field id="booking-destination" label="Destination" name="destination" />
        <Field id="booking-dates" label="Dates" name="dates" placeholder="DD/MM/YYYY" />
        <Field id="booking-status" label="Status" name="status" />
      </Sidebar>
    </div>
  );
}

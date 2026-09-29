"use client";

import { useEffect, useState } from "react";
import { Field } from "../../../../components/ui/field";
import { Sidebar } from "../../../../components/ui/sidebar";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";
import styles from "./customers.module.css";

function readLocale(): DocumentLocale {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return isDocumentLocale(value) ? value : "en";
}

export function CustomersScreen() {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [open, setOpen] = useState(false);
  const copy = DASHBOARD_COPY[locale];

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{copy.rail.customers}</h1>
      <div className={styles.empty}>
        <p className={styles.emptyText}>{copy.noCustomersYet}</p>
        <button type="button" className="hero-search-submit" onClick={() => setOpen(true)}>
          {copy.newCustomer}
        </button>
      </div>
      <div className={styles.tableWrap}>
        <table className="ops-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Phone</th>
              <th scope="col" className={styles.count}>
                Bookings count
              </th>
            </tr>
          </thead>
          <tbody />
        </table>
      </div>
      <Sidebar open={open} onOpenChange={setOpen} title={copy.newCustomer} closeLabel={copy.close}>
        <Field id="customer-name" label="Name" name="name" />
        <Field id="customer-email" label="Email" name="email" type="email" />
        <Field id="customer-phone" label="Phone" name="phone" type="tel" />
      </Sidebar>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Field } from "../../../../components/ui/field";
import { Sidebar } from "../../../../components/ui/sidebar";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";

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
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.rail.customers}</h1>
      <div className="flex flex-col items-start gap-2">
        <p className="m-0 text-pretty text-body text-ink">{copy.noCustomersYet}</p>
        <Button onClick={() => setOpen(true)}>{copy.newCustomer}</Button>
      </div>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full border-collapse font-body">
          <thead>
            <tr className="h-row dense:h-row-dense border-b border-line">
              <th scope="col" className="px-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
                Name
              </th>
              <th scope="col" className="px-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
                Email
              </th>
              <th scope="col" className="px-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
                Phone
              </th>
              <th scope="col" className="px-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal tabular-nums">
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

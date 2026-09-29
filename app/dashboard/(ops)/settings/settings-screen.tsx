"use client";

import { useEffect, useState } from "react";
import { Field } from "../../../../components/ui/field";
import { Switch } from "../../../../components/ui/switch";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";
import type { FxRates } from "../../../../lib/fx/rates";

/** Read-only. These are the real tokens declared in app/globals.css, not a color picker. */
const COLOR_TOKENS = [
  { id: "teal", label: "Teal", value: "#1f3b40" },
  { id: "charcoal", label: "Charcoal", value: "#262626" },
  { id: "gold", label: "Gold", value: "#d4ba8a" },
  { id: "ivory", label: "Ivory", value: "#fffaf0" },
  { id: "white", label: "White", value: "#ffffff" },
  { id: "error", label: "Error", value: "#8f2d2d" },
  { id: "success", label: "Success", value: "#1e6b45" },
  { id: "warning", label: "Warning", value: "#8a3b12" },
  { id: "muted", label: "Muted", value: "#63615f" },
] as const;

function readLocale(): DocumentLocale {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return isDocumentLocale(value) ? value : "en";
}

function GroupTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="m-0 text-[length:var(--text-label)] font-normal leading-[1.4] text-[var(--color-heading)]"
    >
      {children}
    </h2>
  );
}

export function SettingsScreen({ rates }: { rates: FxRates | null }) {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [maintenance, setMaintenance] = useState(false);
  const copy = DASHBOARD_COPY[locale];

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  return (
    <div className="flex flex-col gap-[var(--spacing-lg)] min-w-0">
      <h1 className="m-0 font-[var(--font-display)] text-[length:var(--text-heading)] font-normal leading-[1.1] text-balance text-[var(--color-heading)]">
        {copy.rail.settings}
      </h1>

      <div className="flex flex-col gap-[var(--spacing-md)]">
        <section className="flex flex-col gap-[var(--spacing-sm)]" aria-labelledby="settings-brand">
          <GroupTitle id="settings-brand">Brand</GroupTitle>
          {COLOR_TOKENS.map((token) => (
            <Field
              key={token.id}
              id={`brand-color-${token.id}`}
              label={token.label}
              name={`brand-color-${token.id}`}
              value={token.value}
              readOnly
            />
          ))}
          <Field id="brand-logo" label="Logo" name="logo" placeholder="https://example.com/logo.svg" />
          <Field id="brand-favicon" label="Favicon" name="favicon" placeholder="https://example.com/favicon.svg" />
          <Field id="brand-title-face" label="Title face" name="title-face" value="Questa" readOnly />
          <Field id="brand-body-face" label="Body face" name="body-face" value="Lato" readOnly />
        </section>

        <section className="flex flex-col gap-[var(--spacing-sm)]" aria-labelledby="settings-money">
          <GroupTitle id="settings-money">Money</GroupTitle>
          <Field id="money-vat" label="VAT percent" name="vat-percent" type="number" inputMode="decimal" />
          <Field id="money-deposit" label="Deposit percent" name="deposit-percent" type="number" inputMode="decimal" />
          <div className="flex flex-col gap-[var(--spacing-xs)]">
            <span className="text-[length:var(--text-label)] leading-[1.4] text-[var(--color-fg)]">FX rate</span>
            {rates ? (
              <p className="m-0 tabular-nums text-[length:var(--text-body)] leading-[1.5] text-[var(--color-fg)]">
                <span>USD/AED {rates.aed}</span>
                <span className="ms-[var(--spacing-sm)]">USD/EUR {rates.eur}</span>
              </p>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-[var(--spacing-sm)]" aria-labelledby="settings-email">
          <GroupTitle id="settings-email">Email</GroupTitle>
          <Field id="email-templates" label="Templates" name="templates" />
          <Field id="email-reminders" label="Reminders" name="reminders" />
          <Field id="email-confirmation" label="Confirmation" name="confirmation" />
        </section>

        <section className="flex flex-col gap-[var(--spacing-sm)]" aria-labelledby="settings-maintenance">
          <GroupTitle id="settings-maintenance">Maintenance</GroupTitle>
          <Switch label="Maintenance" checked={maintenance} onCheckedChange={setMaintenance} />
        </section>
      </div>

      <div className="flex justify-start">
        <button type="button" className="hero-search-submit" onClick={() => undefined}>
          {copy.save}
        </button>
      </div>
    </div>
  );
}

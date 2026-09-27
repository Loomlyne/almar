"use client";

import { useState } from "react";
import { SiteNav, NavDrop } from "../../components/ui/nav";
import { Field } from "../../components/ui/field";
import { HOME_COPY } from "../../lib/home-copy";
import { setDocumentLocale, type DocumentLocale } from "../../lib/set-document-locale";

const LOCALE_COOKIE = "almar-locale";

const LOCALES = [
  { value: "en", label: "EN" },
  { value: "ar", label: "AR" },
  { value: "es", label: "ES" },
] as const;

const COPY = {
  en: { account: "Account", name: "Name", email: "Email", phone: "Phone", language: "Language" },
  ar: { account: "الحساب", name: "الاسم", email: "البريد الإلكتروني", phone: "الهاتف", language: "اللغة" },
  es: { account: "Cuenta", name: "Nombre", email: "Correo electrónico", phone: "Teléfono", language: "Idioma" },
} as const;

export function AccountScreen() {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const copy = COPY[locale];

  function chooseLocale(next: DocumentLocale) {
    setLocale(next);
    setDocumentLocale(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  return (
    <>
      <SiteNav
        locale={locale}
        onLocale={chooseLocale}
        labels={HOME_COPY[locale].nav}
        markCurrent={false}
      />
      <main
        id="content"
        style={{
          boxSizing: "border-box",
          maxInlineSize: "var(--width-column)",
          marginInline: "auto",
          paddingBlock: "var(--spacing-2xl)",
          paddingInline: "var(--spacing-lg)",
          display: "grid",
          gap: "var(--spacing-lg)",
          justifyItems: "start",
        }}
      >
        <h1>{copy.account}</h1>
        <div style={{ display: "grid", gap: "var(--spacing-md)", inlineSize: "100%", maxInlineSize: "24rem" }}>
          <Field id="account-name" label={copy.name} name="account-name" />
          <Field id="account-email" label={copy.email} name="account-email" type="email" />
          <Field id="account-phone" label={copy.phone} name="account-phone" type="tel" />
          <div className="field">
            <span className="field-label">{copy.language}</span>
            <NavDrop
              label={copy.language}
              value={locale}
              options={LOCALES}
              onChange={chooseLocale}
              className="nav-drop locale-switch"
            />
          </div>
        </div>
      </main>
    </>
  );
}

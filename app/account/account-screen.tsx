"use client";

import { useState } from "react";
import { SiteNav } from "../../components/ui/nav";
import { LocaleSelect } from "../../components/ui/locale-select";
import { Field } from "../../components/ui/field";
import { WhatsApp } from "../../components/ui/whatsapp";
import { HOME_COPY } from "../../lib/copy/home";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { setDocumentLocale, type DocumentLocale } from "../../lib/set-document-locale";

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
    document.cookie = `almar-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
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
        className="mx-auto grid w-full max-w-column justify-items-start gap-6 px-6 py-12 text-start"
      >
        <h1>{copy.account}</h1>
        <div className="grid w-full max-w-96 gap-4">
          <Field id="account-name" label={copy.name} name="account-name" />
          <Field id="account-email" label={copy.email} name="account-email" type="email" />
          <Field id="account-phone" label={copy.phone} name="account-phone" type="tel" />
          <div className="grid gap-2">
            <label className="text-label text-ink" htmlFor="account-language">
              {copy.language}
            </label>
            <LocaleSelect
              id="account-language"
              kind="language"
              value={locale}
              copy={JOURNEY_COPY[locale].locale}
              onChange={(next) => chooseLocale(next as DocumentLocale)}
            />
          </div>
        </div>
      </main>
      <WhatsApp />
    </>
  );
}

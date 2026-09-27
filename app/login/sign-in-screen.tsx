"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { SiteNav } from "../../components/ui/nav";
import { Field } from "../../components/ui/field";
import { HOME_COPY } from "../../lib/home-copy";
import { setDocumentLocale, type DocumentLocale } from "../../lib/set-document-locale";

const COPY = {
  en: {
    signIn: "Sign in",
    email: "Email",
    accessWithMagicLink: "Access with magic link",
    enterEmail: "Enter an email address.",
  },
  ar: {
    signIn: "تسجيل الدخول",
    email: "البريد الإلكتروني",
    accessWithMagicLink: "الدخول برابط سحري",
    enterEmail: "أدخل عنوان بريد إلكتروني.",
  },
  es: {
    signIn: "Iniciar sesión",
    email: "Correo electrónico",
    accessWithMagicLink: "Acceder con enlace mágico",
    enterEmail: "Ingresa una dirección de correo electrónico.",
  },
} as const;

export function SignInScreen() {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const copy = COPY[locale];
  const missingEmail = tried && !email.trim();

  function chooseLocale(next: DocumentLocale) {
    setLocale(next);
    setDocumentLocale(next);
  }

  function onEmailChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
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
        <h1>{copy.signIn}</h1>
        <form
          onSubmit={onSubmit}
          noValidate
          style={{ display: "grid", gap: "var(--spacing-md)", inlineSize: "100%", maxInlineSize: "24rem" }}
        >
          <Field
            id="sign-in-email"
            label={copy.email}
            name="sign-in-email"
            type="email"
            placeholder="name@example.com"
            required
            value={email}
            onChange={onEmailChange}
            error={missingEmail ? copy.enterEmail : undefined}
          />
          <button type="submit" className="hero-search-submit">
            {copy.accessWithMagicLink}
          </button>
        </form>
      </main>
    </>
  );
}

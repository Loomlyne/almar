"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { SiteNav } from "../../components/ui/nav";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { WhatsApp } from "../../components/ui/whatsapp";
import { HOME_COPY } from "../../lib/copy/home";
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
        className="mx-auto box-border grid w-full max-w-column justify-items-start gap-6 px-4 py-12 md:px-8 lg:px-16"
      >
        <h1 className="m-0 font-display text-display tracking-display text-teal">{copy.signIn}</h1>
        <form
          onSubmit={onSubmit}
          noValidate
          className="grid w-full max-w-96 gap-4"
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
          <Button type="submit" className="w-full md:w-max">
            {copy.accessWithMagicLink}
          </Button>
        </form>
      </main>
      <WhatsApp />
    </>
  );
}

"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { LocaleSelect } from "../../components/ui/locale-select";
import { WhatsApp } from "../../components/ui/whatsapp";
import { GUEST_COPY } from "../../lib/copy/guest";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { setDocumentLocale, type DocumentLocale } from "../../lib/set-document-locale";
import { requestSignIn, type SignInState } from "./actions";
import charcoalLogo from "../../brand/Logo Typography/Stacked_Charcoal.svg";
import whiteLogo from "../../brand/Logo Typography/Poly_White.svg";

const IMAGE = "/assets/img/caedcb84dd0d35bb.webp";

/** Canvas page 6, board 6a: one page for sign in and sign up, split screen from 1024px. */
export function SignInScreen({
  initialLocale,
  returnTo,
  expired,
}: {
  initialLocale: DocumentLocale;
  returnTo: string;
  expired: boolean;
}) {
  const [locale, setLocale] = useState<DocumentLocale>(initialLocale);
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const [state, setState] = useState<SignInState>({ status: "idle" });
  const [wait, setWait] = useState(0);
  const [pending, startTransition] = useTransition();
  const copy = GUEST_COPY[locale];
  const localeCopy = JOURNEY_COPY[locale].locale;

  useEffect(() => setDocumentLocale(locale), [locale]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  function send() {
    const form = new FormData();
    form.set("email", email);
    form.set("locale", locale);
    form.set("returnTo", returnTo);
    startTransition(async () => {
      const next = await requestSignIn(state, form);
      setState(next);
      if (next.status === "wait") setWait(next.seconds);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if (!email.trim()) return;
    send();
  }

  const sent = state.status === "sent" || (state.status === "wait" && state.email === email.trim().toLowerCase());
  const emailError =
    (tried && !email.trim()) || state.status === "invalid" ? copy.enterEmail : undefined;

  const brandLine = (
    <div className="grid gap-3">
      <span className="text-caption uppercase tracking-kicker text-ivory ar:normal-case ar:tracking-normal">
        ALMAR Private Journeys
      </span>
      <span className="font-display text-display tracking-display text-ivory">{copy.auth.tagline}</span>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-ivory lg:flex-row">
      <div className="relative h-80 shrink-0 overflow-hidden bg-teal md:h-96 lg:order-2 lg:m-4 lg:h-auto lg:flex-1">
        <img src={IMAGE} alt={copy.auth.imageAlt} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-ink/30" aria-hidden="true" />
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-4 md:inset-x-8 md:top-6 lg:hidden">
          <a href="/" className="inline-flex min-h-control items-center" aria-label="ALMAR Private Journeys home">
            <img src={whiteLogo.src} alt="ALMAR Private Journeys" className="block h-auto w-28 md:w-37.5" />
          </a>
          <LocaleSelect kind="language" value={locale} tone="on-image" copy={localeCopy} onChange={(next) => setLocale(next as DocumentLocale)} />
        </div>
        <div className="absolute inset-x-4 bottom-6 md:inset-x-8 md:bottom-8 lg:inset-x-12 lg:bottom-12">{brandLine}</div>
      </div>

      <main
        id="content"
        className="flex flex-1 flex-col justify-between gap-12 px-4 py-8 md:px-8 lg:order-1 lg:w-140 lg:flex-none lg:px-16"
      >
        <div className="hidden items-center justify-between gap-4 lg:flex">
          <a href="/" className="inline-flex min-h-control items-center" aria-label="ALMAR Private Journeys home">
            <img src={charcoalLogo.src} alt="ALMAR Private Journeys" className="block h-auto w-37.5" />
          </a>
          <LocaleSelect kind="language" value={locale} copy={localeCopy} onChange={(next) => setLocale(next as DocumentLocale)} />
        </div>

        {sent ? (
          <section className="grid w-full max-w-108 gap-6" aria-live="polite">
            <h1 className="m-0 font-display text-heading tracking-display text-teal">{copy.auth.checkEmail}</h1>
            <p className="m-0 text-body text-ink">
              {copy.auth.sentTo} <bdi>{"email" in state ? state.email : ""}</bdi>
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" busy={pending} disabled={wait > 0} onClick={send}>
                {copy.auth.sendAgain}
              </Button>
              {wait > 0 ? (
                <span className="text-label tabular-nums text-muted" aria-live="polite">
                  {copy.auth.waitSeconds.replace("{seconds}", String(wait))}
                </span>
              ) : null}
            </div>
            <Button
              variant="ghost"
              className="px-0"
              onClick={() => {
                setState({ status: "idle" });
                setTried(false);
              }}
            >
              {copy.auth.differentEmail}
            </Button>
          </section>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid w-full max-w-108 gap-6">
            <h1 className="m-0 font-display text-heading tracking-display text-teal">{copy.auth.heading}</h1>
            <p className="m-0 text-body text-muted">{copy.auth.lead}</p>
            {expired && state.status === "idle" ? (
              <p className="m-0 text-label text-error" role="status">
                {copy.auth.linkExpired}
              </p>
            ) : null}
            <Field
              id="sign-in-email"
              label={copy.email}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={emailError}
            />
            <Button type="submit" size="lg" busy={pending} className="w-full">
              {copy.accessWithMagicLink}
            </Button>
            {state.status === "unavailable" ? (
              <p className="m-0 text-label text-error" role="alert">
                {copy.auth.unavailable}
              </p>
            ) : null}
            <p className="m-0 border-t border-line pt-6 text-label text-ink">{copy.auth.newHere}</p>
          </form>
        )}

        <span className="text-caption text-muted">
          <bdi>inquiries@almarprivatejourney.com</bdi>
        </span>
      </main>
      <WhatsApp />
    </div>
  );
}

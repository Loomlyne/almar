"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { WhatsApp } from "../../components/ui/whatsapp";
import { GUEST_COPY } from "../../lib/copy/guest";
import { setDocumentLocale, type DocumentLocale } from "../../lib/set-document-locale";
import { requestSignIn, type SignInState } from "./actions";
import { AuthFrame } from "./auth-frame";

/**
 * Canvas page 6, board 6a: one page for sign in and sign up, split screen from 1024px.
 * variant "ops" (plan 02-04) is the same board on the ops host: heading Sign in, no "New here?"
 * line (that host never creates an account), no WhatsApp, and its own server action.
 */
export function SignInScreen({
  initialLocale,
  returnTo,
  expired,
  variant = "public",
  action = requestSignIn,
}: {
  initialLocale: DocumentLocale;
  returnTo: string;
  expired: boolean;
  variant?: "public" | "ops";
  action?: (previous: SignInState, form: FormData) => Promise<SignInState>;
}) {
  const [locale, setLocale] = useState<DocumentLocale>(initialLocale);
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const [state, setState] = useState<SignInState>({ status: "idle" });
  const [wait, setWait] = useState(0);
  const [pending, startTransition] = useTransition();
  const copy = GUEST_COPY[locale];

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
      const next = await action(state, form);
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
    (tried && !email.trim()) || state.status === "invalid"
      ? copy.enterEmail
      : state.status === "refused" && state.email === email.trim().toLowerCase()
        ? copy.auth.cannotUseEmail
        : undefined;

  return (
    <AuthFrame locale={locale} onLocaleChange={setLocale} after={variant === "public" ? <WhatsApp /> : null}>
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
            <h1 className="m-0 font-display text-heading tracking-display text-teal">{variant === "ops" ? copy.signIn : copy.auth.heading}</h1>
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
            {variant === "public" ? (
              <p className="m-0 border-t border-line pt-6 text-label text-ink">{copy.auth.newHere}</p>
            ) : null}
          </form>
        )}
    </AuthFrame>
  );
}

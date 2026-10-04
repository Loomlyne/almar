"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "../../../components/ui/button";
import { Field } from "../../../components/ui/field";
import { GUEST_COPY } from "../../../lib/copy/guest";
import { setDocumentLocale, type DocumentLocale } from "../../../lib/set-document-locale";
import { AuthFrame } from "../../login/auth-frame";
import { confirmSignIn, type ConfirmState } from "./actions";

function ContinueButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" busy={pending} className="w-full">
      {children}
    </Button>
  );
}

/**
 * Plan 02-24, signed design: the page the sign-in link opens. Nothing is verified until Continue
 * is pressed. `maskedEmail` is set only when the server proved it; otherwise the plain line shows.
 * Plan 02-26: `askEmail` (the link was not asked for in this browser) adds the email field; a wrong email
 * comes back as a state and shows under the field. `initialWrong` / `initialEmail` exist for the test harness.
 */
export function ContinueScreen({
  initialLocale,
  maskedEmail,
  tokenHash,
  type,
  signInHref = "/login",
  askEmail = false,
  browserProof,
  emailProof,
  initialWrong = false,
  initialEmail = "",
}: {
  initialLocale: DocumentLocale;
  maskedEmail?: string;
  tokenHash: string;
  type: string;
  signInHref?: string;
  askEmail?: boolean;
  browserProof?: string;
  emailProof?: string;
  initialWrong?: boolean;
  initialEmail?: string;
}) {
  const [locale, setLocale] = useState<DocumentLocale>(initialLocale);
  // The form's action is the server action itself (via useFormState), so a tap before hydration or with
  // JavaScript off still posts to the server. Next's App Router bundles React 19, where this hook exists;
  // the installed react-dom types expose it as useFormState.
  const [state, formAction] = useFormState(
    confirmSignIn,
    initialWrong ? { status: "wrong-email" as const, email: initialEmail } : ({ status: "idle" } as ConfirmState),
  );
  // Without JavaScript the page is rendered again from the action's state: keep what she typed.
  const [email, setEmail] = useState(state.status === "wrong-email" ? state.email : initialEmail);
  const copy = GUEST_COPY[locale].auth.continue;
  useEffect(() => setDocumentLocale(locale), [locale]);

  const wrong = state.status === "wrong-email";
  const showEmail = askEmail || wrong;

  return (
    <AuthFrame locale={locale} onLocaleChange={setLocale}>
      <form action={formAction} className="grid w-full max-w-108 gap-6">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        {browserProof ? <input type="hidden" name="b" value={browserProof} /> : null}
        {emailProof ? <input type="hidden" name="e" value={emailProof} /> : null}
        <h1 className="m-0 font-display text-heading tracking-display text-teal">{copy.heading}</h1>
        <p className="m-0 text-body text-ink">
          {maskedEmail ? (
            <>
              {copy.lead} <bdi dir="ltr">{maskedEmail}</bdi>
            </>
          ) : (
            copy.leadNoEmail
          )}
        </p>
        {showEmail ? (
          <>
            <p className="m-0 text-body text-muted">{copy.why}</p>
            <Field
              id="continue-email"
              label={GUEST_COPY[locale].email}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={wrong ? copy.wrongEmail : undefined}
            />
          </>
        ) : null}
        <ContinueButton>{copy.button}</ContinueButton>
        <a href={signInHref} rel="noreferrer" className="text-label text-ink underline decoration-gold underline-offset-4">
          {copy.other}
        </a>
      </form>
    </AuthFrame>
  );
}

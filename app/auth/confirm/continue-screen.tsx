"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "../../../components/ui/button";
import { GUEST_COPY } from "../../../lib/copy/guest";
import { setDocumentLocale, type DocumentLocale } from "../../../lib/set-document-locale";
import { AuthFrame } from "../../login/auth-frame";
import { confirmSignIn } from "./actions";

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
 */
export function ContinueScreen({
  initialLocale,
  maskedEmail,
  tokenHash,
  type,
  signInHref = "/login",
}: {
  initialLocale: DocumentLocale;
  maskedEmail?: string;
  tokenHash: string;
  type: string;
  signInHref?: string;
}) {
  const [locale, setLocale] = useState<DocumentLocale>(initialLocale);
  const copy = GUEST_COPY[locale].auth.continue;
  useEffect(() => setDocumentLocale(locale), [locale]);

  return (
    <AuthFrame locale={locale} onLocaleChange={setLocale}>
      <form action={confirmSignIn} className="grid w-full max-w-108 gap-6">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
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
        <ContinueButton>{copy.button}</ContinueButton>
        <a href={signInHref} className="text-label text-ink underline decoration-gold underline-offset-4">
          {copy.other}
        </a>
      </form>
    </AuthFrame>
  );
}

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authSigningKey } from "../../../lib/supabase/clients";
import { ContinueScreen } from "./continue-screen";
import { continueMode, isConfirmType, linkNonceCookieName, verifyContinue } from "../../../lib/auth/continue";
import { SHELL_HEADER } from "../../../lib/host";
import { requestLocale } from "../../../lib/request-locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Continue",
  robots: { index: false, follow: false },
  // same-origin, not no-referrer: no-referrer makes the browser send `Origin: null` on the Continue POST, which
  // Next's server-action origin check cannot parse. same-origin still never sends the token to another site.
  referrer: "same-origin",
};

type Query = { token_hash?: string | string[]; type?: string | string[]; m?: string | string[]; s?: string | string[]; b?: string | string[]; e?: string | string[] };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The link in her email lands here. This page only shows; the Continue button spends the token. */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const tokenHash = one(query.token_hash);
  const type = one(query.type);
  const ops = (await headers()).get(SHELL_HEADER) === "ops";
  if (!tokenHash || !isConfirmType(type)) redirect(ops ? "/sign-in?expired=1" : "/login?expired=1");

  const masked = one(query.m) ?? "";
  const key = authSigningKey("continue");
  const proven = verifyContinue(key, tokenHash, masked, one(query.s));
  // Plan 02-26: this browser asked for the link (cookie nonce matches `b`) = the signed page. Anything else
  // (another browser, a forward, no `b`) = the same page with the email check. No key = nothing to prove: the
  // no-email page, and the button fails closed.
  const b = one(query.b);
  const mode = continueMode(key, (await cookies()).get(linkNonceCookieName())?.value, tokenHash, b);

  return (
    <ContinueScreen
      initialLocale={await requestLocale()}
      maskedEmail={proven ? masked : undefined}
      tokenHash={tokenHash}
      type={type}
      askEmail={mode === "email"}
      browserProof={b}
      emailProof={one(query.e)}
      signInHref={ops ? "/sign-in" : "/login"}
    />
  );
}

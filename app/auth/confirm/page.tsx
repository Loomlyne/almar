import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authSigningKey } from "../../../lib/supabase/clients";
import { ContinueScreen } from "./continue-screen";
import { isConfirmType, verifyContinue } from "../../../lib/auth/continue";
import { SHELL_HEADER } from "../../../lib/host";
import { requestLocale } from "../../../lib/request-locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Continue",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Query = { token_hash?: string | string[]; type?: string | string[]; m?: string | string[]; s?: string | string[] };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The link in her email lands here. This page only shows; the Continue button spends the token. */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const tokenHash = one(query.token_hash);
  const type = one(query.type);
  const ops = (await headers()).get(SHELL_HEADER) === "ops";
  if (!tokenHash || !isConfirmType(type)) redirect(ops ? "/sign-in?expired=1" : "/login?expired=1");

  const masked = one(query.m) ?? "";
  const proven = verifyContinue(authSigningKey("continue"), tokenHash, masked, one(query.s));

  return (
    <ContinueScreen
      initialLocale={await requestLocale()}
      maskedEmail={proven ? masked : undefined}
      tokenHash={tokenHash}
      type={type}
      signInHref={ops ? "/sign-in" : "/login"}
    />
  );
}

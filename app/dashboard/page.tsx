import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignInScreen } from "../login/sign-in-screen";
import { opsSignIn } from "./actions";
import { SHELL_HEADER } from "../../lib/host";
import { isOwnerProfile } from "../../lib/auth/rules";
import { requestLocale } from "../../lib/request-locale";
import { readSessionProfile } from "../../lib/supabase/clients";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/** Plan 02-04: the ops sign-in. On the ops host this is `/` for anyone who is not the owner. */
export default async function OpsSignInPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const opsHost = (await headers()).get(SHELL_HEADER) === "ops";
  if (!opsHost && process.env.NODE_ENV === "production") notFound();
  if (isOwnerProfile(await readSessionProfile())) redirect(opsHost ? "/" : "/dashboard/home");
  const { expired } = await searchParams;
  return (
    <SignInScreen
      variant="ops"
      action={opsSignIn}
      initialLocale={await requestLocale()}
      returnTo="/"
      expired={expired === "1"}
    />
  );
}

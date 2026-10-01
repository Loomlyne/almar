import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInScreen } from "./sign-in-screen";
import { readSessionProfile } from "../../lib/supabase/clients";
import { LOCALE_COOKIE, readLocale, RETURN_COOKIE, safeReturnPath } from "../../lib/auth/rules";

export const dynamic = "force-dynamic";

const RETURN_KEYS: Record<string, string> = { account: "/account", bookings: "/bookings" };

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; return?: string }>;
}) {
  const store = await cookies();
  const query = await searchParams;
  // `return` is a key from a fixed list, never a URL, so it cannot redirect off-site.
  const key = query.return ?? "";
  const returnTo = Object.hasOwn(RETURN_KEYS, key)
    ? RETURN_KEYS[key]
    : safeReturnPath(store.get(RETURN_COOKIE)?.value);
  if (await readSessionProfile()) redirect(returnTo);

  const { expired } = query;
  return (
    <SignInScreen
      initialLocale={readLocale(store.get(LOCALE_COOKIE)?.value)}
      returnTo={returnTo}
      expired={expired === "1"}
    />
  );
}

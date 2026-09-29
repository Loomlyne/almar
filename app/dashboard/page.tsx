import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function SignInEntry() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="max-w-column p-6">
      <h1>Sign in</h1>
    </main>
  );
}

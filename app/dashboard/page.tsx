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
    <main style={{ padding: "var(--spacing-lg)", maxInlineSize: "var(--width-column)" }}>
      <h1>Sign in</h1>
    </main>
  );
}

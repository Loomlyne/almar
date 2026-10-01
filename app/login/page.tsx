import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignInScreen } from "./sign-in-screen";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <SignInScreen />;
}

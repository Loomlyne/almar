import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountScreen } from "./account-screen";

export const metadata: Metadata = {
  title: "Account",
};

export default function AccountPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <AccountScreen />;
}

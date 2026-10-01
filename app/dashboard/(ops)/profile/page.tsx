import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileScreen } from "./profile-screen";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default function DashboardProfilePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ProfileScreen />;
}

import type { Metadata } from "next";
import { ProfileScreen } from "./profile-screen";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default function DashboardProfilePage() {
  return <ProfileScreen />;
}

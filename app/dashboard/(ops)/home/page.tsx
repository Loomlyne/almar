import type { Metadata } from "next";
import { HomeScreen } from "./home-screen";

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

export default function DashboardHomePage() {
  return <HomeScreen />;
}

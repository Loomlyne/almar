import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeScreen } from "./home-screen";

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

export default function DashboardHomePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <HomeScreen />;
}

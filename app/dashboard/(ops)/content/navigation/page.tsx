import type { Metadata } from "next";
import { NavigationScreen } from "./navigation-screen";

export const metadata: Metadata = {
  title: "Navigation and footer",
  robots: { index: false, follow: false },
};

export default function DashboardNavigationPage() {
  return <NavigationScreen />;
}

import type { Metadata } from "next";
import { JourneysScreen } from "./journeys-screen";

export const metadata: Metadata = {
  title: "Packages",
  robots: { index: false, follow: false },
};

export default function DashboardPackagesPage() {
  return <JourneysScreen />;
}

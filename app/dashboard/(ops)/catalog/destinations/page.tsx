import type { Metadata } from "next";
import { DestinationsScreen } from "./destinations-screen";

export const metadata: Metadata = {
  title: "Destinations",
  robots: { index: false, follow: false },
};

export default function DashboardDestinationsPage() {
  return <DestinationsScreen />;
}

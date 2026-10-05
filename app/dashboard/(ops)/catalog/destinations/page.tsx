import type { Metadata } from "next";
import { CatalogScreen } from "../catalog-screen";

export const metadata: Metadata = {
  title: "Destinations",
  robots: { index: false, follow: false },
};

export default function DashboardDestinationsPage() {
  return <CatalogScreen kind="destinations" />;
}

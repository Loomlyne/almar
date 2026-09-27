import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogScreen } from "../catalog-screen";

export const metadata: Metadata = {
  title: "Destinations",
  robots: { index: false, follow: false },
};

export default function DashboardDestinationsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CatalogScreen kind="destinations" />;
}

import type { Metadata } from "next";
import { CatalogItemsScreen } from "./catalog-items-screen";

export const metadata: Metadata = {
  title: "Experiences & Services",
  robots: { index: false, follow: false },
};

export default function DashboardExperiencesPage() {
  return <CatalogItemsScreen />;
}

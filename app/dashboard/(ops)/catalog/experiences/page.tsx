import type { Metadata } from "next";
import { CatalogScreen } from "../catalog-screen";

export const metadata: Metadata = {
  title: "Experiences & Services",
  robots: { index: false, follow: false },
};

export default function DashboardExperiencesPage() {
  return <CatalogScreen kind="experiences" />;
}

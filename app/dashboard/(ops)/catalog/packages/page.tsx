import type { Metadata } from "next";
import { CatalogScreen } from "../catalog-screen";

export const metadata: Metadata = {
  title: "Packages",
  robots: { index: false, follow: false },
};

export default function DashboardPackagesPage() {
  return <CatalogScreen kind="packages" />;
}

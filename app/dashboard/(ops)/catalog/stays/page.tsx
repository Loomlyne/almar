import type { Metadata } from "next";
import { CatalogScreen } from "../catalog-screen";

export const metadata: Metadata = {
  title: "Stays",
  robots: { index: false, follow: false },
};

export default function DashboardStaysPage() {
  return <CatalogScreen kind="stays" />;
}

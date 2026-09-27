import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogScreen } from "../catalog-screen";

export const metadata: Metadata = {
  title: "Stays",
  robots: { index: false, follow: false },
};

export default function DashboardStaysPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CatalogScreen kind="stays" />;
}

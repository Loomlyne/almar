import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogScreen } from "../catalog-screen";

export const metadata: Metadata = {
  title: "Experiences & Services",
  robots: { index: false, follow: false },
};

export default function DashboardExperiencesPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CatalogScreen kind="experiences" />;
}

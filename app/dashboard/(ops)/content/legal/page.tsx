import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentScreen } from "../content-screen";

export const metadata: Metadata = {
  title: "Legal",
  robots: { index: false, follow: false },
};

export default function DashboardLegalPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ContentScreen kind="legal" />;
}

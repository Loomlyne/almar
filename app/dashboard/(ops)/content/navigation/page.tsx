import type { Metadata } from "next";
import { ComingSoonScreen } from "../coming-soon";

export const metadata: Metadata = {
  title: "Navigation and footer",
  robots: { index: false, follow: false },
};

export default function DashboardNavigationPage() {
  return <ComingSoonScreen kind="navigation" />;
}

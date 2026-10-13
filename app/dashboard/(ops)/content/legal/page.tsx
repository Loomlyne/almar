import type { Metadata } from "next";
import { ComingSoonScreen } from "../coming-soon";

export const metadata: Metadata = {
  title: "Legal",
  robots: { index: false, follow: false },
};

export default function DashboardLegalPage() {
  return <ComingSoonScreen kind="legal" />;
}

import type { Metadata } from "next";
import { ComingSoonScreen } from "../coming-soon";

export const metadata: Metadata = {
  title: "Pages",
  robots: { index: false, follow: false },
};

export default function DashboardPagesPage() {
  return <ComingSoonScreen kind="pages" />;
}

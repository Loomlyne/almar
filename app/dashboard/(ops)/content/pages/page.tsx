import type { Metadata } from "next";
import { PagesScreen } from "./pages-screen";

export const metadata: Metadata = {
  title: "Pages",
  robots: { index: false, follow: false },
};

export default function DashboardPagesPage() {
  return <PagesScreen />;
}

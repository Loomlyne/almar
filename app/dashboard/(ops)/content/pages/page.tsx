import type { Metadata } from "next";
import { ContentScreen } from "../content-screen";

export const metadata: Metadata = {
  title: "Pages",
  robots: { index: false, follow: false },
};

export default function DashboardPagesPage() {
  return <ContentScreen kind="pages" />;
}

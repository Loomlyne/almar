import type { Metadata } from "next";
import { ContentScreen } from "../content-screen";

export const metadata: Metadata = {
  title: "Legal",
  robots: { index: false, follow: false },
};

export default function DashboardLegalPage() {
  return <ContentScreen kind="legal" />;
}

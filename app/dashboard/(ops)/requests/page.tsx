import type { Metadata } from "next";
import { RequestsScreen } from "./requests-screen";

export const metadata: Metadata = {
  title: "Requests",
  robots: { index: false, follow: false },
};

export default function DashboardRequestsPage() {
  return <RequestsScreen />;
}

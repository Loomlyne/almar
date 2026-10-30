import type { Metadata } from "next";
import { LegalScreen } from "./legal-screen";

export const metadata: Metadata = {
  title: "Legal",
  robots: { index: false, follow: false },
};

export default function DashboardLegalPage() {
  return <LegalScreen />;
}

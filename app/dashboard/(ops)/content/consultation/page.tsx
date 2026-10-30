import type { Metadata } from "next";
import { ConsultationScreen } from "./consultation-screen";

export const metadata: Metadata = {
  title: "Consultation",
  robots: { index: false, follow: false },
};

export default function DashboardConsultationPage() {
  return <ConsultationScreen />;
}

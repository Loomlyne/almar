import type { Metadata } from "next";
import { StaysScreen } from "./stays-screen";

export const metadata: Metadata = {
  title: "Stays",
  robots: { index: false, follow: false },
};

export default function DashboardStaysPage() {
  return <StaysScreen />;
}

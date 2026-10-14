import type { Metadata } from "next";
import { SettingsScreen } from "./settings-screen";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

// Plan 02-06: the screen reads and saves through /api/ops/settings (live FX included), so the page renders nothing itself.
export default function DashboardSettingsPage() {
  return <SettingsScreen />;
}

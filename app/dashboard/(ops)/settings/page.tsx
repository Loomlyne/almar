import type { Metadata } from "next";
import { loadRates } from "../../../../lib/fx/rates";
import { SettingsScreen } from "./settings-screen";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function DashboardSettingsPage() {
  const rates = await loadRates();

  return <SettingsScreen rates={rates} />;
}

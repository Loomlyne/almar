import type { Metadata } from "next";
import { TeamScreen } from "./team-screen";

export const metadata: Metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};

export default function DashboardTeamPage() {
  return <TeamScreen />;
}

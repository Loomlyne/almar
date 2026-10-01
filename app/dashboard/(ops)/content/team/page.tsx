import type { Metadata } from "next";
import { ContentScreen } from "../content-screen";

export const metadata: Metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};

export default function DashboardTeamPage() {
  return <ContentScreen kind="team" />;
}

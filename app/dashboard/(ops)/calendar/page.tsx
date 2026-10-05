import type { Metadata } from "next";
import { CalendarScreen } from "./calendar-screen";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export default function DashboardCalendarPage() {
  return <CalendarScreen />;
}

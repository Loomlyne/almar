import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarScreen } from "./calendar-screen";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export default function DashboardCalendarPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CalendarScreen />;
}

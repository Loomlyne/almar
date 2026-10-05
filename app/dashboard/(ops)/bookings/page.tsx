import type { Metadata } from "next";
import { BookingsScreen } from "./bookings-screen";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

export default function DashboardBookingsPage() {
  return <BookingsScreen />;
}

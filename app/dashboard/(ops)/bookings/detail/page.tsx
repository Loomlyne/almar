import type { Metadata } from "next";
import { BookingDetailScreen } from "./booking-detail-screen";

export const metadata: Metadata = {
  title: "Booking",
  robots: { index: false, follow: false },
};

export default function DashboardBookingDetailPage() {
  return <BookingDetailScreen />;
}

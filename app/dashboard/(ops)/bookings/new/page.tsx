import type { Metadata } from "next";
import { NewBookingLoader } from "./new-booking-loader";

export const metadata: Metadata = {
  title: "New booking",
  robots: { index: false, follow: false },
};

export default function DashboardNewBookingPage() {
  return <NewBookingLoader />;
}

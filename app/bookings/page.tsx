import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingsScreen } from "./bookings-screen";

export const metadata: Metadata = {
  title: "Bookings",
};

export default function BookingsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <BookingsScreen />;
}

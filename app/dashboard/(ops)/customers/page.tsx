import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomersScreen } from "./customers-screen";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

export default function DashboardCustomersPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CustomersScreen />;
}

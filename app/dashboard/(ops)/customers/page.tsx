import type { Metadata } from "next";
import { CustomersScreen } from "./customers-screen";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

export default function DashboardCustomersPage() {
  return <CustomersScreen />;
}

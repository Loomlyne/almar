import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TripScreen } from "./trip-screen";

export const metadata: Metadata = {
  title: "Trip",
  robots: { index: false, follow: false },
};

export default function TripPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <Suspense fallback={<main id="content"><h1>Trip</h1></main>}>
      <TripScreen />
    </Suspense>
  );
}

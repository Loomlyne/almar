"use client";

import dynamic from "next/dynamic";

// Plan 05-02: the screen, its steps, its words and its rules load in the browser only (Worker size), so none of them enters
// the server bundle. The loading block has no words: an empty, aria-busy block the height of the first step.
const NewBookingScreen = dynamic(() => import("./new-booking-screen").then((m) => m.NewBookingScreen), {
  ssr: false,
  loading: () => <div aria-busy="true" className="min-h-96" />,
});

export function NewBookingLoader() {
  return <NewBookingScreen />;
}

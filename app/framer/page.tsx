import { notFound } from "next/navigation";
import { FramerShell } from "./framer-shell";

export default function FramerPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <FramerShell />;
}

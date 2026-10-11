import type { Metadata } from "next";
import { MediaLibrary } from "./media-library";

export const metadata: Metadata = {
  title: "Media",
  robots: { index: false, follow: false },
};

export default function DashboardMediaPage() {
  return <MediaLibrary />;
}

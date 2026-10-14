import type { Metadata } from "next";
import { ComingSoonScreen } from "../coming-soon";

export const metadata: Metadata = {
  title: "Blog",
  robots: { index: false, follow: false },
};

export default function DashboardBlogPage() {
  return <ComingSoonScreen kind="blog" />;
}

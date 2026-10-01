import type { Metadata } from "next";
import { ContentScreen } from "../content-screen";

export const metadata: Metadata = {
  title: "Blog",
  robots: { index: false, follow: false },
};

export default function DashboardBlogPage() {
  return <ContentScreen kind="blog" />;
}

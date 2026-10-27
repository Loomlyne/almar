import type { Metadata } from "next";
import { BlogScreen } from "./blog-screen";

export const metadata: Metadata = {
  title: "Blog",
  robots: { index: false, follow: false },
};

export default function DashboardBlogPage() {
  return <BlogScreen />;
}

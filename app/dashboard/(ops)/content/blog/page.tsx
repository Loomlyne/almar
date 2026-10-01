import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentScreen } from "../content-screen";

export const metadata: Metadata = {
  title: "Blog",
  robots: { index: false, follow: false },
};

export default function DashboardBlogPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ContentScreen kind="blog" />;
}

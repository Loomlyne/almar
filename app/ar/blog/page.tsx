import { BlogPage, blogMetadata } from "../../../components/pages/blog-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return blogMetadata("ar");
}

export default function Page() {
  return <BlogPage locale="ar" />;
}

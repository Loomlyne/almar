import { BlogPage, blogMetadata } from "../../../components/pages/blog-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return blogMetadata("es");
}

export default function Page() {
  return <BlogPage locale="es" />;
}

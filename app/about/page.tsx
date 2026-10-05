import { AboutPage, aboutMetadata } from "../../components/pages/about-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return aboutMetadata("en");
}

export default function Page() {
  return <AboutPage locale="en" />;
}

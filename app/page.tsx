import { HomePage, homeMetadata } from "../components/pages/home-page";

export const dynamic = "force-static";

export const generateMetadata = () => homeMetadata("en");

export default function Page() {
  return <HomePage locale="en" />;
}

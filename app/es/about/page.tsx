import { AboutPage, aboutMetadata } from "../../../components/pages/about-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return aboutMetadata("es");
}

export default function Page() {
  return <AboutPage locale="es" />;
}

import { ExperiencesPage, experiencesMetadata } from "../../../components/pages/experiences-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return experiencesMetadata("es");
}

export default function Page() {
  return <ExperiencesPage locale="es" />;
}

import { ListWithUsPage, listMetadata } from "../../../components/pages/list-with-us-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return listMetadata("es");
}

export default function Page() {
  return <ListWithUsPage locale="es" />;
}

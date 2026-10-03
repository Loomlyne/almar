import { PrivateStaysPage, privateStaysMetadata } from "../../../components/pages/private-stays-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return privateStaysMetadata("es");
}

export default function Page() {
  return <PrivateStaysPage locale="es" />;
}

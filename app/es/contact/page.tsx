import { ContactPage, contactMetadata } from "../../../components/pages/contact-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return contactMetadata("es");
}

export default function Page() {
  return <ContactPage locale="es" />;
}

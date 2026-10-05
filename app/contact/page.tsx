import { ContactPage, contactMetadata } from "../../components/pages/contact-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return contactMetadata("en");
}

export default function Page() {
  return <ContactPage locale="en" />;
}

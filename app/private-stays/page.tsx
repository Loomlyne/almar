import { PrivateStaysPage, privateStaysMetadata } from "../../components/pages/private-stays-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return privateStaysMetadata("en");
}

export default function Page() {
  return <PrivateStaysPage locale="en" />;
}

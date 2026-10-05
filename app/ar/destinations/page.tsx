import { DestinationsPage, destinationsMetadata } from "../../../components/pages/destinations-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return destinationsMetadata("ar");
}

export default function Page() {
  return <DestinationsPage locale="ar" />;
}

import { ListWithUsPage, listMetadata } from "../../../components/pages/list-with-us-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return listMetadata("en");
}

export default function Page() {
  return <ListWithUsPage locale="en" />;
}

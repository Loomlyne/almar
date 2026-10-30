import { PlanWithUsPage, planMetadata } from "../../../components/pages/plan-with-us-page";

export const dynamic = "force-static";

export function generateMetadata() {
  return planMetadata("en");
}

export default function Page() {
  return <PlanWithUsPage locale="en" />;
}

import type { Metadata } from "next";
import { StayDetailPage, generateStayMetadata, generateStayParams } from "../../../../components/pages/stay-detail-page";

// The Arabic stay pages (right to left; the document gets lang and dir from the route). One template, built at deploy time for every published stay; any other slug is a 404.
export const dynamicParams = false;
export const dynamic = "force-static";
export const generateStaticParams = generateStayParams;

type Params = { params: Promise<{ stay: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { stay } = await params;
  return generateStayMetadata("ar", stay);
}

export default async function Page({ params }: Params) {
  const { stay } = await params;
  return <StayDetailPage locale="ar" slug={stay} />;
}

import type { Metadata } from "next";
import { LegalPage, generateLegalStaticParams, legalMetadata } from "../../../../components/pages/legal-page";

// One template, built at deploy time for every legal page published in all three languages; any other slug is a 404.
export const dynamicParams = false;
export const dynamic = "force-static";
export const generateStaticParams = generateLegalStaticParams;

type Params = { params: Promise<{ legal: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { legal } = await params;
  return legalMetadata("ar", legal);
}

export default async function Page({ params }: Params) {
  const { legal } = await params;
  return <LegalPage locale="ar" slug={legal} />;
}

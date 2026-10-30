import type { Metadata } from "next";
import { PackagePage, generatePackageParams, packageMetadata } from "../../../../components/pages/package-page";

// One template, built at deploy time for every published package; any other slug is a 404.
export const dynamicParams = false;
export const dynamic = "force-static";
export const generateStaticParams = generatePackageParams;

type Params = { params: Promise<{ journey: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { journey } = await params;
  return packageMetadata("en", journey);
}

export default async function Page({ params }: Params) {
  const { journey } = await params;
  return <PackagePage locale="en" slug={journey} />;
}

import type { Metadata } from "next";
import { PostPage, generatePostParams, postMetadata } from "../../../components/pages/post-page";

// One template, built at deploy time for every published post; any other slug is a 404.
export const dynamicParams = false;
export const dynamic = "force-static";
export const generateStaticParams = generatePostParams;

type Params = { params: Promise<{ post: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { post } = await params;
  return postMetadata("en", post);
}

export default async function Page({ params }: Params) {
  const { post } = await params;
  return <PostPage locale="en" slug={post} />;
}

import { notFound } from "next/navigation";
import { isDocumentLocale } from "../../lib/set-document-locale";
import { HarnessClient } from "./harness-client";

export const dynamic = "force-dynamic";

const NAME = /^[a-z0-9_-]+$/;

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function HarnessPage({ searchParams }: { searchParams: Params }) {
  if (process.env.ALMAR_HARNESS !== "1") notFound();
  const q = await searchParams;
  const c = typeof q.c === "string" ? q.c : "";
  const s = typeof q.s === "string" ? q.s : "";
  const l = typeof q.l === "string" ? q.l : "";
  if (!NAME.test(c) || !NAME.test(s) || !isDocumentLocale(l)) notFound();
  return <HarnessClient c={c} s={s} l={l} />;
}

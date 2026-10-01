import type { Metadata } from "next";
import { Link } from "../components/ui/link";
import { StatusFrame } from "../components/status-frame";
import { DocumentLocale } from "../components/document-locale";
import { GUEST_COPY } from "../lib/copy/guest";
import { NOT_FOUND_TITLE } from "../lib/not-found-document";
import { requestLocale } from "../lib/request-locale";

export const metadata: Metadata = {
  title: NOT_FOUND_TITLE,
};

/** Plan 02-03: heading and link follow the almar-locale cookie. */
export default async function NotFound() {
  const locale = await requestLocale();
  const copy = GUEST_COPY[locale].notFound;
  return (
    <>
      <DocumentLocale locale={locale} />
      <StatusFrame title={copy.title}>
        <Link href="/">{copy.returnHome}</Link>
      </StatusFrame>
    </>
  );
}

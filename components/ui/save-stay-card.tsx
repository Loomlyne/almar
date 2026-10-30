import { saveHeartCopy } from "../../lib/copy/saved-stays";
import type { Locale } from "../../lib/locale-path";
import { PortraitCard, type PortraitCardProps } from "./card";
import { SaveStayButton } from "./save-stay";

/**
 * A stay's PortraitCard with its heart in the corner: the one form of the home, the stay page's related stays and a post's featured
 * stay. A server component; only the heart is a client part.
 */
export function SavedPortraitCard({ slug, locale, ...card }: Omit<PortraitCardProps, "action"> & { slug: string; locale: Locale }) {
  return <PortraitCard {...card} action={<SaveStayButton slug={slug} title={card.title} locale={locale} tone="on-image" copy={saveHeartCopy(locale)} />} />;
}

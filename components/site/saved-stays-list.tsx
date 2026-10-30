import { cn } from "../../lib/cn";
import { fill } from "../../lib/journey-format";
import type { SavedStaysCopy } from "../../lib/copy/saved-stays";
import { Button, LinkButton } from "../ui/button";
import { MediaCard } from "../ui/card";
import { CARD_TITLE, CardTitleWords } from "../ui/link";

/** A saved, published stay as Account shows it. Built by lib/saved-stays/server.ts in the page's language. */
export type SavedStayCard = {
  slug: string;
  title: string;
  destination: string;
  href: string;
  image: { src: string; alt: string } | null;
};

/** As signed: capitals in the Latin scripts at 14px, which the kit's outline variant does not have. */
const BROWSE = "uppercase tracking-kicker ar:normal-case ar:tracking-normal md:text-label";

/**
 * Account's "Saved stays" card, from props alone. Full: one card per stay, newest first, each with Remove beside its title. Empty:
 * one line and a link to Private Stays. `status` is the live line under it (a removal, or why one failed).
 */
export function SavedStaysList({
  stays,
  copy,
  browseHref,
  onRemove,
  busySlug,
  status = "",
}: {
  stays: readonly SavedStayCard[];
  copy: Pick<SavedStaysCopy, "savedStays" | "savedEmpty" | "browseStays" | "remove" | "removeStay">;
  browseHref: string;
  onRemove?: (slug: string) => void;
  busySlug?: string | null;
  status?: string;
}) {
  return (
    <section id="saved" className="grid gap-4 border border-line bg-surface p-4 md:p-6" aria-labelledby="saved-title">
      {/* tabIndex: the Remove that was pressed goes away with its card, so the keyboard continues from this title. */}
      <h3 id="saved-title" tabIndex={-1} className="m-0 font-display text-title text-teal">{copy.savedStays}</h3>
      <div>
        {stays.length > 0 ? (
          <ul role="list" className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
            {stays.map((stay) => {
              const remove = (
                <Button variant="secondary" className="px-4" busy={busySlug === stay.slug} aria-label={fill(copy.removeStay, { stay: stay.title })} onClick={() => onRemove?.(stay.slug)}>
                  {copy.remove}
                </Button>
              );
              return (
                <li key={stay.slug} className="min-w-0">
                  {stay.image ? (
                    <MediaCard href={stay.href} image={stay.image} title={stay.title} detail={stay.destination} action={remove} />
                  ) : (
                    <div className="flex items-start justify-between gap-3 border-t border-line pt-3">
                      <span className="flex min-w-0 flex-col gap-1">
                        <a href={stay.href} className="group w-max max-w-full">
                          <span className={cn("font-display text-title", CARD_TITLE)}>
                            <CardTitleWords>{stay.title}</CardTitleWords>
                          </span>
                        </a>
                        <span className="text-label text-muted">{stay.destination}</span>
                      </span>
                      {remove}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid gap-4">
            <p className="m-0 text-body text-ink">{copy.savedEmpty}</p>
            <LinkButton variant="outline" href={browseHref} className={BROWSE}>
              {copy.browseStays}
            </LinkButton>
          </div>
        )}
        {/* Always in the page, so a screen reader hears the line when it arrives; empty it takes no room. */}
        <span className="block pt-4 text-label text-ink empty:pt-0" role="status">{status}</span>
      </div>
    </section>
  );
}

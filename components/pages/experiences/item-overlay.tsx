"use client";

import { useRef, type RefObject } from "react";
import type { ExperiencesPageCopy } from "../../../lib/copy/experiences-page";
import { LinkButton } from "../../ui/button";
import { Dialog } from "../../ui/dialog";
import { FactList, type Fact } from "../../ui/fact-list";
import { Link } from "../../ui/link";
import type { BrowserItem } from "./catalog-browser";

const KICKER_JOINER = " · ";

/** The type word, then each place joined with a middle dot; with no place, the type word alone (design 1.3). */
export function overlayKicker(
  item: Pick<BrowserItem, "kind" | "destination_slugs">,
  copy: Pick<ExperiencesPageCopy, "overlay">,
  destinationNames: Record<string, string>,
): string {
  const type = item.kind === "service" ? copy.overlay.service : copy.overlay.experience;
  const places = item.destination_slugs.map((slug) => destinationNames[slug]).filter((name): name is string => !!name);
  return [type, ...places].join(KICKER_JOINER);
}

/**
 * The overlay's body: the full published paragraph, then the rows. Duration only when it is published (the ten services
 * publish none); Private stays only when some stay offers the item, one real link each. Nothing else is shown, because
 * the held controls of design 4.3 cannot work in this slice.
 */
export function ItemDetail({
  item,
  copy,
  stayNames,
  stayHrefs,
}: {
  item: BrowserItem;
  copy: Pick<ExperiencesPageCopy, "overlay">;
  /** Accepted so a caller can pass the whole overlay context; the kicker above the title is the Dialog's slot. */
  destinationNames?: Record<string, string>;
  stayNames: Record<string, string>;
  /** slug -> the stay page address in this language, built on the server. */
  stayHrefs: Record<string, string>;
}) {
  const rows: Fact[] = [];
  if (item.duration_label) rows.push({ label: copy.overlay.duration, value: item.duration_label });
  if (item.stay_slugs.length > 0) {
    rows.push({
      label: copy.overlay.stays,
      value: (
        <span className="flex flex-wrap gap-x-4">
          {item.stay_slugs.map((slug) => (
            <Link key={slug} href={stayHrefs[slug]}>
              {stayNames[slug] ?? slug}
            </Link>
          ))}
        </span>
      ),
    });
  }
  return (
    <div className="grid gap-4">
      {item.summary ? <p className="m-0 text-body text-ink">{item.summary}</p> : null}
      {rows.length > 0 ? <FactList items={rows} /> : null}
    </div>
  );
}

/**
 * The detail overlay of one catalogue item: a controlled Dialog "detail" with the picture, the kicker, the item's name as
 * its h2, the body and a docked bar holding the one real next step, Request Inquiry. Focus goes back to `returnFocusRef`
 * when it closes by the close square, Escape or the scrim.
 */
export function ItemOverlay({
  item,
  open,
  onOpenChange,
  copy,
  destinationNames,
  stayNames,
  stayHrefs,
  inquiryHref,
  returnFocusRef,
}: {
  item: BrowserItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: ExperiencesPageCopy;
  destinationNames: Record<string, string>;
  stayNames: Record<string, string>;
  stayHrefs: Record<string, string>;
  inquiryHref: string;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  // The dialog stays mounted while it closes, so focus can be handed back: it keeps the last item it showed.
  const last = useRef<BrowserItem | null>(null);
  if (item) last.current = item;
  const shown = item ?? last.current;
  if (!shown) return null;
  return (
    <Dialog
      size="detail"
      open={open && item !== null}
      onOpenChange={onOpenChange}
      title={shown.name}
      closeLabel={copy.overlay.close}
      dismiss="picker"
      kicker={overlayKicker(shown, copy, destinationNames)}
      media={<img src={shown.image.src} alt={shown.image.alt} decoding="async" />}
      returnFocusRef={returnFocusRef}
      footer={<LinkButton href={inquiryHref}>{copy.overlay.requestInquiry}</LinkButton>}
    >
      <ItemDetail item={shown} copy={copy} stayNames={stayNames} stayHrefs={stayHrefs} />
    </Dialog>
  );
}

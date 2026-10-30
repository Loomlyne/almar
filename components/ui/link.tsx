import { cva } from "class-variance-authority";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { ArrowIcon, ChevronIcon, CloseIcon } from "../icons/icons";

// The five kinds of link, as the owner signed them on 2026-10-30 (pictures/no-underlines, decisions
// 2026-10-30-no-underlines-pictures-signed.md). No line under text, at rest or on hover. Screens take their look from here.
// Gold never appears: no link turns gold. The 2px focus outline is the global one in app/globals.css.

/** Kind 1, on an ivory ground or over a photo: a tile behind the link on hover and on press. */
export const TILE_ON_LIGHT =
  "transition-colors duration-fast ease-standard hover:bg-teal-tint hover:text-teal active:bg-teal-tint active:text-teal";
/** Kind 1, on the teal footer: a soft ivory tile; the focus outline is ivory because teal on teal cannot be seen. */
export const TILE_ON_TEAL =
  "transition-colors duration-fast ease-standard hover:bg-ivory/14 active:bg-ivory/14 focus-visible:outline-ivory";
/** Kind 1, the current page: bold, with no line (the owner took the gold line off the picture). */
export const LINK_CURRENT = "font-bold";

const ARROW = "shrink-0 rtl:-scale-x-100 motion-safe:transition-transform motion-safe:duration-fast motion-safe:ease-standard";

/** Kind 2: the arrow after a card's title, there at rest; it slides the reading way while its `group` card is hovered. */
export function CardArrow() {
  return <ArrowIcon size={16} className={cn(ARROW, "ltr:motion-safe:group-hover:translate-x-1 rtl:motion-safe:group-hover:-translate-x-1")} />;
}

/** Kind 2: a card title's colour and layout. The element sits inside the `group` that is the card. */
export const CARD_TITLE =
  "inline-flex items-center gap-2 text-teal transition-colors duration-fast ease-standard group-hover:text-teal-hover group-active:text-teal-press";

/** Kind 2: the words of a card's title, then its arrow. Inside CARD_TITLE a long title wraps in its span; the arrow keeps its line. */
export function CardTitleWords({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="min-w-0">{children}</span>
      <CardArrow />
    </>
  );
}

/**
 * Kind 3, a link alone on its line: teal text and an arrow, a tint tile on hover and on press. The row never wraps: a long
 * label wraps in its own box and the arrow, which cannot shrink, stays on the text's line in every language and width.
 * The negative start margin keeps the words in line with the text above when the tile adds its padding.
 */
export const LINK_ALONE =
  "group/link inline-flex max-w-full min-h-control items-center gap-2 -ms-2 px-2 text-teal transition-colors duration-fast ease-standard hover:bg-teal-tint active:bg-teal-tint";

/** Kind 3: the arrow after a link's words. It slides the reading way while its LINK_ALONE link is hovered. */
export function LinkArrow({ className }: { className?: string }) {
  return (
    <ArrowIcon
      size={16}
      className={cn(ARROW, "ltr:motion-safe:group-hover/link:translate-x-1 rtl:motion-safe:group-hover/link:-translate-x-1", className)}
    />
  );
}

/**
 * Kind 4, a link inside a sentence: bold teal on an always-on tint block; hover and press turn the block teal with ivory
 * words. It is a plain inline box so it wraps with the sentence, and box-decoration-clone gives each line its own whole block.
 * On a touch screen the box's tap area is a full 44px high without moving the lines of text around it.
 */
export const LINK_IN_SENTENCE =
  "relative bg-teal-tint px-1 font-bold text-teal box-decoration-clone transition-colors duration-fast ease-standard hover:bg-teal hover:text-ivory active:bg-teal active:text-ivory pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:top-1/2 pointer-coarse:before:h-control pointer-coarse:before:-translate-y-1/2";

/**
 * Kind 5 and any other text action that is not a link to somewhere (Clear, Add, Try again, Back): teal text, a tint tile on
 * hover and on press. Works on a button or a link; icons sit on the text's line.
 */
export const LINK_BUTTON =
  "inline-flex w-max max-w-full min-h-control cursor-pointer items-center gap-1 -ms-2 border-0 bg-transparent px-2 py-0 font-body text-label text-teal transition-colors duration-fast ease-standard hover:bg-teal-tint active:bg-teal-tint disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent disabled:active:bg-transparent";

/** Kind 5: Remove, Delete, Cancel: red text after a small x (RemoveMark), a soft red tile on hover and on press. */
export const LINK_BUTTON_DANGER =
  "inline-flex w-max max-w-full min-h-control cursor-pointer items-center gap-1 -ms-2 border-0 bg-transparent px-2 py-0 font-body text-label text-error transition-colors duration-fast ease-standard hover:bg-error/10 active:bg-error/10 disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent disabled:active:bg-transparent";

/** Kind 5: the bold teal title of a list row, the row's way in. */
export const ROW_TITLE =
  "inline-flex w-max max-w-full min-h-control cursor-pointer items-center gap-1 -ms-2 border-0 bg-transparent px-2 py-0 text-start font-body text-label font-bold text-teal transition-colors duration-fast ease-standard hover:bg-teal-tint active:bg-teal-tint";

/** Kind 5: the small x before a red action's words. */
export function RemoveMark() {
  return <CloseIcon size={16} className="shrink-0" />;
}

/** Kind 5: the chevron before Back: it points the way back in each reading direction. */
export function BackChevron() {
  return <ChevronIcon size={16} className="shrink-0 rotate-180 rtl:rotate-0" />;
}

/** Kind 5: the chevron after Edit translations: down when closed, up when open. */
export function DisclosureChevron({ open }: { open: boolean }) {
  return <ChevronIcon size={16} className={cn("shrink-0", open ? "-rotate-90" : "rotate-90")} />;
}

const link = cva("ui-link", {
  variants: {
    inline: {
      true: LINK_IN_SENTENCE,
      false: LINK_ALONE,
    },
  },
  defaultVariants: { inline: false },
});

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  /** Inside a sentence (kind 4). Otherwise the link stands alone (kind 3). */
  inline?: boolean;
  /** Stand-alone links carry an arrow; false for a link whose look is a button. */
  arrow?: boolean;
  children: ReactNode;
};

/**
 * A link. A stand-alone link's words are direct items of its row, followed by the arrow. A link that brings its own icon
 * (the contact details' outward arrow, a team member's envelope) draws no second one: the arrow shows only if it is the
 * row's one svg.
 */
export function Link({ className, children, href, inline = false, arrow = true, ...rest }: LinkProps) {
  return (
    <a href={href} className={cn(link({ inline }), className)} {...rest}>
      {children}
      {!inline && arrow ? <LinkArrow className="not-only-of-type:hidden" /> : null}
    </a>
  );
}

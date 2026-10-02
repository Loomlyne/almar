import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type MediaCardImage = { src: string; alt: string };

export type MediaCardProps = {
  /** With href the whole card is one link named by the title. Without it the card is an article. */
  href?: string;
  image: MediaCardImage;
  title: string;
  /** One muted line under the title. */
  detail?: ReactNode;
  /** Image height divided by width (board: 0.75, a 4:3 picture). */
  ratio?: number;
  /** A trailing 44x44 control slot. With href it sits beside the link, never inside it. */
  action?: ReactNode;
  className?: string;
};

const ROOT = "group grid min-w-0 content-start gap-3 text-ink no-underline";
const IMAGE = "block w-full object-cover outline outline-1 outline-line -outline-offset-1";
const TITLE =
  "font-display text-title text-teal decoration-gold decoration-1 underline-offset-4 group-hover:underline";

/**
 * The card every stay, service, experience and story uses. Anatomy from the public board's
 * card spec: picture, then a row with the title and one muted detail line.
 */
export function MediaCard({ href, image, title, detail, ratio = 0.75, action, className }: MediaCardProps) {
  const picture = (
    <img
      src={image.src}
      alt={image.alt}
      decoding="async"
      className={IMAGE}
      style={{ aspectRatio: `1 / ${ratio}` }}
    />
  );
  const lines = (
    <span className="flex min-w-0 flex-col gap-1">
      <span className={TITLE}>{title}</span>
      {detail ? <span className="text-label text-muted">{detail}</span> : null}
    </span>
  );

  if (href && !action) {
    return (
      <a href={href} className={cn(ROOT, className)}>
        {picture}
        {lines}
      </a>
    );
  }

  if (href) {
    // A control cannot sit inside a link: the title is the link and stretches over the card.
    return (
      <article className={cn(ROOT, "relative", className)}>
        {picture}
        <div className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-1">
            <a href={href} className={cn(TITLE, "no-underline after:absolute after:inset-0")}>
              {title}
            </a>
            {detail ? <span className="text-label text-muted">{detail}</span> : null}
          </span>
          <span className="relative z-10 shrink-0">{action}</span>
        </div>
      </article>
    );
  }

  return (
    <article className={cn(ROOT, className)}>
      {picture}
      <div className="flex items-start justify-between gap-3">
        {lines}
        {action ? <span className="shrink-0">{action}</span> : null}
      </div>
    </article>
  );
}

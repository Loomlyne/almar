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
  /** Title size: "title" (20, default) or "heading" (32, the Framer card). */
  titleSize?: "title" | "heading";
  /** "center" centres the title and detail (the home's destination cards). */
  align?: "start" | "center";
  /**
   * Picture zoom on hover, over the hover duration with the reveal ease; never under reduced motion.
   * "none" (default), "sm" 1.02x, "md" 1.05x.
   */
  zoom?: "none" | "sm" | "md";
  className?: string;
};

const ROOT = "group grid min-w-0 content-start gap-3 text-ink no-underline";
const IMAGE = "block w-full object-cover outline outline-1 outline-line -outline-offset-1";
const TITLE_REST = "text-teal decoration-gold decoration-1 underline-offset-4 group-hover:underline";
const ZOOM = {
  sm: "transition-transform duration-hover ease-reveal motion-safe:group-hover:scale-102",
  md: "transition-transform duration-hover ease-reveal motion-safe:group-hover:scale-105",
} as const;

/**
 * The card every stay, service, experience and story uses. Anatomy from the public board's
 * card spec: picture, then a row with the title and one muted detail line.
 */
export function MediaCard({
  href,
  image,
  title,
  detail,
  ratio = 0.75,
  action,
  titleSize = "title",
  align = "start",
  zoom = "none",
  className,
}: MediaCardProps) {
  const TITLE = cn("font-display", titleSize === "heading" ? "text-heading" : "text-title", TITLE_REST);
  const center = align === "center";
  const lineBox = cn("flex min-w-0 flex-col gap-1", center && "items-center text-center");
  const picture =
    zoom === "none" ? (
      <img
        src={image.src}
        alt={image.alt}
        decoding="async"
        className={IMAGE}
        style={{ aspectRatio: `1 / ${ratio}` }}
      />
    ) : (
      <span className="block overflow-hidden">
        <img
          src={image.src}
          alt={image.alt}
          decoding="async"
          className={cn(IMAGE, ZOOM[zoom])}
          style={{ aspectRatio: `1 / ${ratio}` }}
        />
      </span>
    );
  const lines = (
    <span className={lineBox}>
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
          <span className={lineBox}>
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
      <div className={cn("flex items-start", center ? "justify-center" : "justify-between", "gap-3")}>
        {lines}
        {action ? <span className="shrink-0">{action}</span> : null}
      </div>
    </article>
  );
}

export type PortraitFact = { icon: ReactNode; text: string };

export type PortraitCardProps = {
  href: string;
  image: MediaCardImage;
  title: string;
  /** An icon row on the photo, for example guests, bedrooms, bathrooms. */
  facts?: PortraitFact[];
  className?: string;
};

/**
 * The Framer stay card: one link, a 2:3 photo, the title and an icon facts row on the photo over a dark gradient.
 * The photo zooms 1.05x on hover over the hover duration with the reveal ease (not under reduced motion).
 */
export function PortraitCard({ href, image, title, facts = [], className }: PortraitCardProps) {
  return (
    <a href={href} className={cn("group relative block aspect-2/3 min-w-0 overflow-hidden text-ivory no-underline", className)}>
      <img src={image.src} alt={image.alt} decoding="async" className={cn("absolute inset-0 size-full object-cover", ZOOM.md)} />
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/10 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-6 pb-6 md:px-8 md:pb-8">
        <span className="font-display text-heading text-ivory">{title}</span>
        {facts.length > 0 ? (
          <span className="flex flex-wrap gap-x-6 gap-y-2 text-label text-ivory">
            {facts.map((fact, index) => (
              <span key={index} className="inline-flex items-center gap-2">
                {fact.icon}
                {fact.text}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </a>
  );
}

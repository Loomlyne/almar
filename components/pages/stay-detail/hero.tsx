import type { ReactNode } from "react";
import { PageShell } from "../../ui/page-shell";

/**
 * The stay page's hero (design 1.3, board 5i): one screen tall, capped at the board's 900px. The booking bar
 * sits near the top, under the header, so its calendar opens over the photo and the page ground never moves;
 * the destination, the h1 and the tagline sit at the bottom, clear of the pinned dock. Server component: it
 * holds no state. The bar arrives as `children`.
 */
export function StayHero({
  image,
  eyebrow,
  title,
  tagline,
  children,
}: {
  image: { url: string; alt: string; width: number | null; height: number | null } | null;
  /** The destination's name. */
  eyebrow: string;
  title: string;
  tagline: string | null;
  /** The booking bar. */
  children: ReactNode;
}) {
  return (
    <div className="relative isolate flex h-svh max-h-225 min-h-160 flex-col justify-between bg-teal pt-16 pb-dock">
      {image ? (
        <img
          src={image.url}
          alt={image.alt}
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
      ) : null}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/40" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-ink/70 to-transparent" />
      <PageShell className="pt-12">{children}</PageShell>
      <PageShell className="pb-8">
        <div className="flex flex-col gap-3 text-ivory">
          <p className="m-0 text-caption uppercase tracking-kicker ar:normal-case ar:tracking-normal">{eyebrow}</p>
          <h1 className="m-0 max-w-3xl font-display text-display tracking-display text-ivory">{title}</h1>
          {tagline ? <p className="m-0 max-w-prose text-title">{tagline}</p> : null}
        </div>
      </PageShell>
    </div>
  );
}

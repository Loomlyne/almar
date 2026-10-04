import type { ReactNode } from "react";
import { PageShell } from "../../ui/page-shell";
import { Reveal } from "../../ui/reveal";

/**
 * The stay page's hero (design 1.3, 11-DESIGN section 1): one screen tall, capped at 900px, the photo full-bleed and
 * fading as the page scrolls away. The title block is centred (destination kicker, h1, the neighbourhood under it) and
 * the locked booking bar sits at the bottom, clear of the pinned dock. Server component: it holds no state. The bar
 * arrives as `children`.
 */
export function StayHero({
  image,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  image: { url: string; alt: string; width: number | null; height: number | null } | null;
  /** The destination's name. */
  eyebrow: string;
  title: string;
  /** The stay's neighbourhood; omitted when null. */
  subtitle: string | null;
  /** The booking bar. */
  children: ReactNode;
}) {
  return (
    <div className="relative isolate flex h-svh max-h-225 min-h-160 flex-col justify-between overflow-hidden bg-teal pt-16 pb-dock">
      <div data-scroll="fade" className="absolute inset-0 -z-20">
        <Reveal kind="photo" className="absolute inset-0">
          {image ? (
            <img
              src={image.url}
              alt={image.alt}
              width={image.width ?? undefined}
              height={image.height ?? undefined}
              fetchPriority="high"
              decoding="async"
              className="size-full object-cover"
            />
          ) : null}
        </Reveal>
      </div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-b from-ink/55 via-ink/30 to-ink/60" />
      <PageShell className="flex flex-1 items-center justify-center">
        <Reveal kind="bar" className="grid justify-items-center gap-3 text-center text-ivory">
          <p className="m-0 text-caption uppercase tracking-kicker text-ivory ar:normal-case ar:tracking-normal">{eyebrow}</p>
          <h1 className="m-0 font-display text-hero tracking-display text-ivory text-balance">{title}</h1>
          {subtitle ? <p className="m-0 font-display text-title text-ivory">{subtitle}</p> : null}
        </Reveal>
      </PageShell>
      <PageShell className="pb-8">{children}</PageShell>
    </div>
  );
}

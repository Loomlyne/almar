import type { ReactNode } from "react";
import { PinIcon } from "../../icons/icons";
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
      {/* Framer's veil: an even dark wash over the photo, a little deeper at the foot under the bar. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/45" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-ink/30 to-transparent" />
      {/* The title block is centred on the whole hero, as on the live page, not on the room left by the bar. */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center px-4 md:px-8">
        <Reveal kind="bar" className="pointer-events-auto grid max-w-column justify-items-center gap-3 text-center text-ivory">
          <p className="m-0 inline-flex items-center gap-2 text-caption uppercase tracking-kicker text-ivory ar:normal-case ar:tracking-normal">
            <PinIcon size={16} aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 className="m-0 font-display text-hero tracking-display text-ivory text-balance">{title}</h1>
          {subtitle ? <p className="m-0 font-display text-title text-ivory">{subtitle}</p> : null}
        </Reveal>
      </div>
      <div />
      <PageShell className="pb-8">{children}</PageShell>
    </div>
  );
}

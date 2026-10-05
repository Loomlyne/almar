import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type ScrollCollageImage = { src: string; alt: string };

// Where each photo sits (design 12.1 row 2, measured on the live Framer About page): top as a share of the collage height
// (below md, then from md) and the inline offset, so Arabic mirrors. Written as whole class names so Tailwind finds them.
const SLOTS = [
  "top-2/25 end-3/50 md:top-1/20",
  "top-7/20 start-0 md:top-3/10",
  "top-57/100 end-0 md:top-12/25",
  "top-77/100 start-3/100 md:top-13/20",
  "top-87/100 end-3/50 md:top-39/50",
] as const;

/**
 * The About intro (A13): the caller's statement is held in the middle of the screen while five photos sit at scattered
 * places around it. From md each photo slides down into its place as it rises, tied to the scroll, by job 11's engine
 * (`data-scroll="drop"`, the same hook as the home Welcome photos, A9): MotionController writes the offset and never
 * under reduced motion; the server markup hides nothing, so with JavaScript off every photo stands in its place.
 * Below md the photos stand still (`max-md:translate-none!` outranks the engine's inline offset), as A9's photos are
 * not drawn at all on a phone.
 *
 * Decorative: every image keeps the alt it is given ("" for the About photos). Nothing inside can be focused or clicked.
 * The held content is the caller's. At most five images are drawn; none draws nothing.
 */
export function ScrollCollage({
  images,
  children,
  className,
}: {
  images: ScrollCollageImage[];
  children: ReactNode;
  className?: string;
}) {
  if (images.length === 0) return null;
  return (
    <div data-scroll-collage className={cn("relative h-375 md:h-575", className)}>
      <div className="sticky top-21/50 z-10 mx-auto max-w-100 px-4 text-center">{children}</div>
      {images.slice(0, SLOTS.length).map((image, index) => (
        <img
          key={`${image.src}-${index}`}
          src={image.src}
          alt={image.alt}
          decoding="async"
          loading="lazy"
          data-scroll="drop"
          className={cn("absolute aspect-5/6 w-42.5 object-cover max-md:translate-none! md:w-75", SLOTS[index])}
        />
      ))}
    </div>
  );
}

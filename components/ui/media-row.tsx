import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type MediaRowImage = { src: string; alt: string };

export type MediaRowProps = {
  title: string;
  body: ReactNode;
  image: MediaRowImage;
  className?: string;
};

/**
 * One row of a list of values (About, Our Values; design 12.1 row 5): the title and body at the inline start, the photo
 * at the inline end. One column below md (text, then photo), two equal columns from md, so Arabic mirrors. The title is
 * a span at the size of job 11's card title (`text-heading`), as MediaCard draws its own; the body is a paragraph.
 * The column gap is 64 px from md (the signed picture draws 80; the token check allows no step between 64 and 96).
 * No reveal inside: the caller applies A7 (`Reveal kind="row"`) as job 11's rows do. Decorative photo: the alt is given.
 */
export function MediaRow({ title, body, image, className }: MediaRowProps) {
  return (
    <div className={cn("grid items-center gap-6 text-start md:grid-cols-2 md:gap-16", className)}>
      <div className="grid max-w-90 content-center gap-3">
        <span className="font-display text-heading text-teal">{title}</span>
        <p className="m-0 text-body text-ink">{body}</p>
      </div>
      <img
        src={image.src}
        alt={image.alt}
        decoding="async"
        className="block aspect-3/2 w-full max-w-120 object-cover md:justify-self-end"
      />
    </div>
  );
}

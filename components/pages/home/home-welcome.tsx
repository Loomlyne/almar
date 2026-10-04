import { Reveal } from "../../ui/reveal";
import type { HomeBlocks } from "../../../lib/data/types";

// The Welcome section (11-DESIGN section 2): a centred letter that stays pinned while the five Welcome photos float past it
// on md and up, each sliding down into place with the scroll (A9). Below md the photos are not shown, as on the live phone
// page. Server component: the photos' motion is `data-scroll="drop"`, set by MotionController; the letter fades in once (A8).
//
// Layout: one grid cell holds both layers. The photo layer is as tall as Framer's section at its width
// (aspect 1440 / 2539) and the letter cell stretches to it; inside the cell the letter box is `sticky top-0 h-svh`, so it
// stays centred in the screen while the photos pass. The Reveal sits INSIDE the sticky box, never around it (a transformed
// ancestor would stop the sticking).

/**
 * Where each photo sits, measured on the live Framer page at 1440 (11-DESIGN measure/framer-home-1440.md): top and inline
 * start as a percentage of the section box, width 20.8% (300 of 1440), aspect 5/6. Percentages, so the layout holds at
 * 834 and 1440; `inset-inline-start` mirrors the sides in Arabic.
 */
export const WELCOME_PHOTO_SLOTS = [
  { top: "21.3%", start: "73.6%" },
  { top: "27.4%", start: "0%" },
  { top: "42.7%", start: "79.2%" },
  { top: "52.9%", start: "3%" },
  { top: "68.8%", start: "73.6%" },
] as const;

export function HomeWelcome({ welcome }: { welcome: HomeBlocks["welcome"] }) {
  return (
    <section id="welcome" aria-labelledby="welcome-heading" className="relative grid">
      <div
        className="pointer-events-none relative col-start-1 row-start-1 hidden md:block"
        style={{ aspectRatio: "1440 / 2539" }}
      >
        {welcome.images.slice(0, WELCOME_PHOTO_SLOTS.length).map((image, index) => (
          <img
            key={image.url}
            src={image.url}
            alt={image.alt}
            decoding="async"
            loading="lazy"
            data-scroll="drop"
            className="absolute aspect-5/6 object-cover"
            style={{
              top: WELCOME_PHOTO_SLOTS[index].top,
              insetInlineStart: WELCOME_PHOTO_SLOTS[index].start,
              width: "20.8%",
            }}
          />
        ))}
      </div>

      <div className="col-start-1 row-start-1">
        <div className="py-16 md:sticky md:top-0 md:flex md:h-svh md:items-center md:justify-center md:py-0">
          <Reveal kind="letter" className="mx-auto grid max-w-sm justify-items-center gap-6 px-4 text-center xl:max-w-xl">
            <p className="m-0 text-label text-teal md:text-body">{welcome.kicker}</p>
            <h2 id="welcome-heading" className="m-0 font-display text-display text-teal">
              {welcome.heading}
            </h2>
            <div className="grid gap-4 text-caption text-ink md:text-label">
              <p className="m-0">{welcome.salutation}</p>
              {welcome.paragraphs.map((paragraph, index) => (
                <p key={index} className="m-0">
                  {paragraph}
                </p>
              ))}
              <p className="m-0">{welcome.sign_off}</p>
            </div>
            <div className="grid justify-items-center gap-2">
              {welcome.signature ? (
                <img
                  src={welcome.signature.url}
                  alt={welcome.signature.alt}
                  width={welcome.signature.width ?? undefined}
                  height={welcome.signature.height ?? undefined}
                  decoding="async"
                  className="block h-auto w-32"
                />
              ) : null}
              <p className="m-0 font-display text-title text-teal">{welcome.signer}</p>
              <p className="m-0 text-caption text-muted">{welcome.signer_role}</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

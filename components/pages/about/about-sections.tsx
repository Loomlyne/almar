import { BackgroundMedia } from "../../ui/background-media";
import { LinkButton } from "../../ui/button";
import { MediaCard } from "../../ui/card";
import { MediaRow } from "../../ui/media-row";
import { PageShell } from "../../ui/page-shell";
import { Reveal } from "../../ui/reveal";
import { ScrollCollage } from "../../ui/scroll-collage";
import { SectionHead } from "../../ui/section";
import type { AboutCard, ImageRef } from "../../../lib/data/types";

// The sections of the About page, in the order the page uses them (design 12.1). Each is built from job 11's parts
// (Reveal, SectionHead, MediaCard, LinkButton, BackgroundMedia), plan 21's ScrollCollage and MediaRow, PageShell and
// plain markup: nothing here draws a card, a divider, a button or a heading block that those already draw. Every
// string and every address arrives as a prop. No form, no input, no video, no slideshow, no ALMAR mark on this page.

const HERO_ID = "about-hero-heading";
const GET_IN_TOUCH_ID = "about-get-in-touch-heading";

/** The line under a centred heading: 400 px wide, as the live page sets it (design 12.1 rows 4, 5 and 7). */
const LEAD = "mx-auto block max-w-100";

/**
 * Row 1. A 900 px photo band (640 below 48rem) with one photo, the centred kicker and the page's only h1 on top.
 * One photo and no dots: an automatic slideshow would need a pause button (design 12.1). A1 brings the photo in on load,
 * A3 the headline, A10 fades the photo as the page scrolls away. The header sits over the top of it (nav tone on-image).
 */
export function AboutHero({ kicker, headline, image }: { kicker: string; headline: string; image: ImageRef | null }) {
  return (
    <section
      aria-labelledby={HERO_ID}
      className="relative isolate grid h-160 place-items-center overflow-hidden bg-teal text-ivory md:h-225"
    >
      <div data-scroll="fade" className="absolute inset-0 -z-20">
        <Reveal kind="photo" className="absolute inset-0">
          <BackgroundMedia poster={image ? { src: image.url, alt: image.alt } : null} />
        </Reveal>
      </div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/35" />
      <PageShell>
        <Reveal kind="headline" className="grid justify-items-center gap-6 text-center">
          <p className="m-0 text-label text-ivory md:text-body">{kicker}</p>
          <h1 id={HERO_ID} className="m-0 max-w-4xl font-display text-hero tracking-display text-ivory text-balance">
            {headline}
          </h1>
        </Reveal>
      </PageShell>
    </section>
  );
}

/**
 * Row 2. The statement is held in the middle of the screen while the five intro photos drift into their places as the
 * page scrolls (A13, plan 21's ScrollCollage on job 11's engine). Nothing else is drawn here.
 */
export function AboutIntro({ statement, images }: { statement: string; images: ImageRef[] }) {
  return (
    <section data-about-intro>
      <ScrollCollage images={images.map((image) => ({ src: image.url, alt: image.alt }))}>
        <p className="m-0 text-body text-teal">{statement}</p>
      </ScrollCollage>
    </section>
  );
}

/** Row 3. The full-width still (900 px tall from 48rem, 420 below). Nothing when the data has none. */
export function AboutStill({ image }: { image: ImageRef | null }) {
  if (!image) return null;
  return (
    <img
      data-about-still
      src={image.url}
      alt={image.alt}
      decoding="async"
      loading="lazy"
      className="block h-105 w-full object-cover md:h-225"
    />
  );
}

/** Row 4. Centred heading and line, then the story cards: one column below 48rem, three from it. Nothing without cards. */
export function AboutStory({
  heading,
  intro,
  cards,
}: {
  heading: string;
  intro: string;
  cards: AboutCard[];
}) {
  const shown = cards.filter((card) => card.image);
  if (shown.length === 0) return null;
  return (
    <section id="story" aria-labelledby="about-story-heading">
      <PageShell className="py-16 md:py-section">
        <SectionHead
          tone="plain"
          align="center"
          heading={heading}
          headingId="about-story-heading"
          intro={<span className={LEAD}>{intro}</span>}
        />
        <ul className="m-0 mt-12 grid list-none grid-cols-1 gap-12 p-0 md:grid-cols-3 md:gap-16">
          {shown.map((card) => (
            <Reveal as="li" kind="row" key={card.slug} className="min-w-0">
              <MediaCard
                image={{ src: card.image!.url, alt: card.image!.alt }}
                title={card.title}
                titleSize="heading"
                ratio={1.08}
                zoom="sm"
                detail={card.body}
              />
            </Reveal>
          ))}
        </ul>
      </PageShell>
    </section>
  );
}

/** Row 5. Centred heading and line, then one row per value: text at the inline start, photo at the end. Nothing without cards. */
export function AboutValues({
  heading,
  intro,
  cards,
}: {
  heading: string;
  intro: string;
  cards: AboutCard[];
}) {
  const shown = cards.filter((card) => card.image);
  if (shown.length === 0) return null;
  return (
    <section id="values" aria-labelledby="about-values-heading">
      <PageShell className="py-16 md:py-section">
        <SectionHead
          tone="plain"
          align="center"
          heading={heading}
          headingId="about-values-heading"
          intro={<span className={LEAD}>{intro}</span>}
        />
        <div className="mt-12 grid gap-12">
          {shown.map((card) => (
            <Reveal kind="row" key={card.slug}>
              <MediaRow
                title={card.title}
                body={card.body}
                image={{ src: card.image!.url, alt: card.image!.alt }}
              />
            </Reveal>
          ))}
        </div>
      </PageShell>
    </section>
  );
}

/**
 * Row 7. The closing band on the still photo (900 px tall from 48rem, 560 below): the centred heading in ivory, one line
 * and job 11's outlined button, a link to the Contact page. Without the still the band is teal with the same content.
 */
export function GetInTouch({
  heading,
  intro,
  cta,
  href,
  image,
}: {
  heading: string;
  intro: string;
  cta: string;
  href: string;
  image: ImageRef | null;
}) {
  return (
    <section
      id="get-in-touch"
      aria-labelledby={GET_IN_TOUCH_ID}
      className="relative isolate grid h-140 place-items-center overflow-hidden bg-teal text-ivory md:h-225"
    >
      <BackgroundMedia poster={image ? { src: image.url, alt: image.alt } : null} />
      <div aria-hidden="true" className="absolute inset-0 bg-ink/35" />
      <PageShell className="relative">
        <Reveal kind="heading" className="grid justify-items-center gap-6 text-center">
          <h2 id={GET_IN_TOUCH_ID} className="m-0 font-display text-hero tracking-display text-ivory text-balance">
            {heading}
          </h2>
          <p className="m-0 max-w-100 text-label md:text-body">{intro}</p>
        </Reveal>
        <Reveal kind="button" className="mt-6 grid justify-items-center">
          <LinkButton variant="ivory" size="lg" href={href}>
            {cta}
          </LinkButton>
        </Reveal>
      </PageShell>
    </section>
  );
}

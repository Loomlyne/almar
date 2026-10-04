import { useId } from "react";
import { PageShell } from "../../ui/page-shell";
import { Reveal } from "../../ui/reveal";
import { SectionHead } from "../../ui/section";
import { Slider } from "../../ui/slider";
import type { HomeBlocks } from "../../../lib/data/types";
import type { HomePageCopy } from "../../../lib/copy/home-page";

// Colombia, Beautifully Captured (11-DESIGN section 3): a centred head over a full-bleed strip of the gallery photos with
// previous/next arrows, one dot per two photos, swipe, and no autoplay (the live strip does not move by itself).

export function HomeGallery({ gallery, labels }: { gallery: HomeBlocks["gallery"]; labels: HomePageCopy["gallery"] }) {
  const headingId = useId();
  return (
    <section id="gallery" aria-labelledby={headingId} className="grid grid-cols-1 gap-12 py-16 md:py-section">
      <PageShell>
        <SectionHead tone="plain" align="center" kicker={gallery.kicker} heading={gallery.heading} headingId={headingId} />
      </PageShell>
      <Reveal kind="row">
        <Slider
          layout="strip"
          dotsEvery={2}
          images={gallery.images.map((image) => ({ src: image.url, alt: image.alt }))}
          labels={{
            region: gallery.heading,
            previous: labels.previous,
            next: labels.next,
            goTo: labels.goTo,
            slide: labels.slide,
          }}
        />
      </Reveal>
    </section>
  );
}

import { useId } from "react";
import { TeamSection } from "../../journey/team-section";
import { BackgroundMedia } from "../../ui/background-media";
import { LinkButton } from "../../ui/button";
import { MediaCard } from "../../ui/card";
import { PageShell } from "../../ui/page-shell";
import { Reveal } from "../../ui/reveal";
import { Section } from "../../ui/section";
import { cn } from "../../../lib/cn";
import type { CatalogItem, Destination, HomeStory, ImageRef, TeamMember } from "../../../lib/data/types";

// The server-rendered sections of the home page, in the order the page uses them (design 1.1). Each is built
// from the shared primitives only: a section never draws a heading or a card that Section or MediaCard
// already draws. Every string arrives as a prop; every address is built by the page and passed in.

type Copy<K extends string> = Record<K, string>;

export function Services({
  items,
  hrefs,
  viewAllHref,
  copy,
}: {
  items: CatalogItem[];
  /** The address of each service card, by slug. */
  hrefs: Record<string, string>;
  viewAllHref: string;
  copy: Copy<"kicker" | "heading" | "intro" | "viewAll">;
}) {
  const cards = items.filter((item) => item.image);
  return (
    <Section
      id="services"
      variant="page"
      kicker={copy.kicker}
      heading={copy.heading}
      intro={copy.intro}
      action={
        <LinkButton variant="outline" size="lg" href={viewAllHref}>
          {copy.viewAll}
        </LinkButton>
      }
    >
      <Reveal kind="row">
        <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-3">
          {cards.map((item, index) => (
            <li key={item.slug} className={index >= 2 ? "hidden min-w-0 md:block" : "min-w-0"}>
              <MediaCard
                href={hrefs[item.slug]}
                image={{ src: item.image!.url, alt: item.image!.alt }}
                title={item.name}
                titleSize="heading"
                ratio={2 / 3}
                detail={item.summary ?? undefined}
              />
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

/** Curated Experiences: the destination cards are not links (the live cards are not, and /destinations/<slug> has no page). */
export function Moments({
  destinations,
  contactHref,
  copy,
}: {
  destinations: Destination[];
  contactHref: string;
  copy: Copy<"kicker" | "heading" | "intro" | "cta">;
}) {
  return (
    <Section
      id="experiences"
      variant="page"
      align="center"
      kicker={copy.kicker}
      heading={copy.heading}
      intro={copy.intro}
      action={
        <LinkButton variant="outline" size="lg" href={contactHref}>
          {copy.cta}
        </LinkButton>
      }
    >
      <Reveal kind="row">
        <div className="grid">
          {destinations.map((destination, index) =>
            destination.hero_image ? (
              <article key={destination.slug} className="grid min-w-0 md:grid-cols-2">
                <img
                  src={destination.hero_image.url}
                  alt={destination.hero_image.alt}
                  decoding="async"
                  className="block aspect-31/40 w-full object-cover"
                />
                <div
                  className={cn(
                    "grid content-center justify-items-center gap-6 bg-teal-tint/50 p-8 text-center",
                    index % 2 === 1 && "md:order-first",
                  )}
                >
                  <h3 className="m-0 font-display text-heading uppercase text-teal ar:normal-case">{destination.name}</h3>
                  {destination.inset_image ? (
                    <img
                      src={destination.inset_image.url}
                      alt={destination.inset_image.alt}
                      decoding="async"
                      className="hidden h-55 w-50 object-cover md:block"
                    />
                  ) : null}
                  {destination.summary ? (
                    <p className="m-0 max-w-xs text-label text-ink md:text-body">{destination.summary}</p>
                  ) : null}
                  {destination.nights_label ? (
                    <p className="m-0 text-label text-muted md:text-body">{destination.nights_label}</p>
                  ) : null}
                </div>
              </article>
            ) : null,
          )}
        </div>
      </Reveal>
    </Section>
  );
}

/** ALMAR Stories. With no published story the whole section is omitted (SITE-02). */
export function Stories({
  stories,
  hrefs,
  readAllHref,
  copy,
}: {
  stories: HomeStory[];
  hrefs: Record<string, string>;
  readAllHref: string;
  copy: Copy<"kicker" | "heading" | "intro" | "readAll">;
}) {
  if (stories.length === 0) return null;
  return (
    <Section
      id="stories"
      variant="page"
      kicker={copy.kicker}
      heading={copy.heading}
      intro={copy.intro}
      action={
        <LinkButton variant="outline" size="lg" href={readAllHref}>
          {copy.readAll}
        </LinkButton>
      }
    >
      <Reveal kind="row">
        <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-3">
          {stories.map((story) =>
            story.image ? (
              <li key={story.slug} className="min-w-0">
                <MediaCard
                  href={hrefs[story.slug]}
                  image={{ src: story.image.url, alt: story.image.alt }}
                  title={story.title}
                  titleSize="title"
                  ratio={2 / 3}
                  zoom="sm"
                  detail={
                    <>
                      {story.excerpt ? <span className="block">{story.excerpt}</span> : null}
                      {story.date_label ? <span className="mt-2 block text-caption">{story.date_label}</span> : null}
                    </>
                  }
                />
              </li>
            ) : null,
          )}
        </ul>
      </Reveal>
    </Section>
  );
}

export function Begin({
  contactHref,
  copy,
  media,
}: {
  contactHref: string;
  copy: Copy<"heading" | "intro" | "cta">;
  media: { poster: ImageRef | null; video_url: string | null };
}) {
  const headingId = useId();
  return (
    <section
      id="begin"
      aria-labelledby={headingId}
      className="relative isolate grid min-h-90 place-items-center overflow-hidden bg-teal text-ivory md:min-h-150"
    >
      <BackgroundMedia
        poster={media.poster ? { src: media.poster.url, alt: media.poster.alt } : null}
        videoUrl={media.video_url}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-ink/30" />
      <PageShell className="relative py-16">
        <Reveal kind="heading" className="grid justify-items-center gap-6 text-center">
          <h2 id={headingId} className="m-0 font-display text-hero tracking-display text-ivory">
            {copy.heading}
          </h2>
          <p className="m-0 max-w-md text-label md:text-body">{copy.intro}</p>
        </Reveal>
        <Reveal kind="button" className="mt-6 grid justify-items-center">
          <LinkButton variant="ivory" size="lg" href={contactHref}>
            {copy.cta}
          </LinkButton>
        </Reveal>
      </PageShell>
    </section>
  );
}

/** Meet the Team: published members only. With none, nothing is rendered, kicker and heading included (D-55). */
export function Team({ members, copy }: { members: TeamMember[]; copy: Copy<"kicker" | "heading"> }) {
  if (members.length === 0) return null;
  return (
    <div className="grid gap-3 py-16 md:py-section">
      <p className="m-0 text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
        {copy.kicker}
      </p>
      <TeamSection
        title={copy.heading}
        members={members.map((member) => ({
          id: member.id,
          name: member.name,
          role: member.role ?? "",
          photo: member.photo ? { src: member.photo.url, alt: member.photo.alt } : undefined,
        }))}
      />
    </div>
  );
}

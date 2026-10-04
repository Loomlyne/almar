import type { ReactNode } from "react";
import { TeamSection } from "../../journey/team-section";
import { MediaCard } from "../../ui/card";
import { Link } from "../../ui/link";
import { Section } from "../../ui/section";
import type { CatalogItem, Destination, HomeStory, TeamMember } from "../../../lib/data/types";

// The server-rendered sections of the home page, in the order the page uses them (design 1.1). Each is built
// from the shared primitives only: a section never draws a heading or a card that Section or MediaCard
// already draws. Every string arrives as a prop; every address is built by the page and passed in.

type Copy<K extends string> = Record<K, string>;

/** Two muted lines under a card title: the first is the fact, the second the published sentence. */
function twoLines(first: string | null, second: string | null): ReactNode {
  if (!first && !second) return undefined;
  return (
    <>
      {first ? <span className="block">{first}</span> : null}
      {second ? <span className={first ? "mt-2 block" : "block"}>{second}</span> : null}
    </>
  );
}

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
  return (
    <Section
      id="services"
      kicker={copy.kicker}
      heading={copy.heading}
      intro={copy.intro}
      action={<Link href={viewAllHref}>{copy.viewAll}</Link>}
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-8 p-0 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) =>
          item.image ? (
            <li key={item.slug} className="min-w-0">
              <MediaCard
                href={hrefs[item.slug]}
                image={{ src: item.image.url, alt: item.image.alt }}
                title={item.name}
                detail={twoLines(null, item.summary)}
              />
            </li>
          ) : null,
        )}
      </ul>
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
      kicker={copy.kicker}
      heading={copy.heading}
      intro={copy.intro}
      action={<Link href={contactHref}>{copy.cta}</Link>}
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-8 p-0 md:grid-cols-2">
        {destinations.map((destination) =>
          destination.hero_image ? (
            <li key={destination.slug} className="min-w-0">
              <MediaCard
                image={{ src: destination.hero_image.url, alt: destination.hero_image.alt }}
                title={destination.name}
                detail={twoLines(destination.nights_label, destination.summary)}
              />
            </li>
          ) : null,
        )}
      </ul>
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
      kicker={copy.kicker}
      heading={copy.heading}
      intro={copy.intro}
      action={<Link href={readAllHref}>{copy.readAll}</Link>}
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-8 p-0 md:grid-cols-2 xl:grid-cols-3">
        {stories.map((story) =>
          story.image ? (
            <li key={story.slug} className="min-w-0">
              <MediaCard
                href={hrefs[story.slug]}
                image={{ src: story.image.url, alt: story.image.alt }}
                title={story.title}
                detail={twoLines(story.date_label, story.excerpt)}
              />
            </li>
          ) : null,
        )}
      </ul>
    </Section>
  );
}

export function Begin({ contactHref, copy }: { contactHref: string; copy: Copy<"heading" | "intro" | "cta"> }) {
  return (
    <Section id="begin" heading={copy.heading} intro={copy.intro} action={<Link href={contactHref}>{copy.cta}</Link>} />
  );
}

/** Meet the Team: published members only. With none, nothing is rendered, kicker and heading included (D-55). */
export function Team({ members, copy }: { members: TeamMember[]; copy: Copy<"kicker" | "heading"> }) {
  if (members.length === 0) return null;
  return (
    <div className="grid gap-3 border-t-2 border-gold pt-6">
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

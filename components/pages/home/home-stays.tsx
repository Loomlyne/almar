import { BedIcon, GuestIcon } from "../../icons/icons";
import { LinkButton } from "../../ui/button";
import { PortraitCard } from "../../ui/card";
import { Reveal } from "../../ui/reveal";
import { Section } from "../../ui/section";

// The Private Stays section (11-DESIGN section 4): the first published stays as portrait cards with the name on the photo,
// never filtered by the hero bar (Search does that job on the list page). Three cards from md, two below it, as Framer
// shows two at 390. View All Private Stays is an outline button to the plain list address.

/** What a card needs. Built by the page from a published stay. */
export type HomeStayCard = {
  slug: string;
  title: string;
  href: string;
  image: { src: string; alt: string };
  /** The published bed line, for example "5 double". */
  beds: string | null;
  /** The published guest line, for example "Up to 10 Guests". */
  guests: string | null;
};

export function HomeStays({
  stays,
  listHref,
  copy,
}: {
  /** The first published stays, in the owner's order. */
  stays: HomeStayCard[];
  /** This locale's list page, without a query. */
  listHref: string;
  copy: { kicker: string; heading: string; intro: string; viewAll: string };
}) {
  return (
    <Section
      id="stays"
      variant="page"
      kicker={copy.kicker}
      heading={copy.heading}
      intro={copy.intro}
      action={
        <LinkButton variant="outline" size="lg" href={listHref}>
          {copy.viewAll}
        </LinkButton>
      }
    >
      <Reveal kind="row">
        <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-3">
          {stays.map((stay, index) => (
            <li key={stay.slug} className={index >= 2 ? "hidden min-w-0 md:block" : "min-w-0"}>
              <PortraitCard
                href={stay.href}
                image={stay.image}
                title={stay.title}
                facts={[
                  ...(stay.beds ? [{ icon: <BedIcon size={16} />, text: stay.beds }] : []),
                  ...(stay.guests ? [{ icon: <GuestIcon size={16} />, text: stay.guests }] : []),
                ]}
              />
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

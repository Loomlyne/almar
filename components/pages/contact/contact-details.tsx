import type { ReactNode } from "react";
import { ArrowIcon, HeadsetIcon, MailIcon, PinIcon } from "../../icons/icons";
import { LinkButton } from "../../ui/button";
import { Link } from "../../ui/link";
import { Reveal } from "../../ui/reveal";
import { SectionHead } from "../../ui/section";
import type { ContactPageCopy } from "../../../lib/copy/contact-page";
import type { ContactDetails } from "../../../lib/data/types";
import type { ContactLinks } from "./contact-links";

// The start column of the Contact page (design 12.2, row 2): the business name, Framer's three groups with an icon
// each (Location, Phone with its two numbers, Email once) and `Message on WhatsApp` under them. Server component, no
// state. Every address arrives built and validated by contactLinks; every string arrives as a prop. The motion is
// job 11's Reveal: the heading block is a Reveal heading (A5) through SectionHead, each group a Reveal row (A7), the
// button a Reveal button (A6). Nothing here hides itself: the start state lives behind `pre-reveal`.

/** The arrow after a detail link, turned to point up and outward: up-right in LTR, up-left in RTL. Decorative. */
function Outward() {
  return <ArrowIcon size={16} className="shrink-0 -rotate-45 rtl:rotate-45 rtl:-scale-x-100" />;
}

function NewTab({ label }: { label: string }) {
  return <span className="sr-only"> {label}</span>;
}

function Group({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Reveal kind="row" className="grid gap-1">
      <dt className="m-0 flex items-center gap-2 font-body text-body text-teal">
        {icon}
        {label}
      </dt>
      {children}
    </Reveal>
  );
}

const DD = "m-0 grid justify-items-start gap-0";
const LINK = "w-max gap-2 text-body";
// The address is whatever Dashboard > Settings holds: no w-max, so the link can shrink to its column, and break-all, so
// a long address wraps instead of widening the page. A short one is laid out exactly as with w-max.
const EMAIL_LINK = "gap-2 text-body break-all";
const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

export function ContactDetailsBlock({
  details,
  links,
  copy,
}: {
  details: ContactDetails;
  links: ContactLinks;
  copy: ContactPageCopy;
}) {
  return (
    <div className="grid content-start gap-6">
      <SectionHead tone="plain" heading={details.business_name} headingId="contact-details-heading" />
      <dl className="m-0 grid gap-6">
        <Group icon={<PinIcon size={16} className="shrink-0" />} label={copy.details.location}>
          <dd className={DD}>
            <Link href={links.location} className={LINK} {...NEW_TAB}>
              {details.location_label}
              <Outward />
              <NewTab label={copy.newTab} />
            </Link>
          </dd>
        </Group>
        <Group icon={<HeadsetIcon size={16} className="shrink-0" />} label={copy.details.phone}>
          <dd className={DD}>
            <small className="text-label text-teal">{copy.details.inquiryLine}</small>
            <Link href={links.tel} className={LINK}>
              <bdi>{details.phone_display}</bdi>
              <Outward />
            </Link>
          </dd>
          <dd className={DD}>
            <small className="text-label text-teal">{copy.details.whatsapp}</small>
            <Link href={links.whatsapp} className={LINK} {...NEW_TAB}>
              <bdi>{details.phone_display}</bdi>
              <Outward />
              <NewTab label={copy.newTab} />
            </Link>
          </dd>
        </Group>
        <Group icon={<MailIcon size={16} className="shrink-0" />} label={copy.details.email}>
          <dd className={DD}>
            <Link href={links.mailto} className={EMAIL_LINK}>
              <bdi>{details.email}</bdi>
              <Outward />
            </Link>
          </dd>
        </Group>
      </dl>
      <Reveal kind="button">
        <LinkButton variant="outline" href={links.whatsappMessage} {...NEW_TAB}>
          {copy.whatsappCta}
          <NewTab label={copy.newTab} />
        </LinkButton>
      </Reveal>
    </div>
  );
}

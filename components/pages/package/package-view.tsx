import type { ReactNode } from "react";
import { InclusionsList } from "../../journey/inclusions-list";
import { WhatsAppIcon } from "../../icons/icons";
import { Amount } from "../../ui/amount";
import { cn } from "../../../lib/cn";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import type { PackagePageCopy } from "../../../lib/copy/package-page";
import type { PublicPackage } from "../../../lib/data/journeys";
import { localePath, type Locale } from "../../../lib/locale-path";

// The package page's body as signed (pictures/06-06 package-full, package-no-legs): the photo with the name and the owner's
// price line, the description and facts, Your route, the Included panel of the stay pages (its existing words, no price, no
// remove control: ADDN-03), the request form in its slot, and the WhatsApp line as a text link. Props only, no fetch.
//
// The price line goes through Amount with no currency and no rates, so it prints exactly as the owner wrote it: nothing here
// computes an amount, and there is no pay, checkout or card anywhere on this page. Square corners; gold only as lines.

const SECTION = "mx-auto flex w-full max-w-column flex-col gap-4 px-4 py-10 md:px-10 md:py-16";
const H2 = "m-0 font-display text-display font-normal text-teal md:text-heading";
const LINK = "text-teal underline decoration-gold decoration-1 underline-offset-4";

export function PackageView({
  pkg,
  copy,
  locale,
  form,
  whatsappHref,
  newTabLabel,
}: {
  pkg: PublicPackage;
  copy: PackagePageCopy;
  locale: Locale;
  /** The request form (a client island), or its picture in a scene. */
  form: ReactNode;
  whatsappHref: string;
  /** The screen-reader suffix of a link that opens a new tab. */
  newTabLabel: string;
}) {
  const idealLabel = pkg.ideal_for_label ?? copy.ideal;
  const hasFacts = Boolean(pkg.duration_label || pkg.ideal_for);

  return (
    <main id="content">
      <section className="relative isolate flex min-h-110 items-end overflow-hidden bg-teal text-surface md:min-h-140">
        {pkg.image ? (
          <img
            src={pkg.image.url}
            alt={pkg.image.alt}
            width={pkg.image.width ?? undefined}
            height={pkg.image.height ?? undefined}
            decoding="async"
            className="absolute inset-0 -z-20 size-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-ink/65 to-ink/10 to-60%" aria-hidden="true" />
        <div className="mx-auto flex w-full max-w-column flex-col gap-3 px-4 py-6 md:px-10 md:py-12">
          <p className="m-0 text-caption uppercase tracking-kicker ar:normal-case ar:tracking-normal">{copy.kicker}</p>
          <h1 className="m-0 text-balance font-display text-hero font-normal md:text-display lg:text-hero">{pkg.name}</h1>
          <p data-price={pkg.slug} className="m-0 font-display text-title">
            <Amount text={pkg.price_label} selected={null} rates={null} locale={locale} />
          </p>
          {pkg.tagline ? <p className="m-0 text-body">{pkg.tagline}</p> : null}
        </div>
      </section>

      {pkg.body || hasFacts ? (
        <section className={cn(SECTION, "gap-6")}>
          {pkg.body ? <p className="m-0 max-w-160 text-body text-ink">{pkg.body}</p> : null}
          {hasFacts ? (
            <dl className="m-0 flex flex-wrap gap-x-8 gap-y-2 text-body text-ink">
              {pkg.duration_label ? (
                <div className="grid gap-0.5">
                  <dt className="text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">{copy.dur}</dt>
                  <dd className="m-0">{pkg.duration_label}</dd>
                </div>
              ) : null}
              {pkg.ideal_for ? (
                <div className="grid gap-0.5">
                  <dt className="text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">{idealLabel}</dt>
                  <dd className="m-0">{pkg.ideal_for}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </section>
      ) : null}

      {pkg.legs.length > 0 ? (
        <section className={SECTION}>
          <h2 className={H2}>{copy.route}</h2>
          <ol className="m-0 grid max-w-calendar list-none p-0">
            {pkg.legs.map((leg, index) => (
              <li key={leg.id} className="grid grid-cols-[48px_1fr] gap-4 border-t border-gold py-4 last:border-b">
                <span className="font-display text-display leading-none text-teal md:text-heading" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="grid gap-1">
                  <h3 className="m-0 font-display text-title font-normal text-teal">{leg.destination_name}</h3>
                  {leg.stay_slug && leg.stay_title ? (
                    <p className="m-0 text-label text-muted">
                      {copy.stay}:{" "}
                      <a href={localePath(locale, `/private-stays/${leg.stay_slug}`)} className={LINK}>
                        {leg.stay_title}
                      </a>
                    </p>
                  ) : null}
                  {leg.nights_label ? <p className="m-0 text-body text-ink">{leg.nights_label}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {pkg.addons.length > 0 ? (
        <section className={cn(SECTION, "pt-0 md:pt-0")}>
          <InclusionsList
            items={pkg.addons.map((addon) => ({ id: addon.item_id, label: addon.name }))}
            variant="panel"
            locale={locale}
            copy={JOURNEY_COPY[locale]}
            className="max-w-calendar"
          />
        </section>
      ) : null}

      <section className={SECTION}>
        <h2 className={H2}>{copy.reqHeading}</h2>
        <p className="m-0 max-w-160 text-body text-ink">{copy.reqIntro}</p>
        <div className="grid max-w-220 gap-6">{form}</div>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={cn("inline-flex min-h-control w-max max-w-full items-center gap-1 text-body", LINK)}>
          <WhatsAppIcon size={20} className="shrink-0" aria-hidden="true" />
          {copy.wa}
          <span className="sr-only"> {newTabLabel}</span>
        </a>
      </section>
    </main>
  );
}

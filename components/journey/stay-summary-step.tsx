import type { BookingReason } from "../../lib/booking/types";
import { formatPlural } from "../../lib/journey-format";
import { cn } from "../../lib/cn";
import { WhatsAppIcon } from "../icons/icons";
import { Button } from "../ui/button";
import { BookingReasons } from "./booking-reasons";
import type { ImageRef, JourneyCopy, Locale } from "./types";

export type StaySummaryStepProps = {
  image: ImageRef | null;
  title: string;
  destinationName: string;
  /** Display string, for example "[DD/MM/YYYY] – [DD/MM/YYYY]". Rendered left to right inside the Arabic page. */
  dates: string;
  /** Display string, for example "2 adults". */
  guests: string;
  nights: number;
  /** The stay page in the guest's language: where Change and every reason lead. */
  stayHref: string;
  /** wa.me link for a different destination (BOOK-04), built with lib/whatsapp-request.ts. */
  elsewhereHref: string;
  reasons: BookingReason[];
  loading?: boolean;
  onContinue: () => void;
  copy: JourneyCopy;
  locale: Locale;
  className?: string;
};

const KICKER = "text-caption text-muted uppercase tracking-kicker ar:normal-case ar:tracking-normal";

/** Step 1: the stay as chosen on the stay page, locked here. Dates and guests change only on the stay page. */
export function StaySummaryStep({
  image,
  title,
  destinationName,
  dates,
  guests,
  nights,
  stayHref,
  elsewhereHref,
  reasons,
  loading = false,
  onContinue,
  copy,
  locale,
  className,
}: StaySummaryStepProps) {
  const t = copy.trip;
  const blocked = reasons.length > 0;
  return (
    <section aria-labelledby="stay-summary-title" className={cn("flex flex-col gap-6", className)}>
      <h2 id="stay-summary-title" className="m-0">
        {t.stay.title}
      </h2>
      <div className="flex flex-col gap-4 border border-line bg-surface p-4 sm:flex-row sm:p-6">
        {image ? (
          <img
            src={image.src}
            alt={image.alt}
            className="aspect-video w-full object-cover outline outline-1 -outline-offset-1 outline-ink/10 sm:aspect-4/3 sm:w-64 sm:shrink-0"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className={cn("m-0", KICKER)}>{destinationName}</p>
            <h3 className="m-0 font-display text-title text-teal">{title}</h3>
          </div>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-label">
            <dt className="text-muted">{copy.bar.dates.label}</dt>
            <dd className="m-0 tabular-nums">
              <bdi dir="ltr">{dates}</bdi> · {formatPlural(copy.dates.nights, nights, locale)}
            </dd>
            <dt className="text-muted">{copy.guests.label}</dt>
            <dd className="m-0">{guests}</dd>
          </dl>
          <a
            href={stayHref}
            className="self-start text-label text-teal underline decoration-gold decoration-1 underline-offset-4"
          >
            {t.stay.change}
          </a>
        </div>
      </div>

      {blocked ? <BookingReasons reasons={reasons} backHref={stayHref} copy={copy} locale={locale} /> : null}

      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-ink">
        <span>{t.stay.elsewhereLead}</span>
        <a
          href={elsewhereHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-teal underline decoration-gold decoration-1 underline-offset-4"
        >
          <WhatsAppIcon size={16} aria-hidden="true" />
          <span>{t.stay.elsewhereLink}</span>
        </a>
      </p>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onContinue} disabled={blocked || loading} busy={loading}>
          {t.stay.continue}
        </Button>
      </div>
    </section>
  );
}

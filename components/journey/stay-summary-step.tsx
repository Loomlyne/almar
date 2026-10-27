import type { BookingReason } from "../../lib/booking/types";
import { formatPlural } from "../../lib/journey-format";
import { Button } from "../ui/button";
import { Link } from "../ui/link";
import { BookingReasons, type BookingReasonLinks } from "./booking-reasons";
import type { ImageRef, JourneyCopy, Locale } from "./types";

// Plan 04-03 (signed 2026-10-25), step 1: the stay as the server quoted it, its reasons, the one-destination line
// with its WhatsApp link (BOOK-04) and Continue. Every value arrives as a display string; nothing is fetched here.

export type StaySummaryStepProps = {
  stay: {
    title: string;
    destinationName: string;
    image: ImageRef | null;
    /** "DD/MM/YYYY – DD/MM/YYYY". */
    dates: string;
    /** "2 adults, 1 child". */
    guests: string;
    nights: number;
  } | null;
  reasons: BookingReason[];
  reasonLinks: BookingReasonLinks;
  changeHref: string;
  secondCityHref: string;
  onContinue: () => void;
  continueDisabled: boolean;
  /** Below md the cart dock's Continue replaces this one (signed Q-02/drawer choice). */
  hideContinueOnPhone?: boolean;
  copy: JourneyCopy;
  locale: Locale;
};

export function StaySummaryStep({
  stay,
  reasons,
  reasonLinks,
  changeHref,
  secondCityHref,
  onContinue,
  continueDisabled,
  hideContinueOnPhone = true,
  copy,
  locale,
}: StaySummaryStepProps) {
  const s = copy.summary;
  return (
    <section className="flex flex-col gap-6" aria-labelledby="trip-step-stay">
      <h2 id="trip-step-stay" className="m-0 font-display text-title text-teal">
        {copy.trip.stepTitle.stay}
      </h2>
      {stay ? (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {stay.image ? (
            <img
              src={stay.image.src}
              alt={stay.image.alt}
              className="w-full aspect-4/3 object-cover outline outline-1 -outline-offset-1 outline-ink/10"
            />
          ) : (
            <div aria-hidden="true" className="w-full aspect-4/3 bg-ivory outline outline-1 -outline-offset-1 outline-ink/10" />
          )}
          <div className="flex flex-col gap-2">
            <p className="m-0 text-caption text-muted uppercase tracking-kicker ar:normal-case ar:tracking-normal">
              {stay.destinationName}
            </p>
            <h3 className="m-0 font-display text-title text-teal">{stay.title}</h3>
            <p className="m-0 text-label text-ink">
              <bdi dir="ltr">{stay.dates}</bdi> · {stay.guests}
            </p>
            <p className="m-0 text-label text-muted">{formatPlural(copy.cart.stay, stay.nights, locale)}</p>
            <Link href={changeHref} className="self-start">
              {s.changeOnStay}
            </Link>
          </div>
        </div>
      ) : null}
      <BookingReasons reasons={reasons} copy={copy} locale={locale} links={reasonLinks} live="assertive" />
      <p className="m-0 flex flex-wrap items-center gap-x-2 text-label text-ink">
        <span>{s.oneDestination}</span>
        <Link href={secondCityHref} target="_blank" rel="noopener noreferrer">
          {s.secondCity}
        </Link>
      </p>
      <div className={hideContinueOnPhone ? "hidden md:flex" : "flex"}>
        <Button onClick={onContinue} disabled={continueDisabled}>
          {s.continue}
        </Button>
      </div>
    </section>
  );
}

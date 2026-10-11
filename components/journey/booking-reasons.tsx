import type { BookingReason } from "../../lib/booking/types";
import { fill, formatPlural } from "../../lib/journey-format";
import { cn } from "../../lib/cn";
import { AlertCircleIcon } from "../icons/icons";
import { LinkButton } from "../ui/button";
import type { JourneyCopy, Locale } from "./types";

export type BookingReasonsProps = {
  reasons: BookingReason[];
  /** The stay page in the guest's language: the way back for every reason (B-02). */
  backHref: string;
  copy: JourneyCopy;
  locale: Locale;
  /** Shows the way back as a button. Off when the page already offers it next to the block. */
  showBack?: boolean;
  className?: string;
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-02" as "02/11/2026". Anything else is left as written. Display only, no date arithmetic. */
function showDate(iso: string): string {
  const m = ISO.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** One sentence for one reason, with its numbers. The server's reason is shown whatever it is (B-02). */
export function reasonLine(reason: BookingReason, copy: JourneyCopy, locale: Locale): string {
  const r = copy.trip.reasons;
  switch (reason.code) {
    case "sold_out":
      return fill(r.soldOut, { dates: (reason.nights ?? []).map(showDate).join(", ") });
    case "blocked":
      return fill(r.blocked, { dates: (reason.nights ?? []).map(showDate).join(", ") });
    case "below_min_nights":
      return formatPlural(r.belowMin, reason.min ?? 1, locale);
    case "over_max_guests":
      return formatPlural(r.overMax, reason.max ?? 1, locale);
    case "no_rate":
      return r.noRate;
    case "settings_missing":
      return r.settingsMissing;
    case "settings_changed":
      return r.settingsChanged;
    case "stay_unavailable":
      return r.stayUnavailable;
    case "dates_invalid":
      return r.datesInvalid;
    case "addon_unavailable":
      return r.addonUnavailable;
    case "addon_quantity":
      return fill(r.addonQuantity, { max: reason.max ?? 1 });
    case "deposit_unavailable":
      return r.depositUnavailable;
    case "below_minimum_charge":
      return r.belowMinimumCharge;
    case "hold_limit":
      return r.holdLimit;
    case "unavailable":
      return r.unavailable;
    case "invalid":
      return r.invalid;
    default:
      return r.generic;
  }
}

/**
 * Every reason a stay cannot be booked as chosen, one line each, with the way back to the stay page.
 * Never a silent hide (B-02, STAY-01, STAY-02). Renders nothing with no reasons.
 */
export function BookingReasons({ reasons, backHref, copy, locale, showBack = true, className }: BookingReasonsProps) {
  if (reasons.length === 0) return null;
  const r = copy.trip.reasons;
  return (
    <div
      role="alert"
      className={cn("flex flex-col gap-3 border border-error bg-surface p-4", className)}
      data-testid="booking-reasons"
    >
      <p className="m-0 flex items-center gap-2 font-display text-title text-ink">
        <AlertCircleIcon size={20} className="shrink-0 text-error" />
        <span>{r.heading}</span>
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body text-ink">
        {reasons.map((reason, i) => (
          <li key={`${reason.code}-${i}`}>{reasonLine(reason, copy, locale)}</li>
        ))}
      </ul>
      {showBack ? (
        <LinkButton href={backHref} variant="secondary" className="self-start">
          {r.back}
        </LinkButton>
      ) : null}
    </div>
  );
}

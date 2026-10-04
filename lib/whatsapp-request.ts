// The stay page's Request on WhatsApp message (11-DESIGN section 2, plan 03.3-45).
//
// Pure: no React, no browser access, no data-layer read. It takes only the names, the chosen dates and the guest
// counts, so no money field can reach the message (T-3.3-45-3). The wording comes in as copy.

import { formatDate } from "./format";
import { fill, formatPlural, type FormatLocale, type GuestSummaryForms, type PluralForms } from "./journey-format";

/** ALMAR's WhatsApp number as wa.me wants it: digits only (SITE-13). */
export const ALMAR_WHATSAPP_NUMBER = "971563883302";

export type RequestDay = { year: number; month: number; day: number };

export type StayRequestInput = {
  locale: FormatLocale;
  title: string;
  destinationName: string;
  start: RequestDay | null;
  end: RequestDay | null;
  adults: number;
  children: number;
  infants: number;
  /** The page's own absolute address in its language. */
  pageUrl: string;
};

export type StayRequestCopy = {
  greeting: string;
  dates: string;
  datesNone: string;
  guests: string;
  guestJoin: string;
};

const MS_PER_DAY = 86_400_000;

function nightsBetween(start: RequestDay, end: RequestDay): number {
  const a = Date.UTC(start.year, start.month - 1, start.day);
  const b = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((b - a) / MS_PER_DAY);
}

const fmt = (d: RequestDay) => formatDate(d.day, d.month, d.year);

/** The four lines, joined by a newline: greeting, dates (or "not chosen yet"), guests, the page address. */
export function buildStayRequestMessage(
  input: StayRequestInput,
  copy: StayRequestCopy,
  forms: { nights: PluralForms; guests: GuestSummaryForms },
): string {
  const { locale } = input;
  const dates =
    input.start && input.end
      ? fill(copy.dates, {
          from: fmt(input.start),
          to: fmt(input.end),
          nights: formatPlural(forms.nights, nightsBetween(input.start, input.end), locale),
        })
      : copy.datesNone;

  const parts: string[] = [];
  if (input.adults > 0) parts.push(formatPlural(forms.guests.adults, input.adults, locale));
  if (input.children > 0) parts.push(formatPlural(forms.guests.children, input.children, locale));
  if (input.infants > 0) parts.push(formatPlural(forms.guests.infants, input.infants, locale));

  return [
    fill(copy.greeting, { title: input.title, destination: input.destinationName }),
    dates,
    fill(copy.guests, { guests: parts.join(copy.guestJoin) }),
    input.pageUrl,
  ].join("\n");
}

/** The wa.me address that opens a chat with ALMAR and the message ready to send. */
export function stayRequestHref(message: string): string {
  return `https://wa.me/${ALMAR_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

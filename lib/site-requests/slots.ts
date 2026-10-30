// The consultation's times for a person (plan 06-05, SITE-06). Pure and a leaf: a slot is an ISO UTC instant; the guest reads
// it in her own zone with Dubai beside it. 24-hour, Latin digits in every language (as signed).

export type SlotLocale = "en" | "ar" | "es";

/** The signed picture's language tags; Arabic keeps the Gregorian calendar and Latin digits. */
export const SLOT_TAGS: Record<SlotLocale, string> = { en: "en-GB", ar: "ar-AE-u-ca-gregory-nu-latn", es: "es" };
export const DUBAI = "Asia/Dubai";

export type GroupedSlot = { start: string; local: string; dubai: string | null };
export type SlotDay = { day: string; slots: GroupedSlot[] };

/** True when Intl accepts `name` as a time zone. */
export function isTimeZone(name: string): boolean {
  if (typeof name !== "string" || name === "") return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** "HH:MM" of `iso` in `timeZone`. */
export function timeLabel(iso: string, timeZone: string, locale: SlotLocale): string {
  return new Intl.DateTimeFormat(SLOT_TAGS[locale], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(iso));
}

/** "HH:MM" in Dubai. */
export function dubaiLabel(iso: string, locale: SlotLocale): string {
  return timeLabel(iso, DUBAI, locale);
}

/** A long date of `iso` in `timeZone`, in the page's language. */
export function dateLabel(iso: string, timeZone: string, locale: SlotLocale, withYear = true): string {
  return new Intl.DateTimeFormat(SLOT_TAGS[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" as const } : {}),
    timeZone,
  }).format(new Date(iso));
}

/** The calendar day ("YYYY-MM-DD") of `iso` in `timeZone`. */
export function localDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/**
 * The slots by the guest's local day, in order, each with her time and Dubai's. A guest in Dubai has one time: no Dubai label.
 */
export function groupSlots(slots: readonly string[], timeZone: string, locale: SlotLocale): SlotDay[] {
  const days: SlotDay[] = [];
  for (const start of slots) {
    const day = localDay(start, timeZone);
    let bucket = days[days.length - 1];
    if (!bucket || bucket.day !== day) {
      bucket = { day, slots: [] };
      days.push(bucket);
    }
    bucket.slots.push({ start, local: timeLabel(start, timeZone, locale), dubai: timeZone === DUBAI ? null : dubaiLabel(start, locale) });
  }
  return days;
}

// Journey formatting helpers (plan 03.1-10, D-41). No imports so Node tests load it directly.
// Numbers are Western numerals in every locale, including Arabic.

export type FormatLocale = "en" | "ar" | "es";

export type PluralForms = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

export type GuestCounts = { adults: number; children: number; infants: number };

export type GuestSummaryForms = {
  adults: PluralForms;
  children: PluralForms;
  infants: PluralForms;
};

const NUMBER_LOCALE: Record<FormatLocale, string> = {
  en: "en",
  ar: "ar-AE-u-nu-latn",
  es: "es",
};

/** Pick the Intl.PluralRules form for n, fall back to `other`, replace `#` with the number. */
export function formatPlural(forms: PluralForms, n: number, locale: FormatLocale): string {
  const category = new Intl.PluralRules(NUMBER_LOCALE[locale]).select(n);
  const template = forms[category] ?? forms.other;
  return template.replace(/#/g, new Intl.NumberFormat(NUMBER_LOCALE[locale]).format(n));
}

/** Replace `{name}` slots; unknown slots are left as written. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/** "2 adults, 1 child, and 1 infant": non-zero groups only, locale plurals, locale list join. */
export function formatGuestSummary(
  counts: GuestCounts,
  locale: FormatLocale,
  forms: GuestSummaryForms,
): string {
  const parts: string[] = [];
  if (counts.adults > 0) parts.push(formatPlural(forms.adults, counts.adults, locale));
  if (counts.children > 0) parts.push(formatPlural(forms.children, counts.children, locale));
  if (counts.infants > 0) parts.push(formatPlural(forms.infants, counts.infants, locale));
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(parts);
}

"use client";

import { isDocumentLocale, setDocumentLocale } from "../../lib/set-document-locale";
import { Select, type SelectOption } from "./select";

const LOCALE_COOKIE = "almar-locale";

const LANGUAGES: readonly SelectOption[] = [
  { value: "en", code: "EN", label: "English" },
  { value: "ar", code: "AR", label: "العربية" },
  { value: "es", code: "ES", label: "Español" },
];

const CURRENCIES: readonly SelectOption[] = [
  { value: "AED", code: "AED", label: "AED" },
  { value: "USD", code: "USD", label: "USD" },
  { value: "EUR", code: "EUR", label: "EUR" },
];

/** Accessible-name templates, from the journey copy catalog: "Language: {name}" and "Currency: {code}". */
export type LocaleSelectCopy = { language: string; currency: string };

const DEFAULT_COPY: LocaleSelectCopy = { language: "Language: {name}", currency: "Currency: {code}" };

type Tone = "default" | "on-image";

/** Only a path on this site: starts with one slash, never a protocol-relative or backslash form. */
export function isSitePath(href: unknown): href is string {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !href.includes("\\");
}

/**
 * Language and currency are one component, two instances, on the shared Select.
 *
 * Without `hrefs` (the dashboard and guest screens) choosing a language sets the document language
 * in place. With `hrefs` (the public pages, one pre-built document per language) choosing a language
 * remembers it in the almar-locale cookie and navigates to `hrefs[next]`; the next document already
 * has the right lang and dir, so nothing is set here. A radix listbox row cannot be an anchor: the
 * crawlable, no-JavaScript language links are the footer's language row.
 */
export function LocaleSelect({
  kind,
  value,
  onChange,
  tone = "default",
  copy = DEFAULT_COPY,
  id,
  className,
  dir,
  hrefs,
  placeholder,
}: {
  kind: "language" | "currency";
  /** null = no choice yet (currency only): nothing is selected and choosing AED is a real change. */
  value: string | null;
  onChange?: (next: string) => void;
  tone?: Tone;
  copy?: LocaleSelectCopy;
  id?: string;
  className?: string;
  /** Radix does not read the document direction. The language kind derives it from its value. */
  dir?: "ltr" | "rtl";
  /** Language only: the address of the same page in each language, same-origin paths. */
  hrefs?: Record<string, string>;
  /** Shown while `value` is null. */
  placeholder?: string;
}) {
  const options = kind === "language" ? LANGUAGES : CURRENCIES;
  const direction = kind === "language" ? (value === "ar" ? "rtl" : "ltr") : (dir ?? "ltr");

  function choose(next: string) {
    if (kind === "language") {
      // Only en, ar, es are accepted; anything else is ignored (T-3.1-20).
      if (!isDocumentLocale(next)) return;
      if (hrefs) {
        const target = hrefs[next];
        // T-3.3-04: only a same-origin path is followed; anything else is ignored.
        if (!isSitePath(target)) return;
        document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
        window.location.assign(target);
        return;
      }
      setDocumentLocale(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
    onChange?.(next);
  }

  return (
    <Select
      value={value}
      options={options}
      onChange={choose}
      label={kind === "language" ? copy.language : copy.currency}
      placeholder={placeholder}
      tone={tone}
      dir={direction}
      id={id}
      className={className}
    />
  );
}

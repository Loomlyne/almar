"use client";

import { useState } from "react";
import { Select } from "radix-ui";
import { cn } from "../../lib/cn";
import { CheckIcon, ChevronIcon } from "../icons/icons";
import { isDocumentLocale, setDocumentLocale } from "../../lib/set-document-locale";

const LOCALE_COOKIE = "almar-locale";

const LANGUAGES = [
  { value: "en", code: "EN", name: "English" },
  { value: "ar", code: "AR", name: "العربية" },
  { value: "es", code: "ES", name: "Español" },
] as const;

const CURRENCIES = [
  { value: "AED", code: "AED", name: "AED" },
  { value: "USD", code: "USD", name: "USD" },
  { value: "EUR", code: "EUR", name: "EUR" },
] as const;

/** Accessible-name templates, from the journey copy catalog: "Language: {name}" and "Currency: {code}". */
export type LocaleSelectCopy = { language: string; currency: string };

const DEFAULT_COPY: LocaleSelectCopy = { language: "Language: {name}", currency: "Currency: {code}" };

type Tone = "default" | "on-image";

export function LocaleSelect({
  kind,
  value,
  onChange,
  tone = "default",
  copy = DEFAULT_COPY,
  id,
  className,
  dir,
}: {
  kind: "language" | "currency";
  value: string;
  onChange?: (next: string) => void;
  tone?: Tone;
  copy?: LocaleSelectCopy;
  id?: string;
  className?: string;
  /** Radix does not read the document direction. The language kind derives it from its value. */
  dir?: "ltr" | "rtl";
}) {
  const [open, setOpen] = useState(false);
  const options = kind === "language" ? LANGUAGES : CURRENCIES;
  const selected = options.find((option) => option.value === value) ?? options[0];
  const template = kind === "language" ? copy.language : copy.currency;
  const name = template.replace("{name}", selected.name).replace("{code}", selected.code);

  const direction = kind === "language" ? (selected.value === "ar" ? "rtl" : "ltr") : (dir ?? "ltr");

  function choose(next: string) {
    if (kind === "language") {
      // Only en, ar, es are accepted; anything else is ignored (T-3.1-20).
      if (!isDocumentLocale(next)) return;
      setDocumentLocale(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
    onChange?.(next);
  }

  return (
    <Select.Root dir={direction} value={selected.value} onValueChange={choose} open={open} onOpenChange={setOpen}>
      <Select.Trigger
        id={id}
        aria-label={name}
        className={cn(
          "inline-flex h-control min-w-24 cursor-pointer items-center justify-between gap-3 rounded-none border px-4 font-body text-caption uppercase tracking-kicker transition-colors duration-fast ease-standard",
          tone === "on-image"
            ? "border-ivory/70 bg-transparent text-ivory hover:border-ivory"
            : "border-muted bg-surface text-ink hover:border-ink",
          className,
        )}
      >
        <Select.Value>{selected.code}</Select.Value>
        <Select.Icon asChild>
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex size-3 items-center justify-center transition-transform duration-fast ease-standard rtl:-scale-x-100",
              open ? "-rotate-90" : "rotate-90",
            )}
          >
            <ChevronIcon size={16} className="size-3" />
          </span>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-70 min-w-(--radix-select-trigger-width) rounded-none border border-line bg-surface text-ink shadow-lg"
        >
          <Select.Viewport>
            {options.map((option) => {
              const isSelected = option.value === selected.value;
              return (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className={cn(
                    "flex min-h-control cursor-pointer items-center justify-between gap-4 rounded-none px-4 font-body text-label outline-none data-highlighted:bg-teal-tint",
                    isSelected ? "bg-teal-tint text-teal" : "text-ink",
                  )}
                >
                  <Select.ItemText>{option.name}</Select.ItemText>
                  {isSelected ? <CheckIcon size={16} className="size-4" /> : null}
                </Select.Item>
              );
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

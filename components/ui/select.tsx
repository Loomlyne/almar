"use client";

import { useState } from "react";
import { Select as RadixSelect } from "radix-ui";
import { cn } from "../../lib/cn";
import { CheckIcon, ChevronIcon } from "../icons/icons";

export type SelectOption = {
  value: string;
  /** The full name, shown in the list. */
  label: string;
  /** Short form shown in the trigger. Falls back to the label. */
  code?: string;
};

export type SelectTone = "default" | "on-image";

/**
 * The one listbox in the codebase. Square trigger, 44px high, caption caps; a check mark on the
 * chosen row and a teal-tint highlight. LocaleSelect and every filter use it.
 *
 * `value` may be null: no choice yet. The trigger then shows `placeholder`, and choosing any
 * option, including the one a caller would treat as the default, is a real change.
 */
export function Select({
  value,
  options,
  onChange,
  label,
  placeholder = "",
  tone = "default",
  dir,
  id,
  className,
}: {
  value: string | null;
  options: readonly SelectOption[];
  onChange?: (next: string) => void;
  /** Accessible-name template. `{name}` is the chosen label, `{code}` the chosen short form. */
  label: string;
  /** Shown, and used in the accessible name, while `value` is null. */
  placeholder?: string;
  tone?: SelectTone;
  /** Radix does not read the document direction, so the caller passes it. */
  dir?: "ltr" | "rtl";
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value === null ? undefined : (options.find((option) => option.value === value) ?? options[0]);
  const shownCode = selected ? (selected.code ?? selected.label) : placeholder;
  const name = label.replace("{name}", selected ? selected.label : placeholder).replace("{code}", shownCode);

  return (
    <RadixSelect.Root
      dir={dir}
      value={selected?.value ?? ""}
      onValueChange={(next) => onChange?.(next)}
      open={open}
      onOpenChange={setOpen}
    >
      <RadixSelect.Trigger
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
        <RadixSelect.Value placeholder={placeholder}>{shownCode}</RadixSelect.Value>
        <RadixSelect.Icon asChild>
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex size-3 items-center justify-center transition-transform duration-fast ease-standard rtl:-scale-x-100",
              open ? "-rotate-90" : "rotate-90",
            )}
          >
            <ChevronIcon size={16} className="size-3" />
          </span>
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-70 min-w-(--radix-select-trigger-width) rounded-none border border-line bg-surface text-ink shadow-lg"
        >
          <RadixSelect.Viewport>
            {options.map((option) => {
              const isSelected = option.value === selected?.value;
              return (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  className={cn(
                    "flex min-h-control cursor-pointer items-center justify-between gap-4 rounded-none px-4 font-body text-label outline-none data-highlighted:bg-teal-tint",
                    isSelected ? "bg-teal-tint text-teal" : "text-ink",
                  )}
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  {isSelected ? <CheckIcon size={16} className="size-4" /> : null}
                </RadixSelect.Item>
              );
            })}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

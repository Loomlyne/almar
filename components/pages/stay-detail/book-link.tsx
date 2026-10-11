"use client";

import { Button, LinkButton } from "../../ui/button";
import { cn } from "../../../lib/cn";

export type BookLinkProps = {
  /** bar: end of the four-segment bar; sheet: last step of the phone sheet; dock: the pinned dock. */
  size: "bar" | "sheet" | "dock";
  /** The trip page address for the chosen dates and guests (lib/booking/trip-link.ts). Null while no dates are chosen. */
  href: string | null;
  label: string;
  /** Without dates the control is a button: it asks for dates instead of navigating. */
  onMissingDates?: () => void;
  /** The id of the line that says "Choose arrival and departure to book.", read by screen readers on the button. */
  describedBy?: string;
};

const SIZE = { bar: "bar-auto", sheet: "lg", dock: "md" } as const;

/**
 * Book, beside Request on WhatsApp (B-01). With dates it is a plain link to /booking/trip; without them it never
 * navigates: it asks for dates (STAY-02 style reason, never a dead control).
 */
export function BookLink({ size, href, label, onMissingDates, describedBy }: BookLinkProps) {
  const className = size === "sheet" ? "w-full whitespace-normal px-3 text-center tracking-normal" : undefined;
  if (href) {
    return (
      <LinkButton href={href} size={SIZE[size]} className={className}>
        {label}
      </LinkButton>
    );
  }
  return (
    <Button size={SIZE[size]} className={cn(className)} onClick={onMissingDates} aria-describedby={describedBy}>
      {label}
    </Button>
  );
}

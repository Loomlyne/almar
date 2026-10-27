import { Button, LinkButton } from "../../ui/button";
import { cn } from "../../../lib/cn";

// Plan 04-03 (B-01, Q-02 signed 2026-10-25): Book on the stay page. With both dates it is a link to the guest's trip
// (/<locale>/booking/trip?…, same tab); without them it is a button that asks for the dates. B-01 opens booking in
// Phase 4, so this is the one file of the stay page that may hold a <Button> (tests/stay-detail-source.test.mjs).

export type BookLinkProps = {
  /** The trip address, or null while a date is missing. */
  href: string | null;
  size: "bar" | "sheet" | "dock";
  label: string;
  onAskDates: () => void;
};

export function BookLink({ href, size, label, onAskDates }: BookLinkProps) {
  const buttonSize = size === "bar" ? "bar-auto" : size === "sheet" ? "lg" : "md";
  const wide = size === "sheet" ? "w-full" : undefined;
  if (href) {
    return (
      <LinkButton href={href} size={buttonSize} className={cn(wide)}>
        {label}
      </LinkButton>
    );
  }
  return (
    <Button type="button" size={buttonSize} className={cn(wide)} onClick={onAskDates}>
      {label}
    </Button>
  );
}

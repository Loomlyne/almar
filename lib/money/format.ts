// Display text for an amount in fils: "AED 1,050.00". For showing only, never for arithmetic.
// Pure: no imports outside lib/money, no environment, no network.
import { assertFils } from "./fils";

const GROUPS = new Intl.NumberFormat("en-US", { useGrouping: true, maximumFractionDigits: 0 });

/**
 * `fils` as "AED 1,050.00": Western digits and comma groups in every language (the UI wraps it in
 * `<bdi dir="ltr">`). Split by integer division into whole dirhams and fils; only the whole part is grouped.
 */
export function formatAed(fils: number): string {
  assertFils(fils, "fils");
  const part = fils % 100;
  const whole = (fils - part) / 100;
  return `AED ${GROUPS.format(whole)}.${String(part).padStart(2, "0")}`;
}

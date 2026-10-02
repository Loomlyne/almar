import type { ReactNode } from "react";
import { CheckIcon } from "../icons/icons";
import { cn } from "../../lib/cn";

export type Fact = {
  /** Muted caption before the value. Omit for a plain row such as an amenity. */
  label?: string;
  value: ReactNode;
  /** A leading check mark. */
  icon?: boolean;
};

const GRID = "m-0 grid grid-cols-1 gap-x-8 p-0";
const ROW = "flex min-h-row-dense items-center gap-3 border-b border-line py-1 text-body text-ink";

/**
 * Rows of label and value, 44px high with a hairline under each, one column or two from the
 * 48rem breakpoint. When every row has a label it is a description list, so a screen reader hears
 * each label with its value; otherwise (amenities, policies) it is a plain list.
 */
export function FactList({
  items,
  columns = 1,
  className,
}: {
  items: Fact[];
  columns?: 1 | 2;
  className?: string;
}) {
  const cls = cn(GRID, columns === 2 && "md:grid-cols-2", className);
  const mark = (item: Fact) =>
    item.icon ? <CheckIcon size={16} className="shrink-0 text-teal" /> : null;

  if (items.length > 0 && items.every((item) => item.label)) {
    return (
      <dl className={cls}>
        {items.map((item, index) => (
          <div key={index} className={ROW}>
            {mark(item)}
            <dt className="shrink-0 text-label text-muted">{item.label}</dt>
            <dd className="m-0 min-w-0">{item.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <ul className={cn(cls, "list-none")}>
      {items.map((item, index) => (
        <li key={index} className={ROW}>
          {mark(item)}
          {item.label ? <span className="shrink-0 text-label text-muted">{item.label}</span> : null}
          <span className="min-w-0">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

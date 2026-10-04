import type { ReactNode } from "react";
import { CheckIcon } from "../icons/icons";
import { cn } from "../../lib/cn";

export type Fact = {
  /** Muted caption before the value. Omit for a plain row such as an amenity. */
  label?: string;
  value: ReactNode;
  /** true: a leading check mark. A node (for example an amenity icon) is drawn as given. */
  icon?: boolean | ReactNode;
};

const GRID = "m-0 grid grid-cols-1 gap-x-8 p-0";
const ROW = "flex min-h-row-dense items-center gap-3 border-b border-line py-1 text-body text-ink";

const LAYOUT = {
  /** Rows of 44px with a hairline under each, one column or two from md. */
  rows: { box: GRID, row: ROW },
  /** One wrapped line of facts, no rules: "2 bedrooms, 3 guests". */
  inline: { box: "m-0 flex flex-wrap gap-x-8 gap-y-3 p-0", row: "flex items-center gap-2 text-body text-ink" },
  /** The same grid as rows, with no hairlines and no fixed height: amenities beside their icons. */
  plain: { box: GRID, row: "flex items-center gap-3 py-2 text-label md:text-body text-ink" },
} as const;

/**
 * Rows of label and value. When every row has a label it is a description list, so a screen reader hears
 * each label with its value; otherwise (amenities, policies) it is a plain list.
 */
export function FactList({
  items,
  columns = 1,
  layout = "rows",
  className,
}: {
  items: Fact[];
  columns?: 1 | 2;
  layout?: "rows" | "inline" | "plain";
  className?: string;
}) {
  const { box, row } = LAYOUT[layout];
  const cls = cn(box, layout !== "inline" && columns === 2 && "md:grid-cols-2", className);
  const mark = (item: Fact) =>
    item.icon === true ? (
      <CheckIcon size={16} className="shrink-0 text-teal" />
    ) : item.icon ? (
      <span className="inline-flex shrink-0 text-teal">{item.icon}</span>
    ) : null;

  if (items.length > 0 && items.every((item) => item.label)) {
    return (
      <dl className={cls}>
        {items.map((item, index) => (
          <div key={index} className={row}>
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
        <li key={index} className={row}>
          {mark(item)}
          {item.label ? <span className="shrink-0 text-label text-muted">{item.label}</span> : null}
          <span className="min-w-0">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

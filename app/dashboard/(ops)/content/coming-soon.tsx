"use client";

import { CheckIcon } from "../../../../components/icons/icons";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { OPS_CONTENT_COPY, type ComingSoonKind } from "../../../../lib/copy/ops-content";

/** The Soon chip: a label, not a control (24px, square, ink border). Used on the Coming soon cards and in the rail. */
export function SoonChip({ children }: { children: string }) {
  return (
    <span className="inline-flex h-chip-dense shrink-0 items-center whitespace-nowrap rounded-none border border-ink bg-ivory px-2 font-body text-caption text-ink">
      {children}
    </span>
  );
}

/**
 * Content -> Pages, Blog, Legal and Navigation and footer while their editors are out of v1 (D-90, D-91): the canvas
 * DashPackages layout, a heading, a card with the Soon chip, a title, one line and the planned capabilities. No button, no
 * input, no link: nothing here can be pressed (plan 03.2-12).
 */
export function ComingSoonScreen({ kind }: { kind: ComingSoonKind }) {
  const locale = useDashboardLocale();
  const content = OPS_CONTENT_COPY[locale];
  const block = content.comingSoon[kind];
  const heading = kind === "navigation" ? content.rail.navigation : DASHBOARD_COPY[locale].rail[kind];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{heading}</h1>
      <section
        aria-labelledby={`coming-soon-${kind}`}
        className="flex flex-col items-start gap-6 border border-line bg-surface p-6 md:p-12"
      >
        <SoonChip>{content.soon}</SoonChip>
        <h2 id={`coming-soon-${kind}`} className="m-0 text-balance font-display text-title font-normal text-teal md:text-heading">
          {block.title}
        </h2>
        <p className="m-0 max-w-[65ch] text-pretty text-body text-ink">{block.line}</p>
        {block.list.length > 0 ? (
          <ul className="m-0 grid w-full list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
            {block.list.map((item) => (
              <li key={item} className="flex min-h-control items-center gap-3 text-label text-ink">
                <CheckIcon size={16} className="shrink-0 text-muted" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

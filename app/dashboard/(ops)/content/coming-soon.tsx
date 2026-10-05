"use client";

import { useId, type ReactNode } from "react";
import { CheckIcon } from "../../../../components/icons/icons";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { OPS_CONTENT_COPY, type ComingSoonKind } from "../../../../lib/copy/ops-content";

/**
 * The caption-size label for an entry whose editor is not built yet: canvas boards DashContent, DashPosts, DashPackages
 * (24 px tall, 8 px side padding, 12 px text, ink border on the ivory ground, square). A label, not a control: no hover,
 * no focus stop. The rail in ops-shell.tsx uses the same chip.
 */
export function SoonChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-chip-dense shrink-0 items-center whitespace-nowrap rounded-none border border-ink bg-ivory px-2 font-body text-caption text-ink">
      {children}
    </span>
  );
}

/**
 * A Content section that stays out of v1 (D-90, D-91): a page title, then one card with the Soon chip, what is coming
 * and, where the canvas draws one, what is planned. No button and no input: nothing here can be pressed or typed in.
 * The language is the dashboard cookie's, read after the first paint like every other ops screen.
 */
export function ComingSoonScreen({ kind }: { kind: ComingSoonKind }) {
  const locale = useDashboardLocale();
  const headingId = useId();
  const title = DASHBOARD_COPY[locale].rail[kind];
  const copy = OPS_CONTENT_COPY[locale];
  const block = copy.comingSoon[kind];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{title}</h1>
      <section
        aria-labelledby={headingId}
        className="flex min-w-0 flex-col items-start gap-6 border border-line bg-surface p-6 md:p-12"
        data-testid="coming-soon"
        data-kind={kind}
      >
        <SoonChip>{copy.soon}</SoonChip>
        <h2 id={headingId} className="m-0 text-balance font-display text-heading font-normal text-teal">
          {block.title}
        </h2>
        <p className="m-0 max-w-prose text-pretty text-body text-ink">{block.text}</p>
        {block.items.length > 0 ? (
          <ul className="m-0 grid w-full list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
            {block.items.map((item) => (
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

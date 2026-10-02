import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export type SectionHeadProps = {
  kicker?: string;
  heading: string;
  headingLevel?: 2 | 3 | 4;
  intro?: ReactNode;
  /** A trailing control, for example a "View all" link. */
  action?: ReactNode;
  /** Id for the heading, so a Section can name itself by it. */
  headingId?: string;
  className?: string;
};

/**
 * Gold rule, kicker, heading, intro. The rule is the only gold on the block and it is a line.
 * Measure: 3xl (768px) is the nearest scale step to the board's 820px; tokens.json has no
 * measure token, so this is flagged for the token pass.
 */
export function SectionHead({
  kicker,
  heading,
  headingLevel = 2,
  intro,
  action,
  headingId,
  className,
}: SectionHeadProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <div className={cn("flex max-w-3xl flex-wrap items-end justify-between gap-4 border-t-2 border-gold pt-6", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {kicker ? (
          <p className="m-0 text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
            {kicker}
          </p>
        ) : null}
        <Heading id={headingId} className="m-0 font-display text-heading text-teal">
          {heading}
        </Heading>
        {intro ? <p className="m-0 max-w-prose text-body text-ink">{intro}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export type SectionProps = Partial<Omit<SectionHeadProps, "headingId">> & {
  children?: ReactNode;
  id?: string;
  className?: string;
};

/** A page section: an optional SectionHead, then the content. Named by its heading when it has one. */
export function Section({ heading, children, id, className, ...head }: SectionProps) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={heading ? headingId : undefined} className={cn("grid gap-6 pt-12", className)}>
      {heading ? <SectionHead heading={heading} headingId={headingId} {...head} /> : null}
      {children}
    </section>
  );
}

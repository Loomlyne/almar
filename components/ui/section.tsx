import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Reveal } from "./reveal";

export type SectionHeadProps = {
  kicker?: string;
  heading: string;
  /** The heading element. 1 is for the page's one h1; every other section head is 2 to 4. Default 2. */
  headingLevel?: 1 | 2 | 3 | 4;
  /**
   * Type size of the heading. "heading" (32) for a section; "display" (48, 32 on a phone) for a page title.
   * Default: heading for tone "rule", display for tone "plain".
   */
  headingSize?: "heading" | "display";
  intro?: ReactNode;
  /** A trailing control, for example a "View all" link. */
  action?: ReactNode;
  /** Id for the heading, so a Section can name itself by it. */
  headingId?: string;
  /**
   * "rule" (default): the gold rule above the block, used by the stays list. "plain": no rule, a teal sentence-case
   * kicker and a display heading, the Framer page head used by the home and the stay page. Its text block is a
   * Reveal heading and its action a Reveal button.
   */
  tone?: "rule" | "plain";
  /** Plain tone only: "center" centres the block and puts the action under the intro. */
  align?: "start" | "center";
  className?: string;
};

const HEADING_SIZE = { heading: "text-heading", display: "text-display" } as const;

/**
 * Gold rule, kicker, heading, intro. The rule is the only gold on the block and it is a line.
 * Measure: 3xl (768px) is the nearest scale step to the board's 820px; tokens.json has no
 * measure token, so this is flagged for the token pass.
 */
export function SectionHead({
  kicker,
  heading,
  headingLevel = 2,
  headingSize,
  intro,
  action,
  headingId,
  tone = "rule",
  align = "start",
  className,
}: SectionHeadProps) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3" | "h4";

  if (tone === "plain") {
    const center = align === "center";
    return (
      <div className={cn("flex flex-wrap items-end justify-between gap-6", center && "flex-col items-center", className)}>
        <Reveal kind="heading" className={cn("flex min-w-0 max-w-2xl flex-1 flex-col gap-3", center && "mx-auto text-center")}>
          {kicker ? <p className="m-0 text-label md:text-body text-teal">{kicker}</p> : null}
          <Heading id={headingId} className={cn("m-0 font-display text-teal", HEADING_SIZE[headingSize ?? "display"])}>
            {heading}
          </Heading>
          {intro ? <p className="m-0 text-label md:text-body text-ink">{intro}</p> : null}
        </Reveal>
        {action ? (
          <Reveal kind="button" className="shrink-0">
            {action}
          </Reveal>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex max-w-3xl flex-wrap items-end justify-between gap-4 border-t-2 border-gold pt-6", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {kicker ? (
          <p className="m-0 text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
            {kicker}
          </p>
        ) : null}
        <Heading id={headingId} className={cn("m-0 font-display text-teal", HEADING_SIZE[headingSize ?? "heading"])}>
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
  /** "default" is today's section. "page" is a Framer page band: the section rhythm (64px, 120px from md) and a plain head. */
  variant?: "default" | "page";
  className?: string;
};

/** A page section: an optional SectionHead, then the content. Named by its heading when it has one. */
export function Section({ heading, children, id, variant = "default", className, ...head }: SectionProps) {
  const headingId = useId();
  const page = variant === "page";
  return (
    <section
      id={id}
      aria-labelledby={heading ? headingId : undefined}
      className={cn(page ? "grid gap-12 py-16 md:py-section" : "grid gap-6 pt-12", className)}
    >
      {heading ? <SectionHead tone={page ? "plain" : "rule"} heading={heading} headingId={headingId} {...head} /> : null}
      {children}
    </section>
  );
}

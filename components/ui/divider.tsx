import { cn } from "../../lib/cn";

/**
 * The section divider (11-DESIGN section 4): a thin teal-tint line with a small gold diamond OUTLINE in the middle.
 * Gold is a line only, so the diamond has a gold border and an ivory centre, never a gold fill.
 */
export function Divider({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center gap-3", className)}>
      <span className="h-px flex-1 bg-teal-tint" />
      <span className="size-3 rotate-45 border border-gold bg-ivory" />
      <span className="h-px flex-1 bg-teal-tint" />
    </div>
  );
}

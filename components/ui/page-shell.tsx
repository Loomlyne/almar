import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * The one place the page container lives. The outer element is a size container (SiteNav's
 * @6xl queries keep working inside it) with the page inset: 16px below 48rem, 32px from it.
 * The inner element is the column: at most --container-column (1240px) and centred.
 * Content is 358px at 390, 770 at 834 and 1240 at 1440.
 */
export function PageShell({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "main";
}) {
  return (
    <Tag className="@container w-full px-4 md:px-8">
      <div className={cn("mx-auto w-full max-w-column", className)}>{children}</div>
    </Tag>
  );
}

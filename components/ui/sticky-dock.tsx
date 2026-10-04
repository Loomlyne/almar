import type { ReactNode } from "react";

/**
 * The 88px bottom bar: ivory ground, hairline on top, pinned to the viewport bottom. It reserves
 * its own height in the flow, so the last line of the page is never hidden behind it. With no
 * `action` it is a plain summary; no empty slot is drawn.
 */
export function StickyDock({ summary, action }: { summary: ReactNode; action?: ReactNode }) {
  return (
    <>
      <div aria-hidden="true" className="h-dock" />
      <div className="fixed inset-x-0 bottom-0 z-40 flex h-dock items-center justify-between gap-4 border-t border-line bg-ivory px-4 md:px-8">
        <div className="flex min-w-0 flex-1 flex-col">{summary}</div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </>
  );
}

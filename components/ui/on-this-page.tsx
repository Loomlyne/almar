import { cn } from "../../lib/cn";

export type OnThisPageItem = { id: string; text: string };

/** Plain in-page anchors, one 44px row per heading. Renders nothing below two items. Works with JavaScript off. */
export function OnThisPage({ label, items, className }: { label: string; items: OnThisPageItem[]; className?: string }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label={label} className={cn("grid gap-2", className)}>
      <p className="m-0 text-caption text-muted">{label}</p>
      <ol className="m-0 grid list-none p-0">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex min-h-control items-center border-b border-line text-label text-teal no-underline decoration-gold decoration-1 underline-offset-4 hover:underline"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

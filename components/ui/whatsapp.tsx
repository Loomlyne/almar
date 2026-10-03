import { WhatsAppIcon } from "../icons/icons";
import { cn } from "../../lib/cn";

const BASE =
  "fixed end-4 bottom-4 z-60 inline-flex size-control items-center justify-center rounded-none bg-whatsapp text-ink no-underline";

/**
 * The floating WhatsApp link. `className` is merged over the base, for a page with a pinned bar that the
 * float must clear (for example `bottom-dock`). With no prop the output is exactly what it always was.
 */
export function WhatsApp({ className }: { className?: string } = {}) {
  return (
    <a
      className={className ? cn(BASE, className) : BASE}
      href="https://wa.me/971563883302"
      aria-label="WhatsApp"
      target="_blank"
      rel="noopener noreferrer"
    >
      <WhatsAppIcon size={24} aria-hidden="true" />
    </a>
  );
}

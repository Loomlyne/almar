import { WhatsAppIcon } from "../icons/icons";

export function WhatsApp() {
  return (
    <a
      className="fixed end-4 bottom-4 z-60 inline-flex size-control items-center justify-center rounded-none bg-whatsapp text-ink no-underline"
      href="https://wa.me/971563883302"
      aria-label="WhatsApp"
      target="_blank"
      rel="noopener noreferrer"
    >
      <WhatsAppIcon size={24} aria-hidden="true" />
    </a>
  );
}

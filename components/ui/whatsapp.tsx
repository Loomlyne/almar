import { WhatsAppIcon } from "../icons/icons";
import styles from "./whatsapp.module.css";

export function WhatsApp() {
  return (
    <a
      className={styles.whatsapp}
      href="https://wa.me/971563883302"
      aria-label="WhatsApp"
      target="_blank"
      rel="noopener noreferrer"
    >
      <WhatsAppIcon size={24} aria-hidden="true" />
    </a>
  );
}

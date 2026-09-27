import { BedMark, GuestMark } from "./project-marks";
import styles from "./private-stay-card.module.css";

type Locale = "en" | "ar" | "es";

const COPY = {
  en: {
    name: "Getsemaní Colonial House",
    beds: "5 double",
    guests: "Up to 10 Guests",
    alt: "Getsemaní Colonial House — hero",
  },
  ar: {
    name: "بيت خيتسيماني الاستعماري",
    beds: "5 مزدوجة",
    guests: "حتى 10 ضيوف",
    alt: "بيت خيتسيماني الاستعماري — الصورة الرئيسية",
  },
  es: {
    name: "Casa colonial de Getsemaní",
    beds: "5 dobles",
    guests: "Hasta 10 huéspedes",
    alt: "Casa colonial de Getsemaní — imagen principal",
  },
} as const;

export function PrivateStayCard({ locale }: { locale: Locale }) {
  const copy = COPY[locale];

  return (
    <a className={styles.card} href="/private-stays/getsemani-colonial-house">
      <img src="/assets/img/59682878de873329.webp" alt={copy.alt} width={1600} height={1084} />
      <span className={styles.shade} aria-hidden="true" />
      <span className={styles.copy}>
        <h3>{copy.name}</h3>
        <ul>
          <li>
            <BedMark />
            {copy.beds}
          </li>
          <li>
            <GuestMark />
            {copy.guests}
          </li>
        </ul>
      </span>
    </a>
  );
}

export function PrivateStaySection({ locale }: { locale: Locale }) {
  return (
    <section className="kit-section" id="private-stay-card" aria-label="Private stay card">
      <header className="kit-head">
        <h2>Private stay card</h2>
        <p className="kit-sub">The stay card from the home page.</p>
      </header>
      <PrivateStayCard locale={locale} />
    </section>
  );
}

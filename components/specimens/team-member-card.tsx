import { InstagramMark, MailMark } from "./project-marks";
import styles from "./team-member-card.module.css";

type Locale = "en" | "ar" | "es";

const COPY = {
  en: {
    name: "Ana Velásquez",
    role: "Founder & Journey Director",
    alt: "Ana Velásquez, Founder and Journey Director",
    email: "Email us",
    instagram: "Instagram",
    newTab: "opens in a new tab",
  },
  ar: {
    name: "Ana Velásquez",
    role: "المؤسسة ومديرة الرحلات",
    alt: "آنا فيلاسكيز، المؤسسة ومديرة الرحلات",
    email: "راسلونا",
    instagram: "إنستغرام",
    newTab: "يفتح في علامة جديدة",
  },
  es: {
    name: "Ana Velásquez",
    role: "Fundadora y directora de viajes",
    alt: "Ana Velásquez, fundadora y directora de viajes",
    email: "Escríbannos",
    instagram: "Instagram",
    newTab: "se abre en una pestaña nueva",
  },
} as const;

export function TeamMemberCard({ locale }: { locale: Locale }) {
  const copy = COPY[locale];

  return (
    <article className={styles.card}>
      <img src="/assets/img/b9d52c65cad144dd.webp" alt={copy.alt} width={900} height={1350} />
      <div>
        <h3>{copy.name}</h3>
        <p className={styles.role}>{copy.role}</p>
      </div>
      <div className={styles.actions}>
        <a className={styles.mail} href="mailto:inquiries@almarprivatejourney.com">
          <MailMark />
          {copy.email}
        </a>
        <a
          href="https://www.instagram.com/almarprivatejourney/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${copy.instagram}, ${copy.newTab}`}
        >
          <InstagramMark />
        </a>
      </div>
    </article>
  );
}

export function TeamMemberSection({ locale }: { locale: Locale }) {
  return (
    <section className="kit-section" id="team-member" aria-label="Team member">
      <header className="kit-head">
        <h2>Team member</h2>
        <p className="kit-sub">The team card from the home page.</p>
      </header>
      <TeamMemberCard locale={locale} />
    </section>
  );
}

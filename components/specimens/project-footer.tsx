"use client";

import { useId, useState, type FormEvent } from "react";
import { FacebookMark, InstagramMark, MailMark, TikTokMark, YouTubeMark } from "./project-marks";
import styles from "./project-footer.module.css";

type Locale = "en" | "ar" | "es";

const COPY = {
  en: {
    explore: "Explore",
    legal: "Legal",
    connect: "Connect",
    plan: "Plan your journey",
    note: "Private Colombia inspiration, delivered to your inbox.",
    email: "Email",
    placeholder: "Your email address",
    join: "Join the List",
    error: "Enter an email as name@example.com.",
    notSent: "Nothing is sent from this page.",
    rights: "© 2026 ALMAR Private Journeys. All rights reserved.",
    made: "Made by",
    newTab: "opens in a new tab",
    logo: "ALMAR",
    home: "Home",
    about: "About",
    services: "Services",
    experiences: "Experiences",
    blog: "Blog/News",
    cookie: "Cookie Policy",
    cancel: "Cancellation & Refund Policy",
    booking: "Booking Terms",
    disclaimer: "Disclaimer",
    waiver: "Liability Waiver",
    contact: "Contact",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
  },
  ar: {
    explore: "استكشفوا",
    legal: "قانوني",
    connect: "تواصلوا",
    plan: "خطّطوا رحلتكم",
    note: "إلهام كولومبيا الخاصة، يصل إلى بريدكم.",
    email: "البريد",
    placeholder: "بريدكم",
    join: "انضموا إلى القائمة",
    error: "أدخلوا بريداً بصيغة name@example.com.",
    notSent: "لا يُرسَل شيء من هذه الصفحة.",
    rights: "© 2026 المار للرحلات الخاصة. كل الحقوق محفوظة.",
    made: "من تنفيذ",
    newTab: "يفتح في علامة جديدة",
    logo: "المار",
    home: "الرئيسية",
    about: "عنّا",
    services: "الخدمات",
    experiences: "التجارب",
    blog: "المدونة",
    cookie: "سياسة ملفات الارتباط",
    cancel: "سياسة الإلغاء والاسترداد",
    booking: "شروط الحجز",
    disclaimer: "إخلاء المسؤولية",
    waiver: "إعفاء من المسؤولية",
    contact: "تواصل",
    privacy: "سياسة الخصوصية",
    terms: "شروط الخدمة",
  },
  es: {
    explore: "Explorar",
    legal: "Legal",
    connect: "Conectar",
    plan: "Planifiquen su viaje",
    note: "Inspiración de Colombia en privado, en su correo.",
    email: "Correo",
    placeholder: "Su correo",
    join: "Unirse a la lista",
    error: "Escriban un correo como name@example.com.",
    notSent: "Nada se envía desde esta página.",
    rights: "© 2026 ALMAR Private Journeys. Todos los derechos reservados.",
    made: "Hecho por",
    newTab: "se abre en una pestaña nueva",
    logo: "ALMAR",
    home: "Inicio",
    about: "Nosotros",
    services: "Servicios",
    experiences: "Experiencias",
    blog: "Blog/Noticias",
    cookie: "Política de cookies",
    cancel: "Política de cancelación y reembolso",
    booking: "Términos de reserva",
    disclaimer: "Aviso legal",
    waiver: "Exención de responsabilidad",
    contact: "Contacto",
    privacy: "Política de privacidad",
    terms: "Términos del servicio",
  },
} as const;

const SOCIALS = [
  ["facebook", "https://facebook.com", FacebookMark],
  ["instagram", "https://instagram.com", InstagramMark],
  ["youtube", "https://youtube.com", YouTubeMark],
  ["tiktok", "https://tiktok.com", TikTokMark],
] as const;

export function ProjectFooterSection({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  const emailId = useId();
  const errorId = useId();
  const statusId = useId();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("email");
    if (!(input instanceof HTMLInputElement) || !input.value.trim() || !input.checkValidity()) {
      setError(copy.error);
      setNote("");
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setError("");
    setNote(copy.notSent);
  }

  const explore = [
    [copy.home, "/"],
    [copy.about, "/about"],
    [copy.services, "/services"],
    [copy.experiences, "/experiences"],
    [copy.blog, "/blog"],
  ] as const;
  const legal = [
    [copy.cookie, "/legal/privacy-policy"],
    [copy.cancel, "/legal/privacy-policy"],
    [copy.booking, "/legal/booking-terms"],
    [copy.disclaimer, "/legal/disclaimer"],
    [copy.waiver, "/legal/liability-waiver"],
  ] as const;
  const connect = [
    [copy.contact, "/contact"],
    [copy.privacy, "/legal/privacy-policy"],
    [copy.terms, "/legal/terms-of-service"],
  ] as const;

  return (
    <section className="kit-section" id="project-footer" aria-label="Project footer">
      <header className="kit-head">
        <h2>Project footer</h2>
        <p className="kit-sub">The footer from the home page.</p>
      </header>
      <footer className={styles.footer}>
        <img
          className={styles.logo}
          src="https://framerusercontent.com/images/RX7lhKpzXFpv2KTvbxNSm3UZz8.svg"
          alt={copy.logo}
          width={200}
          height={48}
        />
        <div className={styles.grid}>
          <nav aria-label={copy.explore}>
            <p className={styles.kicker}>{copy.explore}</p>
            <ul className={styles.links}>
              {explore.map(([label, href]) => (
                <li key={href + label}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={copy.legal}>
            <p className={styles.kicker}>{copy.legal}</p>
            <ul className={styles.links}>
              {legal.map(([label, href]) => (
                <li key={label}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={copy.connect}>
            <p className={styles.kicker}>{copy.connect}</p>
            <ul className={styles.links}>
              {connect.map(([label, href]) => (
                <li key={label}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.plan}>
            <p className={styles.kicker}>{copy.plan}</p>
            <ul className={styles.socials}>
              {SOCIALS.map(([name, href, Mark]) => (
                <li key={name}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${name}, ${copy.newTab}`}>
                    <Mark />
                  </a>
                </li>
              ))}
            </ul>
            <p className={styles.note}>{copy.note}</p>
            <form className={styles.form} noValidate onSubmit={onSubmit}>
              <label className={styles.clip} htmlFor={emailId}>
                {copy.email}
              </label>
              <input
                id={emailId}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder={copy.placeholder}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : note ? statusId : undefined}
              />
              <button type="submit">{copy.join}</button>
            </form>
            {error ? (
              <p id={errorId} className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            {note ? (
              <p id={statusId} className={styles.status} role="status">
                {note}
              </p>
            ) : null}
          </div>
        </div>
        <div className={styles.bar}>
          <p>{copy.rights}</p>
          <p className={styles.credit}>
            {copy.made}{" "}
            <a href="https://koussay.com" target="_blank" rel="noopener noreferrer">
              Koussay
              <span className={styles.clip}> ({copy.newTab})</span>
            </a>
          </p>
        </div>
      </footer>
    </section>
  );
}

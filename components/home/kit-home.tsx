"use client";

import { useState, type FormEvent } from "react";
import { notoNaskh, notoSans } from "../../lib/fonts";
import { BOOKER_COPY, HOME_COPY, type HomeLocale } from "../../lib/home-copy";
import { SiteNav } from "../ui/nav";
import { HeroBooker } from "../specimens/hero-booker";

const GALLERY = [
  { src: "/assets/img/05c5854491d0153e.webp", altKey: "cartagena" },
  { src: "/assets/img/61f0185cb8d5387c.webp", altKey: "medellin" },
  { src: "/assets/img/2af2299b05a87c37.webp", altKey: "coffee" },
] as const;

const GALLERY_ALT: Record<HomeLocale, Record<(typeof GALLERY)[number]["altKey"], string>> = {
  en: {
    cartagena: "Cartagena, Colombia",
    medellin: "Medellín, Colombia",
    coffee: "Coffee cherries on a branch in Colombia’s Eje Cafetero",
  },
  ar: {
    cartagena: "كارتاخينا، كولومبيا",
    medellin: "ميديلين، كولومبيا",
    coffee: "كرز البن على غصن في منطقة القهوة في كولومبيا",
  },
  es: {
    cartagena: "Cartagena, Colombia",
    medellin: "Medellín, Colombia",
    coffee: "Cerezas de café en una rama del Eje Cafetero de Colombia",
  },
};

const DATE_LOCALE: Record<HomeLocale, string> = {
  en: "en-GB",
  ar: "ar",
  es: "es",
};

function QuietForm({
  title,
  intro,
  nameLabel,
  emailLabel,
  messageLabel,
  sendLabel,
  emailError,
  notSent,
  id,
}: {
  title: string;
  intro: string;
  nameLabel: string;
  emailLabel: string;
  messageLabel: string;
  sendLabel: string;
  emailError: string;
  notSent: string;
  id: string;
}) {
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = event.currentTarget.elements.namedItem("email");
    if (!(email instanceof HTMLInputElement) || !email.value.trim() || !email.checkValidity()) {
      setError(emailError);
      setNote("");
      if (email instanceof HTMLInputElement) email.focus();
      return;
    }
    setError("");
    setNote(notSent);
  }

  return (
    <form className="kit-form" noValidate onSubmit={onSubmit} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p>{intro}</p>
      <label>
        <span>{nameLabel}</span>
        <input name="name" type="text" autoComplete="name" />
      </label>
      <label>
        <span>{emailLabel}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="name@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </label>
      <label>
        <span>{messageLabel}</span>
        <textarea name="message" rows={4} />
      </label>
      {error ? (
        <p id={`${id}-error`} className="kit-error">
          {error}
        </p>
      ) : null}
      <button type="submit">{sendLabel}</button>
      <p className="kit-note" role="status">
        {note}
      </p>
    </form>
  );
}

export function KitHome() {
  const [locale, setLocale] = useState<HomeLocale>("en");
  const copy = HOME_COPY[locale];
  const booker = BOOKER_COPY[locale];
  const arabic = locale === "ar" ? `${notoNaskh.variable} ${notoSans.variable} is-ar` : "";

  return (
    <div className={`kit-home ${arabic}`} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <SiteNav
        locale={locale}
        onLocale={setLocale}
        labels={copy.nav}
        loginHref="#sign-in"
        markCurrent={false}
      />
      <main id="content">
        <section className="kit-hero" aria-labelledby="kit-hero-title">
          <p className="kit-kicker">{copy.welcomeKicker}</p>
          <h1 id="kit-hero-title">{copy.heroTitle}</h1>
          <img src="/assets/img/ef78a57ee630532d.webp" alt={copy.heroImageAlt} width={1600} height={1000} />
          <HeroBooker labels={booker} dateLocale={DATE_LOCALE[locale]} />
        </section>

        <section className="kit-band" id="about" aria-labelledby="kit-welcome-title">
          <p className="kit-kicker">{copy.letter}</p>
          <h2 id="kit-welcome-title">{copy.welcomeTitle}</h2>
          {copy.welcome.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>

        <section className="kit-band" aria-labelledby="kit-gallery-title">
          <h2 id="kit-gallery-title">{copy.galleryTitle}</h2>
          <ul className="kit-gallery">
            {GALLERY.map((item) => (
              <li key={item.src}>
                <img src={item.src} alt={GALLERY_ALT[locale][item.altKey]} width={800} height={600} />
              </li>
            ))}
          </ul>
        </section>

        <section className="kit-band" id="destinations" aria-labelledby="kit-stays-title">
          <h2 id="kit-stays-title">{copy.staysTitle}</h2>
          <p>{copy.staysIntro}</p>
          <ul className="kit-cards">
            {copy.stays.map((stay) => (
              <li key={stay.src}>
                <img src={stay.src} alt={stay.alt} width={800} height={600} />
                <h3>{stay.name}</h3>
                <p>{stay.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="kit-band" aria-labelledby="kit-services-title">
          <h2 id="kit-services-title">{copy.servicesTitle}</h2>
          <p>{copy.servicesIntro}</p>
          <ul className="kit-services">
            {copy.services.map((service) => (
              <li key={service.name}>
                {service.src ? <img src={service.src} alt={service.alt} width={800} height={600} /> : null}
                <h3>{service.name}</h3>
                <p>{service.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="kit-band" id="experiences" aria-labelledby="kit-moments-title">
          <h2 id="kit-moments-title">{copy.momentsTitle}</h2>
          <p>{copy.momentsIntro}</p>
        </section>

        <section className="kit-band" aria-labelledby="kit-journeys-title">
          <h2 id="kit-journeys-title">{copy.journeysTitle}</h2>
          <p>{copy.journeysIntro}</p>
          <ul className="kit-cards">
            {copy.journeys.map((journey) => (
              <li key={journey.src}>
                <img src={journey.src} alt={journey.alt} width={800} height={600} />
                <h3>{journey.name}</h3>
                <p className="kit-price">{journey.price}</p>
                <p>{journey.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="kit-band" aria-labelledby="kit-stories-title">
          <h2 id="kit-stories-title">{copy.storiesTitle}</h2>
          <ul className="kit-cards">
            {copy.stories.map((story) => (
              <li key={story.src}>
                <img src={story.src} alt={story.alt} width={800} height={600} />
                <h3>{story.title}</h3>
                <p>{story.date}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="kit-band" id="contact">
          <QuietForm
            id="contact-form"
            title={copy.contactTitle}
            intro={copy.contactIntro}
            nameLabel={copy.name}
            emailLabel={copy.email}
            messageLabel={copy.message}
            sendLabel={copy.send}
            emailError={copy.emailError}
            notSent={copy.notSent}
          />
          <address>
            <a href="mailto:inquiries@almarprivatejourney.com">inquiries@almarprivatejourney.com</a>
            <a href="tel:+971563883302">+971 56 388 3302</a>
          </address>
        </section>

        <section className="kit-band" aria-labelledby="kit-team-title">
          <h2 id="kit-team-title">{copy.teamTitle}</h2>
          <ul className="kit-team">
            {copy.team.map((person) => (
              <li key={person.src}>
                <img src={person.src} alt={person.alt} width={400} height={500} />
                <h3>{person.name}</h3>
                <p>{person.role}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="kit-band" id="sign-in" aria-labelledby="kit-signin-title">
          <h2 id="kit-signin-title">{copy.signInTitle}</h2>
          <p>{copy.signInBody}</p>
        </section>
      </main>
      <footer className="kit-footer">
        <p className="kit-brand">{copy.footerBrand}</p>
        <nav aria-label={copy.pages}>
          <p>{copy.pages}</p>
          <a href="#destinations">{copy.nav.destinations}</a>
          <a href="#experiences">{copy.nav.experiences}</a>
          <a href="#about">{copy.nav.about}</a>
          <a href="#contact">{copy.nav.contact}</a>
          <a href="#list-with-us">{copy.listTitle}</a>
        </nav>
        <QuietForm
          id="list-with-us"
          title={copy.listTitle}
          intro={copy.listIntro}
          nameLabel={copy.name}
          emailLabel={copy.email}
          messageLabel={copy.message}
          sendLabel={copy.send}
          emailError={copy.emailError}
          notSent={copy.notSent}
        />
        <QuietForm
          id="newsletter"
          title={copy.newsletter}
          intro={copy.notSent}
          nameLabel={copy.name}
          emailLabel={copy.email}
          messageLabel={copy.message}
          sendLabel={copy.subscribe}
          emailError={copy.emailError}
          notSent={copy.notSent}
        />
      </footer>
      <section className="kit-pieces" aria-labelledby="kit-pieces-title">
        <h2 id="kit-pieces-title">{copy.kitPieces}</h2>
      </section>
    </div>
  );
}

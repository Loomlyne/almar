// AR and ES reviewed and corrected 2026-10-05 (controller-delegated review): .planning/phases/03.3-public-site-in-react/I18N-REVIEW-2026-10-05.md
// Copy for the /about page (phase 3.3 slice 3, plan 23).
//
// EN is the published text of the live Framer About page, verbatim (the Framer route file that plan 23 deletes), and
// the three canvas-approved headings (design 3.4) are exact: Our Story (AR `قصتنا`, ES `Nuestra historia`), Our Values
// (AR `قيمنا`, ES `Nuestros valores`) and Get In Touch (AR `تواصل معنا`, ES `Ponte en contacto`).
// AR is the draft the owner saw on the signed pictures (s3-pictures/mock.py T["ar"]), plus drafts for the lines the
// pictures do not show. ES is DRAFTED UI COPY (neutral Latin American Spanish, the practice of lib/copy/journey.ts,
// status: draft). Every AR and ES value except the three approved headings is a draft for the owner's review.
//
// The hero's kicker and headline, the intro statement and every card are data (lib/data/about.ts), not copy. The
// page's closing text block (links, contact, language, copyright) is the one table SITE_FOOTER_COPY
// (S3-24); plan 27 adds the newsletter strings there, so this file has no such block.
// Imported directly by components/pages/about-page.tsx; deliberately not registered in lib/copy/index.ts (reconcile R-9).

export type AboutPageLocale = "en" | "ar" | "es";

export type AboutPageCopy = {
  meta: { title: string; description: string };
  /** The Our Story section: its heading and the line under it. The cards are data. */
  story: { heading: string; intro: string };
  /** The Our Values section: its heading and the line under it. The rows are data. */
  values: { heading: string; intro: string };
  /** The Our Team section. It renders nothing until a member is published (D-55). */
  team: { kicker: string; heading: string };
  /** The closing band: heading, the line under it and the label of its one link. */
  getInTouch: { heading: string; intro: string; cta: string };
};

export const ABOUT_PAGE_COPY: Record<AboutPageLocale, AboutPageCopy> = {
  en: {
    meta: {
      title: "ALMAR private travel team in Colombia",
      description:
        "ALMAR is a team that plans private trips in Colombia for international travelers. Safety and privacy come first.",
    },
    story: {
      heading: "Our Story",
      intro: "From Colombia, with love — and a mission to make every journey safe, pleasant, and unforgettable.",
    },
    values: {
      heading: "Our Values",
      intro: "What we believe in shapes every stay.",
    },
    team: {
      kicker: "Our Team",
      heading: "A small team with a singular focus.",
    },
    getInTouch: {
      heading: "Get In Touch",
      intro:
        "Your private Colombia journey begins with a conversation. Share your vision and our team will design a safety-led, fully bespoke experience.",
      cta: "Begin Your Journey",
    },
  },
  ar: {
    meta: {
      title: "فريق ALMAR للسفر الخاص في كولومبيا",
      description: "ALMAR فريق يخطّط رحلات خاصة في كولومبيا للمسافرين الدوليين. الأمان والخصوصية أولاً.",
    },
    story: {
      heading: "قصتنا",
      intro: "من كولومبيا بكل حب، ومهمتنا أن تكون كل رحلة آمنة وممتعة ولا تُنسى.",
    },
    values: {
      heading: "قيمنا",
      intro: "ما نؤمن به يصوغ كل إقامة.",
    },
    team: {
      kicker: "فريقنا",
      heading: "فريق صغير بتركيز واحد.",
    },
    getInTouch: {
      heading: "تواصل معنا",
      intro: "تبدأ رحلتكم الخاصة في كولومبيا بحديث. شاركونا رؤيتكم وسيصمّم فريقنا تجربة مفصّلة بالكامل تضع الأمان أولاً.",
      cta: "ابدأوا رحلتكم",
    },
  },
  es: {
    meta: {
      title: "Equipo de viajes privados ALMAR en Colombia",
      description:
        "ALMAR es un equipo que planifica viajes privados en Colombia para viajeros internacionales. La seguridad y la privacidad son lo primero.",
    },
    story: {
      heading: "Nuestra historia",
      intro: "Desde Colombia, con amor, y con la misión de que cada viaje sea seguro, agradable e inolvidable.",
    },
    values: {
      heading: "Nuestros valores",
      intro: "Lo que creemos da forma a cada estancia.",
    },
    team: {
      kicker: "Nuestro equipo",
      heading: "Un equipo pequeño con un único enfoque.",
    },
    getInTouch: {
      heading: "Ponte en contacto",
      intro:
        "Tu viaje privado por Colombia comienza con una conversación. Comparte tu visión y nuestro equipo diseñará una experiencia totalmente a medida, con la seguridad como prioridad.",
      cta: "Comienza tu viaje",
    },
  },
};

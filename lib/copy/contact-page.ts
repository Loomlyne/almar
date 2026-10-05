// AR and ES reviewed and corrected 2026-10-05 (controller-delegated review): .planning/phases/03.3-public-site-in-react/I18N-REVIEW-2026-10-05.md
// Copy for the /contact page (phase 3.3 slice 3, plan 24).
//
// EN is the published text of the live Framer contact page, verbatim (the Framer route file that plan 24 deleted),
// with one change: the sub-label `Inquiry Line` drops the live text's colon (`Inquiry Line:`), a label and not a
// sentence. The live team line `A dedicated local team will listen first, then plan every detail around you.` is not
// carried: TeamSection takes no intro and renders nothing today (D-55).
// AR is the draft the owner saw on the signed pictures (s3-pictures/mock.py T["ar"], and mock2.py for the Phone label
// `الهاتف`), plus the two headings the canvas approved (design 3.4): `خطط لرحلتك` and `سافر بثقة`.
// ES is DRAFTED UI COPY (neutral Latin American Spanish, the practice of lib/copy/journey.ts), with the two canvas
// headings `Planifica tu viaje` and `Viaja con confianza`. Every AR and ES value except those two headings is a draft
// for the owner's review. The Arabic and Spanish team title is a draft too.
//
// Nothing here is a form string: the form's strings arrive with plan 26. The footer strings are in
// lib/copy/site-footer.ts (S3-24), so there is no footer key; `newTab` repeats SITE_FOOTER_COPY[l].newTab as a literal
// (this file has no value import, so `node --test` loads it directly) and tests/contact-page-copy.test.mjs pins the two.
// Imported directly by components/pages/contact/*; deliberately not registered in lib/copy/index.ts (reconcile R-9).

export type ContactPageLocale = "en" | "ar" | "es";

export type ContactPageCopy = {
  meta: { title: string; description: string };
  title: { kicker: string; heading: string; intro: string };
  details: {
    /** Group label (with its icon). */
    location: string;
    /** Group label (with its icon). */
    phone: string;
    /** Sub-label of the phone number that calls. */
    inquiryLine: string;
    /** Sub-label of the phone number that opens WhatsApp. */
    whatsapp: string;
    /** Group label (with its icon). */
    email: string;
  };
  /** The outlined button that opens WhatsApp with the page language's prefilled sentence. */
  whatsappCta: string;
  confidence: { heading: string; body: string };
  team: { title: string };
  /** Screen-reader suffix for a link that opens in a new tab (the same line as the footer's). */
  newTab: string;
};

export const CONTACT_PAGE_COPY: Record<ContactPageLocale, ContactPageCopy> = {
  en: {
    meta: {
      title: "Book with ALMAR | Contact",
      description:
        "Call +971 56 388 3302 or email inquiries@almarprivatejourney.com. Tell us your dates and we plan the rest.",
    },
    title: {
      kicker: "Private Journeys",
      heading: "Plan Your Journey",
      intro:
        "Your private Colombia journey begins with a message. Share your vision and our team will craft every detail.",
    },
    details: {
      location: "Location",
      phone: "Phone",
      inquiryLine: "Inquiry Line",
      whatsapp: "WhatsApp",
      email: "Email",
    },
    whatsappCta: "Message on WhatsApp",
    confidence: {
      heading: "Travel With Confidence",
      body: "Every journey is planned with selected local partners, private transfer coordination, bilingual trip support, and a 24/7 emergency contact. Additional security, insurance, and medical arrangements are confirmed before booking.",
    },
    team: { title: "You’ll be in good hands." },
    newTab: "(opens in a new tab)",
  },
  ar: {
    meta: {
      title: "احجز مع ALMAR | تواصل",
      description:
        "اتصلوا على +971 56 388 3302 أو راسلوا inquiries@almarprivatejourney.com. أخبرونا بتواريخكم ونتولى الباقي.",
    },
    title: {
      kicker: "رحلات خاصة",
      heading: "خطط لرحلتك",
      intro: "تبدأ رحلتكم الخاصة في كولومبيا برسالة. شاركونا رؤيتكم وسيعتني فريقنا بكل تفصيل.",
    },
    details: {
      location: "الموقع",
      phone: "الهاتف",
      inquiryLine: "خط الاستفسارات",
      whatsapp: "واتساب",
      email: "البريد الإلكتروني",
    },
    whatsappCta: "راسلونا على واتساب",
    confidence: {
      heading: "سافر بثقة",
      body: "تُخطَّط كل رحلة مع شركاء محليين مختارين، وتنسيق للتنقلات الخاصة، ودعم ثنائي اللغة، ورقم طوارئ على مدار الساعة. وتُؤكَّد ترتيبات الأمن والتأمين والرعاية الطبية الإضافية قبل الحجز.",
    },
    team: { title: "ستكونون بين أيدٍ أمينة." },
    newTab: "(يفتح في تبويب جديد)",
  },
  es: {
    meta: {
      title: "Reserva con ALMAR | Contacto",
      description:
        "Llama al +971 56 388 3302 o escribe a inquiries@almarprivatejourney.com. Cuéntanos tus fechas y nosotros planificamos el resto.",
    },
    title: {
      kicker: "Viajes privados",
      heading: "Planifica tu viaje",
      intro:
        "Tu viaje privado por Colombia comienza con un mensaje. Comparte tu visión y nuestro equipo cuidará cada detalle.",
    },
    details: {
      location: "Ubicación",
      phone: "Teléfono",
      inquiryLine: "Línea de consultas",
      whatsapp: "WhatsApp",
      email: "Correo electrónico",
    },
    whatsappCta: "Escríbenos por WhatsApp",
    confidence: {
      heading: "Viaja con confianza",
      body: "Cada viaje se planifica con socios locales seleccionados, coordinación de traslados privados, apoyo bilingüe durante el viaje y un contacto de emergencia disponible las 24 horas. Los arreglos adicionales de seguridad, seguros y atención médica se confirman antes de reservar.",
    },
    team: { title: "Estarás en buenas manos." },
    newTab: "(se abre en una pestaña nueva)",
  },
};

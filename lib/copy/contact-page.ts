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
// The inquiry form (plan 26): `startInquiry` and `form`. The owner SIGNED every one of these strings in EN, AR and ES
// with the part B pictures on 2026-10-14 (.planning/phases/03.3-public-site-in-react/s3-pictures/partb-states.json;
// tests/contact-page-copy.test.mjs pins them). EN labels, the placeholder, the journey types, `Request Consultation` and
// `Start Your Inquiry` are the live Framer form's text; the EN heading, `sending`, `sent`, `failed` and the errors were
// DRAFTED UI COPY, now signed. Public Spanish is "tú"; Arabic is the respectful plural. `failed` holds `{email}` and
// `{whatsapp}` once each (the form renders them as links: the inbox address and `whatsappWord`); `tooLong` holds `{max}`.
// No privacy or consent line (owner: Phase 6).
//
// The footer strings are in lib/copy/site-footer.ts (S3-24), so there is no footer key; `newTab` repeats
// SITE_FOOTER_COPY[l].newTab as a literal (this file has no value import, so `node --test` loads it directly) and
// tests/contact-page-copy.test.mjs pins the two.

import type { JourneyType } from "../contact-inquiry";
// Imported directly by components/pages/contact/*; deliberately not registered in lib/copy/index.ts (reconcile R-9).

export type ContactPageLocale = "en" | "ar" | "es";

/** The Contact inquiry form's strings (plan 26). */
export type InquiryFormCopy = {
  /** The box's visually hidden h2, the form's accessible name. */
  heading: string;
  name: string;
  phone: string;
  email: string;
  journeyType: string;
  journeyTypePlaceholder: string;
  /** The localised label of each submitted (English) journey type. */
  journeyTypes: Record<JourneyType, string>;
  /** The textarea's label. */
  details: string;
  submit: string;
  /** The submit button's label while the inquiry is on its way. */
  sending: string;
  sent: string;
  /** `{email}` and `{whatsapp}` become links. */
  failed: string;
  /** The `{whatsapp}` link's text. */
  whatsappWord: string;
  errors: {
    nameRequired: string;
    emailRequired: string;
    emailInvalid: string;
    phoneInvalid: string;
    journeyTypeRequired: string;
    detailsRequired: string;
    /** `{max}` is the field's character cap. */
    tooLong: string;
  };
};

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
  /** The outlined link under Travel With Confidence to the form box (#inquiry). */
  startInquiry: string;
  form: InquiryFormCopy;
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
    startInquiry: "Start Your Inquiry",
    form: {
      heading: "Tell us about your journey",
      name: "Your Name",
      phone: "Phone / WhatsApp",
      email: "Email",
      journeyType: "Journey Type",
      journeyTypePlaceholder: "Select type",
      journeyTypes: {
        Experiences: "Experiences",
        Services: "Services",
        "Full Journey": "Full Journey",
        "Group Event": "Group Event",
        "General Question": "General Question",
      },
      details: "Tell Us About Your Journey",
      submit: "Request Consultation",
      sending: "Sending…",
      sent: "Your message was sent.",
      failed: "It did not send. Write to {email} or message us on {whatsapp}.",
      whatsappWord: "WhatsApp",
      errors: {
        nameRequired: "Enter your name.",
        emailRequired: "Enter your email address.",
        emailInvalid: "Check the email address.",
        phoneInvalid: "Check the phone number.",
        journeyTypeRequired: "Choose a journey type.",
        detailsRequired: "Write a few words about your journey.",
        tooLong: "Keep this under {max} characters.",
      },
    },
    team: { title: "You’ll be in good hands." },
    newTab: "(opens in a new tab)",
  },
  ar: {
    meta: {
      title: "احجزوا مع ALMAR | تواصل",
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
    startInquiry: "ابدأوا استفساركم",
    form: {
      heading: "أخبرونا عن رحلتكم",
      name: "الاسم",
      phone: "الهاتف / واتساب",
      email: "البريد الإلكتروني",
      journeyType: "نوع الرحلة",
      journeyTypePlaceholder: "اختاروا النوع",
      journeyTypes: {
        Experiences: "تجارب",
        Services: "خدمات",
        "Full Journey": "رحلة كاملة",
        "Group Event": "فعالية جماعية",
        "General Question": "سؤال عام",
      },
      details: "أخبرونا عن رحلتكم",
      submit: "اطلبوا استشارة",
      sending: "جارٍ الإرسال…",
      sent: "أُرسلت رسالتكم.",
      failed: "لم تُرسَل الرسالة. راسلونا على {email} أو على {whatsapp}.",
      whatsappWord: "واتساب",
      errors: {
        nameRequired: "أدخلوا اسمكم.",
        emailRequired: "أدخلوا بريدكم الإلكتروني.",
        emailInvalid: "تحقّقوا من البريد الإلكتروني.",
        phoneInvalid: "تحقّقوا من رقم الهاتف.",
        journeyTypeRequired: "اختاروا نوع الرحلة.",
        detailsRequired: "اكتبوا بضع كلمات عن رحلتكم.",
        tooLong: "لا تتجاوزوا {max} حرف.",
      },
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
    startInquiry: "Inicia tu consulta",
    form: {
      heading: "Cuéntanos sobre tu viaje",
      name: "Tu nombre",
      phone: "Teléfono / WhatsApp",
      email: "Correo electrónico",
      journeyType: "Tipo de viaje",
      journeyTypePlaceholder: "Elige el tipo",
      journeyTypes: {
        Experiences: "Experiencias",
        Services: "Servicios",
        "Full Journey": "Viaje completo",
        "Group Event": "Evento de grupo",
        "General Question": "Pregunta general",
      },
      details: "Cuéntanos sobre tu viaje",
      submit: "Solicita una consulta",
      sending: "Enviando…",
      sent: "Tu mensaje se envió.",
      failed: "No se envió. Escribe a {email} o escríbenos por {whatsapp}.",
      whatsappWord: "WhatsApp",
      errors: {
        nameRequired: "Escribe tu nombre.",
        emailRequired: "Escribe tu correo electrónico.",
        emailInvalid: "Revisa el correo electrónico.",
        phoneInvalid: "Revisa el número de teléfono.",
        journeyTypeRequired: "Elige un tipo de viaje.",
        detailsRequired: "Escribe unas palabras sobre tu viaje.",
        tooLong: "Usa menos de {max} caracteres.",
      },
    },
    team: { title: "Estarás en buenas manos." },
    newTab: "(se abre en una pestaña nueva)",
  },
};

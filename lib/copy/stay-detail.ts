// Strings of the private-stay detail page (phase 3.3 plan 06). Imported directly by
// components/pages/stay-detail-page.tsx; not registered in lib/copy/index.ts (reconcile R-9).
//
// EN is the published text, read from the 12 live stay pages on 2026-10-03, verbatim.
// AR (Gulf-friendly Modern Standard Arabic) and ES (neutral Latin American, formal plural) are DRAFTS written
// from the published English, flagged for the owner's review (the lib/copy/journey.ts convention).
// Names of properties and neighbourhoods keep their Spanish spelling and are not in this file: they come from
// lib/data.
//
// `{title}`, `{alt}`, `{n}` and `{total}` are slots. Numbers and dates are Western numerals in every language.

export type StayDetailLocale = "en" | "ar" | "es";

export type StayDetailCopy = {
  about: string;
  amenities: string;
  amenitiesIntro: string;
  policies: string;
  services: string;
  servicesIntro: string;
  experiences: string;
  experiencesIntro: string;
  related: string;
  facts: {
    guests: string;
    bathrooms: string;
    bedrooms: string;
    beds: string;
    neighborhood: string;
  };
  inclusionsLabel: string;
  requestInquiry: string;
  /** DRAFTED UI COPY (AR/ES): the slideshow's names. `{title}` the stay, `{n}` and `{total}` slide numbers. */
  gallery: {
    region: string;
    previous: string;
    next: string;
    /** `{n} of {total}`: a slide's name and the live line. */
    slide: string;
    /** A dot's name. */
    goTo: string;
    pause: string;
    play: string;
  };
  /** The More Private Stays button, to the list. */
  relatedViewAll: string;
  /**
   * Request on WhatsApp. The message lines are the signed text of 11-DESIGN section 2 (EN); AR and ES are the
   * designer's drafts, flagged for the owner's review. `button` is DRAFTED UI COPY in AR and ES.
   */
  whatsapp: {
    button: string;
    greeting: string;
    dates: string;
    datesNone: string;
    guests: string;
    guestJoin: string;
  };
  /** Board 5i's own footnote, shown while the blocked dates are examples (sample_fields). */
  sampleDatesNote: string;
  metaTitle: string;
  metaDescription: string;
};

export const STAY_DETAIL_COPY: Record<StayDetailLocale, StayDetailCopy> = {
  en: {
    about: "About",
    amenities: "Amenities",
    amenitiesIntro: "Selected amenities included with this private stay.",
    policies: "Policies to check",
    services: "Services",
    servicesIntro: "Arrangements available with this private stay.",
    experiences: "Experiences",
    experiencesIntro: "Experiences suited to this private stay and its setting.",
    related: "More Private Stays",
    facts: {
      guests: "Guests",
      bathrooms: "Bathrooms",
      bedrooms: "Bedrooms",
      beds: "Beds",
      neighborhood: "Neighborhood",
    },
    inclusionsLabel: "Included with the stay:",
    requestInquiry: "Request Inquiry",
    gallery: {
      region: "Photos of {title}",
      previous: "Previous picture",
      next: "Next picture",
      slide: "{n} of {total}",
      goTo: "Show photo {n}",
      pause: "Pause slideshow",
      play: "Play slideshow",
    },
    relatedViewAll: "View All Private Stays",
    whatsapp: {
      button: "Request on WhatsApp",
      greeting: "Hello ALMAR, I would like to request {title} ({destination}).",
      dates: "Dates: {from} to {to} ({nights})",
      datesNone: "Dates: not chosen yet",
      guests: "Guests: {guests}",
      guestJoin: ", ",
    },
    sampleDatesNote: "Blocked dates here are examples.",
    metaTitle: "{title} — private stay in Colombia | ALMAR",
    metaDescription:
      "Book {title} as a private stay in Colombia. ALMAR checks the home, handles staff, and plans your trip.",
  },
  ar: {
    about: "نبذة",
    amenities: "المرافق",
    amenitiesIntro: "مرافق مختارة مشمولة في هذه الإقامة الخاصة.",
    policies: "سياسات يُرجى مراجعتها",
    services: "الخدمات",
    servicesIntro: "ترتيبات متاحة مع هذه الإقامة الخاصة.",
    experiences: "التجارب",
    experiencesIntro: "تجارب تناسب هذه الإقامة الخاصة ومحيطها.",
    related: "المزيد من الإقامات الخاصة",
    facts: {
      guests: "الضيوف",
      bathrooms: "الحمامات",
      bedrooms: "غرف النوم",
      beds: "الأسرّة",
      neighborhood: "الحي",
    },
    inclusionsLabel: "مشمول مع الإقامة:",
    requestInquiry: "اطلبوا استفساراً",
    gallery: {
      region: "صور {title}",
      previous: "الصورة السابقة",
      next: "الصورة التالية",
      slide: "{n} من {total}",
      goTo: "عرض الصورة {n}",
      pause: "إيقاف العرض مؤقتاً",
      play: "تشغيل العرض",
    },
    relatedViewAll: "عرض كل الإقامات الخاصة",
    whatsapp: {
      button: "اطلب عبر واتساب",
      greeting: "مرحباً المار، أودّ طلب {title} ({destination}).",
      dates: "التواريخ: من {from} إلى {to} ({nights})",
      datesNone: "التواريخ: لم تُحدَّد بعد",
      guests: "الضيوف: {guests}",
      guestJoin: "، ",
    },
    sampleDatesNote: "التواريخ المحجوبة هنا أمثلة.",
    metaTitle: "{title} — إقامة خاصة في كولومبيا | ALMAR",
    metaDescription:
      "احجزوا {title} كإقامة خاصة في كولومبيا. تتحقق ALMAR من المنزل وتتولى شؤون الطاقم وتخطط لرحلتكم.",
  },
  es: {
    about: "Acerca de",
    amenities: "Comodidades",
    amenitiesIntro: "Comodidades seleccionadas incluidas en esta estancia privada.",
    policies: "Políticas a revisar",
    services: "Servicios",
    servicesIntro: "Arreglos disponibles con esta estancia privada.",
    experiences: "Experiencias",
    experiencesIntro: "Experiencias pensadas para esta estancia privada y su entorno.",
    related: "Más estancias privadas",
    facts: {
      guests: "Huéspedes",
      bathrooms: "Baños",
      bedrooms: "Habitaciones",
      beds: "Camas",
      neighborhood: "Barrio",
    },
    inclusionsLabel: "Incluido en la estancia:",
    requestInquiry: "Solicitar información",
    gallery: {
      region: "Fotos de {title}",
      previous: "Imagen anterior",
      next: "Imagen siguiente",
      slide: "{n} de {total}",
      goTo: "Ver foto {n}",
      pause: "Pausar presentación",
      play: "Reproducir presentación",
    },
    relatedViewAll: "Ver todas las estancias privadas",
    whatsapp: {
      button: "Solicitar por WhatsApp",
      greeting: "Hola ALMAR, me gustaría solicitar {title} ({destination}).",
      dates: "Fechas: del {from} al {to} ({nights})",
      datesNone: "Fechas: aún sin elegir",
      guests: "Huéspedes: {guests}",
      guestJoin: ", ",
    },
    sampleDatesNote: "Las fechas bloqueadas aquí son ejemplos.",
    metaTitle: "{title} — estancia privada en Colombia | ALMAR",
    metaDescription:
      "Reserven {title} como estancia privada en Colombia. ALMAR revisa la casa, se ocupa del personal y planifica su viaje.",
  },
};

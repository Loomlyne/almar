// Dashboard copy for Content -> Pages (plan 06-02, CMS-07), EN / AR / ES. Signed by the owner with the 06-02 pictures
// (decisions/2026-10-27-06-02-06-03-pictures-signed.md): English ours, Arabic and Spanish his approved drafts, dashboard
// Spanish usted. Only the dashboard: no public-site text is written here.

import type { PageKey } from "../data/page-sections";

export type OpsPagesLocale = "en" | "ar" | "es";

export type OpsPagesCopy = {
  pageNames: Record<PageKey, string>;
  colPage: string;
  colShown: string;
  /** "{n} of {m} sections shown". */
  shownOf: string;
  colSection: string;
  orderNote: string;
  /** One owner label per section of lib/data/page-sections.ts PAGE_SECTIONS. */
  sections: { [K in PageKey]: Record<string, string> };
  /** Field labels per text column; `paragraph` takes {n}; title and body are the About cards'. */
  fields: Record<
    | "kicker"
    | "heading"
    | "headline"
    | "intro"
    | "salutation"
    | "paragraph"
    | "sign_off"
    | "signer"
    | "signer_role"
    | "statement"
    | "body"
    | "cta_label"
    | "title",
    string
  >;
  showOnSite: string;
  hiddenNote: string;
  shown: string;
  hidden: string;
  photo: string;
  photos: string;
  signature: string;
  choosePhoto: string;
  addPhotos: string;
  remove: string;
  videoSec: string;
  video: string;
  videoBad: string;
  decorative: string;
  /** The owner's answer A (2026-10-27): a hero is always shown. */
  heroFixed: string;
  cards: string;
  addCard: string;
  deleteCard: string;
  deleteCardTitle: string;
  deleteCardText: string;
  /** The heading of each photo slot (lib/data/page-sections.ts MEDIA_SLOTS names). */
  slots: Record<string, string>;
};

export const OPS_PAGES_COPY: Record<OpsPagesLocale, OpsPagesCopy> = {
  en: {
    pageNames: {
      home: "Home",
      about: "About",
      destinations: "Destinations",
      experiences: "Experiences",
      contact: "Contact",
    },
    colPage: "Page",
    colShown: "On the site",
    shownOf: "{n} of {m} sections shown",
    colSection: "Section",
    orderNote: "Sections appear on the site in this order.",
    sections: {
      home: {
        hero: "Hero and booking bar",
        welcome: "Welcome letter",
        gallery: "Photo gallery",
        stays: "Private stays",
        services: "Services",
        moments: "Destination moments",
        journeys: "Journeys",
        stories: "Stories",
        begin: "Begin your journey",
        team: "Team",
      },
      about: {
        hero: "Hero",
        intro: "Introduction and photos",
        story: "Our story cards",
        values: "Values cards",
        team: "Team",
        get_in_touch: "Get in touch",
      },
      destinations: {
        hero: "Hero photos",
      },
      experiences: {
        hero: "Hero",
      },
      contact: {
        title: "Title and hero",
        confidence: "Travel with confidence",
        team: "Team",
      },
    },
    fields: {
      kicker: "Small line above the heading",
      heading: "Heading",
      headline: "Main heading",
      intro: "Introduction",
      salutation: "Greeting",
      paragraph: "Paragraph {n}",
      sign_off: "Closing line",
      signer: "Signed by",
      signer_role: "Signer's role",
      statement: "Statement",
      body: "Text",
      cta_label: "Button label",
      title: "Title",
    },
    showOnSite: "Show on site",
    hiddenNote: "Hidden on the site",
    shown: "Shown",
    hidden: "Hidden",
    photo: "Photo",
    photos: "Photos",
    signature: "Signature",
    choosePhoto: "Choose photo",
    addPhotos: "Add photos",
    remove: "Remove",
    videoSec: "Hero video",
    video: "Hero video (https address)",
    videoBad: "Use an address that starts with https://",
    decorative: "Decorative: no description is read on the site",
    heroFixed:
      "This section is the page's main heading, so it is always shown.",
    cards: "Cards",
    addCard: "Add card",
    deleteCard: "Delete card",
    deleteCardTitle: "Delete this card?",
    deleteCardText: "It is removed from the site after the update.",
    slots: {
      poster: "Photo",
      image: "Photo",
      images: "Photos",
      signature: "Signature",
      still: "Photo",
      cta_image: "Photo",
    },
  },
  ar: {
    pageNames: {
      home: "الرئيسية",
      about: "عنّا",
      destinations: "الوجهات",
      experiences: "التجارب",
      contact: "تواصل",
    },
    colPage: "الصفحة",
    colShown: "على الموقع",
    shownOf: "{n} من {m} أقسام ظاهرة",
    colSection: "القسم",
    orderNote: "تظهر الأقسام على الموقع بهذا الترتيب.",
    sections: {
      home: {
        hero: "الواجهة وشريط الحجز",
        welcome: "رسالة الترحيب",
        gallery: "معرض الصور",
        stays: "الإقامات الخاصة",
        services: "الخدمات",
        moments: "لحظات الوجهات",
        journeys: "الرحلات",
        stories: "الحكايات",
        begin: "ابدأ رحلتك",
        team: "الفريق",
      },
      about: {
        hero: "الواجهة",
        intro: "المقدمة والصور",
        story: "بطاقات قصتنا",
        values: "بطاقات القيم",
        team: "الفريق",
        get_in_touch: "تواصل معنا",
      },
      destinations: {
        hero: "صور الواجهة",
      },
      experiences: {
        hero: "الواجهة",
      },
      contact: {
        title: "العنوان والواجهة",
        confidence: "سافر بثقة",
        team: "الفريق",
      },
    },
    fields: {
      kicker: "السطر الصغير فوق العنوان",
      heading: "العنوان",
      headline: "العنوان الرئيسي",
      intro: "المقدمة",
      salutation: "التحية",
      paragraph: "الفقرة {n}",
      sign_off: "عبارة الختام",
      signer: "التوقيع باسم",
      signer_role: "صفة الموقِّع",
      statement: "العبارة",
      body: "النص",
      cta_label: "نص الزر",
      title: "العنوان",
    },
    showOnSite: "إظهار على الموقع",
    hiddenNote: "مخفي على الموقع",
    shown: "ظاهر",
    hidden: "مخفي",
    photo: "الصورة",
    photos: "الصور",
    signature: "التوقيع",
    choosePhoto: "اختيار صورة",
    addPhotos: "إضافة صور",
    remove: "إزالة",
    videoSec: "فيديو الواجهة",
    video: "فيديو الواجهة (عنوان https)",
    videoBad: "استخدم عنوانًا يبدأ بـ https://",
    decorative: "زخرفية: لا يُقرأ لها وصف على الموقع",
    heroFixed: "هذا القسم هو العنوان الرئيسي للصفحة، لذلك يظهر دائمًا.",
    cards: "البطاقات",
    addCard: "إضافة بطاقة",
    deleteCard: "حذف البطاقة",
    deleteCardTitle: "حذف هذه البطاقة؟",
    deleteCardText: "تُزال من الموقع بعد التحديث.",
    slots: {
      poster: "الصورة",
      image: "الصورة",
      images: "الصور",
      signature: "التوقيع",
      still: "الصورة",
      cta_image: "الصورة",
    },
  },
  es: {
    pageNames: {
      home: "Inicio",
      about: "Nosotros",
      destinations: "Destinos",
      experiences: "Experiencias",
      contact: "Contacto",
    },
    colPage: "Página",
    colShown: "En el sitio",
    shownOf: "{n} de {m} secciones visibles",
    colSection: "Sección",
    orderNote: "Las secciones aparecen en el sitio en este orden.",
    sections: {
      home: {
        hero: "Portada y barra de reserva",
        welcome: "Carta de bienvenida",
        gallery: "Galería de fotos",
        stays: "Estancias privadas",
        services: "Servicios",
        moments: "Momentos de destino",
        journeys: "Viajes",
        stories: "Historias",
        begin: "Comience su viaje",
        team: "Equipo",
      },
      about: {
        hero: "Portada",
        intro: "Introducción y fotos",
        story: "Tarjetas de nuestra historia",
        values: "Tarjetas de valores",
        team: "Equipo",
        get_in_touch: "Contacto",
      },
      destinations: {
        hero: "Fotos de portada",
      },
      experiences: {
        hero: "Portada",
      },
      contact: {
        title: "Título y portada",
        confidence: "Viaje con confianza",
        team: "Equipo",
      },
    },
    fields: {
      kicker: "Línea pequeña sobre el título",
      heading: "Título",
      headline: "Título principal",
      intro: "Introducción",
      salutation: "Saludo",
      paragraph: "Párrafo {n}",
      sign_off: "Despedida",
      signer: "Firmado por",
      signer_role: "Cargo de quien firma",
      statement: "Frase",
      body: "Texto",
      cta_label: "Texto del botón",
      title: "Título",
    },
    showOnSite: "Mostrar en el sitio",
    hiddenNote: "Oculta en el sitio",
    shown: "Visible",
    hidden: "Oculta",
    photo: "Foto",
    photos: "Fotos",
    signature: "Firma",
    choosePhoto: "Elegir foto",
    addPhotos: "Añadir fotos",
    remove: "Quitar",
    videoSec: "Video de portada",
    video: "Video de portada (dirección https)",
    videoBad: "Use una dirección que empiece por https://",
    decorative: "Decorativa: en el sitio no se lee ninguna descripción",
    heroFixed:
      "Esta sección es el título principal de la página, por eso siempre se muestra.",
    cards: "Tarjetas",
    addCard: "Añadir tarjeta",
    deleteCard: "Eliminar tarjeta",
    deleteCardTitle: "¿Eliminar esta tarjeta?",
    deleteCardText: "Se quita del sitio después de la actualización.",
    slots: {
      poster: "Foto",
      image: "Foto",
      images: "Fotos",
      signature: "Firma",
      still: "Foto",
      cta_image: "Foto",
    },
  },
};

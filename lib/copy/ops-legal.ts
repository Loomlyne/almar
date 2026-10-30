// Dashboard copy for Content -> Legal (plan 06-04, F-07), EN / AR / ES. Signed by the owner with the 06-04 pictures
// (decisions/2026-10-30-06-04-06-05-06-07-pictures-signed.md), taken verbatim from the signed page: English ours, Arabic and
// Spanish his approved drafts, dashboard Spanish usted. Interface labels only: every legal text is the owner's (F-07).

export type OpsLegalLocale = "en" | "ar" | "es";

export type OpsLegalKind = "privacy" | "terms" | "booking_terms" | "waiver" | "disclaimer" | "cookie_banner";
export type OpsLegalStatus = "none" | "draft" | "published";
export type OpsLegalBlockKind = "heading" | "paragraph" | "quote";

export type OpsLegalCopy = {
  title: string;
  colTitle: string;
  colStatus: string;
  kinds: Record<OpsLegalKind, string>;
  status: Record<OpsLegalStatus, string>;
  /** The card holding the title. */
  text: string;
  f: {
    title: string;
    seoTitle: string;
    seoDescription: string;
    blocks: string;
    addHeading: string;
    addParagraph: string;
    addQuote: string;
    remove: string;
    necLabel: string;
    necText: string;
    anLabel: string;
    anText: string;
  };
  bk: Record<OpsLegalBlockKind, string>;
  empty: string;
  bookingNote: string;
  seo: string;
  optional: string;
  /** The card holding the four banner fields. */
  cookieSettings: string;
};

export const OPS_LEGAL_COPY: Record<OpsLegalLocale, OpsLegalCopy> = {
  en: {
    title: "Legal",
    colTitle: "Page",
    colStatus: "Status",
    kinds: {
      privacy: "Privacy policy",
      terms: "Terms of use",
      booking_terms: "Booking terms",
      waiver: "Waiver",
      disclaimer: "Disclaimer",
      cookie_banner: "Cookie banner",
    },
    status: {
      none: "Not written",
      draft: "Draft",
      published: "Published",
    },
    text: "Text",
    f: {
      title: "Title",
      seoTitle: "SEO title",
      seoDescription: "SEO description",
      blocks: "Text blocks",
      addHeading: "Add heading",
      addParagraph: "Add paragraph",
      addQuote: "Add quote",
      remove: "Remove block",
      necLabel: "Necessary label",
      necText: "Necessary text",
      anLabel: "Analytics label",
      anText: "Analytics text",
    },
    bk: {
      heading: "Heading",
      paragraph: "Paragraph",
      quote: "Quote",
    },
    empty: "No text yet. This page is not on the site until you publish it.",
    bookingNote: "When published, guests accept this text before paying.",
    seo: "Search engines",
    optional: "optional",
    cookieSettings: "Cookie settings",
  },
  ar: {
    title: "القانوني",
    colTitle: "الصفحة",
    colStatus: "الحالة",
    kinds: {
      privacy: "سياسة الخصوصية",
      terms: "شروط الاستخدام",
      booking_terms: "شروط الحجز",
      waiver: "إقرار إخلاء المسؤولية",
      disclaimer: "إخلاء المسؤولية",
      cookie_banner: "لافتة ملفات الارتباط",
    },
    status: {
      none: "غير مكتوبة",
      draft: "مسودة",
      published: "منشورة",
    },
    text: "النص",
    f: {
      title: "العنوان",
      seoTitle: "عنوان SEO",
      seoDescription: "وصف SEO",
      blocks: "أجزاء النص",
      addHeading: "إضافة عنوان فرعي",
      addParagraph: "إضافة فقرة",
      addQuote: "إضافة اقتباس",
      remove: "حذف الجزء",
      necLabel: "عنوان الضرورية",
      necText: "نص الضرورية",
      anLabel: "عنوان التحليلات",
      anText: "نص التحليلات",
    },
    bk: {
      heading: "عنوان فرعي",
      paragraph: "فقرة",
      quote: "اقتباس",
    },
    empty: "لا يوجد نص بعد. هذه الصفحة ليست على الموقع حتى تنشرها.",
    bookingNote: "عند النشر، يوافق الضيوف على هذا النص قبل الدفع.",
    seo: "محركات البحث",
    optional: "اختياري",
    cookieSettings: "إعدادات ملفات الارتباط",
  },
  es: {
    title: "Legal",
    colTitle: "Página",
    colStatus: "Estado",
    kinds: {
      privacy: "Política de privacidad",
      terms: "Términos de uso",
      booking_terms: "Condiciones de reserva",
      waiver: "Exención de responsabilidad",
      disclaimer: "Aviso legal",
      cookie_banner: "Banner de cookies",
    },
    status: {
      none: "Sin redactar",
      draft: "Borrador",
      published: "Publicada",
    },
    text: "Texto",
    f: {
      title: "Título",
      seoTitle: "Título SEO",
      seoDescription: "Descripción SEO",
      blocks: "Bloques de texto",
      addHeading: "Añadir encabezado",
      addParagraph: "Añadir párrafo",
      addQuote: "Añadir cita",
      remove: "Eliminar bloque",
      necLabel: "Título de las necesarias",
      necText: "Texto de las necesarias",
      anLabel: "Título de analítica",
      anText: "Texto de analítica",
    },
    bk: {
      heading: "Encabezado",
      paragraph: "Párrafo",
      quote: "Cita",
    },
    empty: "Aún no hay texto. Esta página no está en el sitio hasta que la publique.",
    bookingNote: "Una vez publicada, los huéspedes aceptan este texto antes de pagar.",
    seo: "Buscadores",
    optional: "opcional",
    cookieSettings: "Ajustes de cookies",
  },
};

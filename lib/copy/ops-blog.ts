// Dashboard copy for Content -> Blog (plan 06-03, SITE-10, F-08), EN / AR / ES. Signed by the owner with the 06-03
// pictures (decisions/2026-10-27-06-02-06-03-pictures-signed.md): English ours, Arabic and Spanish his approved drafts,
// dashboard Spanish usted. No word copied from another product; no text beyond these interface labels.

export type OpsBlogLocale = "en" | "ar" | "es";

export type OpsBlogCopy = {
  newPost: string;
  search: string;
  colTitle: string;
  colStatus: string;
  colDate: string;
  empty: string;
  /** `{q}` is the query. */
  noMatch: string;
  sec: {
    basics: string;
    cover: string;
    body: string;
    linked: string;
    seo: string;
  };
  optional: string;
  f: {
    title: string;
    address: string;
    addressLocked: string;
    cover: string;
    date: string;
    excerpt: string;
    seoTitle: string;
    seoDescription: string;
    destination: string;
    stay: string;
    experience: string;
    none: string;
  };
  kinds: Record<"heading" | "paragraph" | "photo" | "quote", string>;
  add: Record<"heading" | "paragraph" | "photo" | "quote", string>;
  deleteBlock: string;
  alt: string;
  /** "{kind} {n}": a block's name in the translation boxes and the missing list. */
  blockLabel: string;
  /** "{n}" is the block number. */
  missingAr: string;
  missingEs: string;
  futureDate: string;
};

export const OPS_BLOG_COPY: Record<OpsBlogLocale, OpsBlogCopy> = {
  en: {
    newPost: "New post",
    search: "Search posts",
    colTitle: "Title",
    colStatus: "Status",
    colDate: "Date",
    empty: "No posts yet.",
    noMatch: "No post matches “{q}”.",
    sec: {
      basics: "Basics",
      cover: "Cover photo",
      body: "Body",
      linked: "Linked to",
      seo: "Search engines",
    },
    optional: "optional",
    f: {
      title: "Title",
      address: "Web address",
      addressLocked: "The address is fixed once the post has been published.",
      cover: "Cover photo",
      date: "Date",
      excerpt: "Excerpt",
      seoTitle: "Search engine title",
      seoDescription: "Search engine description",
      destination: "Destination",
      stay: "Featured stay",
      experience: "Featured experience",
      none: "None",
    },
    kinds: {
      heading: "Heading",
      paragraph: "Paragraph",
      photo: "Photo",
      quote: "Quote",
    },
    add: {
      heading: "Add a heading",
      paragraph: "Add a paragraph",
      photo: "Add a photo",
      quote: "Add a quote",
    },
    deleteBlock: "Delete block",
    alt: "Alt text (from the media library)",
    blockLabel: "{kind} {n}",
    missingAr: "Arabic text of block {n}",
    missingEs: "Spanish text of block {n}",
    futureDate: "The date cannot be later than today.",
  },
  ar: {
    newPost: "منشور جديد",
    search: "ابحث في المنشورات",
    colTitle: "العنوان",
    colStatus: "الحالة",
    colDate: "التاريخ",
    empty: "لا توجد منشورات بعد.",
    noMatch: "لا يوجد منشور يطابق «{q}».",
    sec: {
      basics: "الأساسيات",
      cover: "صورة الغلاف",
      body: "المتن",
      linked: "مرتبط بـ",
      seo: "محركات البحث",
    },
    optional: "اختياري",
    f: {
      title: "العنوان",
      address: "عنوان الويب",
      addressLocked: "يثبت العنوان بعد نشر المنشور.",
      cover: "صورة الغلاف",
      date: "التاريخ",
      excerpt: "المقتطف",
      seoTitle: "العنوان في محركات البحث",
      seoDescription: "الوصف في محركات البحث",
      destination: "الوجهة",
      stay: "الإقامة المميزة",
      experience: "التجربة المميزة",
      none: "لا شيء",
    },
    kinds: {
      heading: "عنوان فرعي",
      paragraph: "فقرة",
      photo: "صورة",
      quote: "اقتباس",
    },
    add: {
      heading: "إضافة عنوان فرعي",
      paragraph: "إضافة فقرة",
      photo: "إضافة صورة",
      quote: "إضافة اقتباس",
    },
    deleteBlock: "حذف الجزء",
    alt: "النص البديل (من مكتبة الوسائط)",
    blockLabel: "{kind} {n}",
    missingAr: "النص العربي للجزء {n}",
    missingEs: "النص الإسباني للجزء {n}",
    futureDate: "لا يمكن أن يكون التاريخ بعد اليوم.",
  },
  es: {
    newPost: "Nueva entrada",
    search: "Buscar entradas",
    colTitle: "Título",
    colStatus: "Estado",
    colDate: "Fecha",
    empty: "Aún no hay entradas.",
    noMatch: "Ninguna entrada coincide con «{q}».",
    sec: {
      basics: "Datos básicos",
      cover: "Foto de portada",
      body: "Cuerpo",
      linked: "Vinculada a",
      seo: "Buscadores",
    },
    optional: "opcional",
    f: {
      title: "Título",
      address: "Dirección web",
      addressLocked: "La dirección queda fija una vez publicada la entrada.",
      cover: "Foto de portada",
      date: "Fecha",
      excerpt: "Extracto",
      seoTitle: "Título para buscadores",
      seoDescription: "Descripción para buscadores",
      destination: "Destino",
      stay: "Estancia destacada",
      experience: "Experiencia destacada",
      none: "Ninguno",
    },
    kinds: {
      heading: "Encabezado",
      paragraph: "Párrafo",
      photo: "Foto",
      quote: "Cita",
    },
    add: {
      heading: "Añadir un encabezado",
      paragraph: "Añadir un párrafo",
      photo: "Añadir una foto",
      quote: "Añadir una cita",
    },
    deleteBlock: "Eliminar bloque",
    alt: "Texto alternativo (de la biblioteca de medios)",
    blockLabel: "{kind} {n}",
    missingAr: "Texto en árabe del bloque {n}",
    missingEs: "Texto en español del bloque {n}",
    futureDate: "La fecha no puede ser posterior a hoy.",
  },
};

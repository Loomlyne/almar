// Copy for the Content sections that stay out of v1 (Pages, Blog, Legal, Navigation and footer: "Coming soon") and the
// rail words they add (the Soon chip, the Navigation and footer entry), phase 3.2 plan 12. New file; the shared
// lib/copy/dashboard.ts is not edited. Imported directly; deliberately not registered in lib/copy/index.ts.
//
// Two separate namespaces on purpose: `rail` holds single rail LABELS (strings) and `comingSoon` holds whole page BLOCKS
// (objects). A label and a block must never share a key: an earlier picture script had `navigation` for both, the object
// won, and the rail printed "[object Object]". tests/phase-03-content.test.mjs pins every rail string.
//
// CANVAS strings are taken word for word from the design canvas boards DashContent (Pages, rail, Soon) and DashPosts
// (Blog) in all three languages. `legal` and `navigation` are two short blocks drafted for this job and signed by the
// owner with the pictures (2026-10-13, d5339ae): no list (the canvas draws none and none is invented) and no legal or
// policy wording. AR and ES for those two are drafts the owner accepted.

export type OpsContentLocale = "en" | "ar" | "es";
export type ComingSoonKind = "pages" | "blog" | "legal" | "navigation";

export type ComingSoonBlock = {
  /** The card heading, e.g. "Page editing is coming soon". */
  title: string;
  /** One paragraph under it. */
  line: string;
  /** Planned capabilities; empty when the canvas draws none. */
  list: string[];
};

export type OpsContentCopy = {
  /** Single rail labels. Strings only. */
  rail: { navigation: string };
  /** The chip word: "Soon". */
  soon: string;
  /** The rail link's accessible name when it carries the chip; `{label}` is the rail label. */
  soonNamed: string;
  /** One block per Coming soon page. The page heading is the rail label (DashboardCopy, or `rail.navigation`). */
  comingSoon: Record<ComingSoonKind, ComingSoonBlock>;
};

export const OPS_CONTENT_COPY: Record<OpsContentLocale, OpsContentCopy> = {
  en: {
    rail: { navigation: "Navigation and footer" },
    soon: "Soon",
    soonNamed: "{label}, soon",
    comingSoon: {
      pages: {
        title: "Page editing is coming soon",
        line: "For now the public pages are edited outside the dashboard. Editing every page here arrives in a later phase.",
        list: [
          "Edit text and images on every page",
          "Reorder and switch sections on and off",
          "English, Arabic and Spanish for every field",
          "Search title and description per page",
          "Preview before publishing",
          "Add new pages",
        ],
      },
      blog: {
        title: "The blog editor is coming soon",
        line: "Writing and publishing posts from the dashboard arrives in a later phase.",
        list: [
          "Rich text editor in three languages",
          "Cover image and alt text",
          "Destination tag and reading time",
          "Featured stay and experience cards",
          "Schedule or publish",
          "Search title and description",
        ],
      },
      legal: {
        title: "Legal pages are coming soon",
        line: "For now the legal pages are edited outside the dashboard. Editing them here, with versions, arrives in a later phase.",
        list: [],
      },
      navigation: {
        title: "Navigation editing is coming soon",
        line: "Menus, footer links and contact details are edited outside the dashboard for now. Editing them here arrives in a later phase.",
        list: [],
      },
    },
  },
  ar: {
    rail: { navigation: "التنقل والتذييل" },
    soon: "قريبًا",
    soonNamed: "{label}، قريبًا",
    comingSoon: {
      pages: {
        title: "تحرير الصفحات قريبًا",
        line: "تُحرَّر الصفحات العامة حاليًا خارج لوحة التحكم. يصل تحرير كل صفحة هنا في مرحلة لاحقة.",
        list: [
          "تحرير النصوص والصور في كل صفحة",
          "إعادة ترتيب الأقسام وتشغيلها وإيقافها",
          "الإنجليزية والعربية والإسبانية لكل حقل",
          "عنوان ووصف البحث لكل صفحة",
          "المعاينة قبل النشر",
          "إضافة صفحات جديدة",
        ],
      },
      blog: {
        title: "محرر المدونة قريبًا",
        line: "كتابة المقالات ونشرها من لوحة التحكم تصل في مرحلة لاحقة.",
        list: [
          "محرر نصوص غني بثلاث لغات",
          "صورة الغلاف والنص البديل",
          "وسم الوجهة ووقت القراءة",
          "بطاقات إقامة وتجربة مميزتين",
          "الجدولة أو النشر",
          "عنوان ووصف البحث",
        ],
      },
      legal: {
        title: "الصفحات القانونية قريبًا",
        line: "تُحرَّر الصفحات القانونية حاليًا خارج لوحة التحكم. يصل تحريرها هنا، مع الإصدارات، في مرحلة لاحقة.",
        list: [],
      },
      navigation: {
        title: "تحرير التنقل قريبًا",
        line: "تُحرَّر القوائم وروابط التذييل وبيانات التواصل حاليًا خارج لوحة التحكم. يصل تحريرها هنا في مرحلة لاحقة.",
        list: [],
      },
    },
  },
  es: {
    rail: { navigation: "Navegación y pie" },
    soon: "Pronto",
    soonNamed: "{label}, pronto",
    comingSoon: {
      pages: {
        title: "La edición de páginas llega pronto",
        line: "Por ahora las páginas públicas se editan fuera del panel. Editar cada página aquí llega en una fase posterior.",
        list: [
          "Editar textos e imágenes de cada página",
          "Reordenar y activar o desactivar secciones",
          "Inglés, árabe y español en cada campo",
          "Título y descripción de búsqueda por página",
          "Vista previa antes de publicar",
          "Añadir páginas nuevas",
        ],
      },
      blog: {
        title: "El editor del blog llega pronto",
        line: "Escribir y publicar entradas desde el panel llega en una fase posterior.",
        list: [
          "Editor de texto enriquecido en tres idiomas",
          "Imagen de portada y texto alternativo",
          "Etiqueta de destino y tiempo de lectura",
          "Tarjetas de estancia y experiencia destacadas",
          "Programar o publicar",
          "Título y descripción de búsqueda",
        ],
      },
      legal: {
        title: "Las páginas legales llegan pronto",
        line: "Por ahora las páginas legales se editan fuera del panel. Editarlas aquí, con versiones, llega en una fase posterior.",
        list: [],
      },
      navigation: {
        title: "La edición de la navegación llega pronto",
        line: "Por ahora los menús, los enlaces del pie y los datos de contacto se editan fuera del panel. Editarlos aquí llega en una fase posterior.",
        list: [],
      },
    },
  },
};

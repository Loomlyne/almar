// Copy for the dashboard "Coming soon" pages (Content -> Pages, Blog, Legal, Navigation and footer), phase 3.2 plan 12.
// New file; imported directly by app/dashboard/(ops)/content/coming-soon.tsx, deliberately not registered in
// lib/copy/index.ts (same practice as lib/copy/ops-kit.ts).
//
// Pages and Blog are the design canvas texts, verbatim in all three languages (boards DashContent "Pages · Coming soon"
// and DashPosts). Legal and Navigation and footer are two short blocks written for this plan: the canvas draws no
// Coming soon page for them, so they carry a title and one line and no list of capabilities (none is invented). Their
// Arabic (Modern Standard Arabic) and Spanish (neutral Latin American) are written from the English, with the words
// of the canvas rail and hub ("مع الإصدارات", "القوائم وروابط التذييل وبيانات التواصل", "enlaces del pie").
// No legal or policy wording, no price, no date.

export type ComingSoonKind = "pages" | "blog" | "legal" | "navigation";
export type OpsContentLocale = "en" | "ar" | "es";

export type ComingSoonBlock = {
  /** The line under the Soon chip. */
  title: string;
  /** One short paragraph. */
  text: string;
  /** What is planned. Empty when the canvas draws no list. */
  items: string[];
};

export type OpsContentCopy = {
  soon: string;
  comingSoon: Record<ComingSoonKind, ComingSoonBlock>;
};

export const OPS_CONTENT_COPY: Record<OpsContentLocale, OpsContentCopy> = {
  en: {
    soon: "Soon",
    comingSoon: {
      pages: {
        title: "Page editing is coming soon",
        text: "For now the public pages are edited outside the dashboard. Editing every page here arrives in a later phase.",
        items: [
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
        text: "Writing and publishing posts from the dashboard arrives in a later phase.",
        items: [
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
        text: "For now the legal pages are edited outside the dashboard. Editing them here, with versions, arrives in a later phase.",
        items: [],
      },
      navigation: {
        title: "Navigation editing is coming soon",
        text: "Menus, footer links and contact details are edited outside the dashboard for now. Editing them here arrives in a later phase.",
        items: [],
      },
    },
  },
  ar: {
    soon: "قريبًا",
    comingSoon: {
      pages: {
        title: "تحرير الصفحات قريبًا",
        text: "تُحرَّر الصفحات العامة حاليًا خارج لوحة التحكم. يصل تحرير كل صفحة هنا في مرحلة لاحقة.",
        items: [
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
        text: "كتابة المقالات ونشرها من لوحة التحكم تصل في مرحلة لاحقة.",
        items: [
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
        text: "تُحرَّر الصفحات القانونية حاليًا خارج لوحة التحكم. يصل تحريرها هنا، مع الإصدارات، في مرحلة لاحقة.",
        items: [],
      },
      navigation: {
        title: "تحرير التنقل قريبًا",
        text: "تُحرَّر القوائم وروابط التذييل وبيانات التواصل حاليًا خارج لوحة التحكم. يصل تحريرها هنا في مرحلة لاحقة.",
        items: [],
      },
    },
  },
  es: {
    soon: "Pronto",
    comingSoon: {
      pages: {
        title: "La edición de páginas llega pronto",
        text: "Por ahora las páginas públicas se editan fuera del panel. Editar cada página aquí llega en una fase posterior.",
        items: [
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
        text: "Escribir y publicar entradas desde el panel llega en una fase posterior.",
        items: [
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
        text: "Por ahora las páginas legales se editan fuera del panel. Editarlas aquí, con versiones, llega en una fase posterior.",
        items: [],
      },
      navigation: {
        title: "La edición de la navegación llega pronto",
        text: "Por ahora los menús, los enlaces del pie y los datos de contacto se editan fuera del panel. Editarlos aquí llega en una fase posterior.",
        items: [],
      },
    },
  },
};

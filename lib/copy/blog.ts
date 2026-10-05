// AR and ES reviewed and corrected 2026-10-05 (controller-delegated review): .planning/phases/03.3-public-site-in-react/I18N-REVIEW-2026-10-05.md
// Copy for /blog and the post template (phase 3.3 plan 32, controller reconcile R-9).
//
// EN is published text where it has one: the list meta title and description, the kicker and the h1 `Travel Insights`,
// the post kicker `ALMAR Journal`, the button `Plan Your Journey — Contact ALMAR`, the link `← Back to Travel Insights`
// and the sentence under the bar are all read from the live Framer pages (deleted in plan 32 task 3).
// AR and ES marked (board) are the board 5j/5k dictionary strings, verbatim. Everything else in AR and ES is a DRAFT
// for the owner's review, in the same practice as lib/copy/journey.ts.
// Numbers are Western numerals in every language (formatPlural does that).
// Imported directly by components/pages/blog-page.tsx and post-page.tsx; deliberately not registered in
// lib/copy/index.ts (reconcile R-9). A leaf file: no runtime imports, so node tests load it directly.

import type { PluralForms } from "../journey-format";

export type BlogLocale = "en" | "ar" | "es";

export type BlogCopy = {
  list: {
    meta: { title: string; description: string };
    kicker: string;
    /** The page h1 (board k20). */
    heading: string;
    empty: string;
  };
  post: {
    /** The kicker over the title in the hero. */
    kicker: string;
    /** The contact button under the body. */
    cta: string;
    /** `back` goes to /blog; the other two are the nav words. */
    links: { back: string; home: string; destinations: string };
    readingTime: PluralForms;
    /** The accessible name of the in-page link list. */
    onThisPage: string;
    share: string;
    copyLink: string;
    copied: string;
    /** `{url}` is the address that could not be copied. */
    copyFailed: string;
    pairKicker: string;
    pairHeading: string;
    featuredStay: string;
    featuredExperience: string;
    relatedKicker: string;
    related: string;
    /** The published sentence under the hero bar. */
    intro: string;
    /** The accessible name of the region that holds the hero planner. */
    barLabel: string;
    englishOnly: string;
  };
};

export const BLOG_COPY: Record<BlogLocale, BlogCopy> = {
  en: {
    list: {
      meta: {
        title: "Colombia travel guides | ALMAR",
        description: "Simple guides about where to go, what to do, and how to travel private in Colombia.",
      },
      kicker: "Blog / News",
      heading: "Travel Insights",
      empty: "No stories yet.",
    },
    post: {
      kicker: "ALMAR Journal",
      cta: "Plan Your Journey — Contact ALMAR",
      links: { back: "← Back to Travel Insights", home: "Home", destinations: "Destinations" },
      readingTime: { one: "# min read", other: "# min read" },
      onThisPage: "On this page",
      share: "Share",
      copyLink: "Copy link",
      copied: "Link copied",
      copyFailed: "Could not copy the link: {url}",
      pairKicker: "Chosen for this story",
      pairHeading: "Stay and experience",
      featuredStay: "Featured stay",
      featuredExperience: "Featured experience",
      relatedKicker: "More from the ALMAR Journal",
      related: "Related stories",
      intro: "Fully vetted stays, private drivers, and concierge on call. Tell us your dates and we plan the rest.",
      barLabel: "Plan your journey",
      englishOnly: "This article is in English for now.",
    },
  },
  ar: {
    list: {
      meta: {
        title: "أدلة السفر في كولومبيا | ALMAR",
        description: "أدلة بسيطة تخبركم إلى أين تذهبون وماذا تفعلون وكيف تسافرون بخصوصية في كولومبيا.",
      },
      kicker: "المدونة / الأخبار",
      heading: "رؤى السفر",
      empty: "لا توجد حكايات بعد.",
    },
    post: {
      kicker: "مجلة ALMAR",
      cta: "خطّطوا لرحلتكم — تواصلوا مع ALMAR",
      links: { back: "→ العودة إلى رؤى السفر", home: "الرئيسية", destinations: "الوجهات" },
      readingTime: {
        one: "دقيقة قراءة واحدة",
        two: "دقيقتا قراءة",
        few: "# دقائق قراءة",
        many: "# دقيقة قراءة",
        other: "# دقيقة قراءة",
      },
      onThisPage: "في هذه الصفحة",
      share: "مشاركة",
      copyLink: "نسخ الرابط",
      copied: "تم نسخ الرابط",
      copyFailed: "تعذّر نسخ الرابط: {url}",
      pairKicker: "مختارة لهذه الحكاية",
      pairHeading: "إقامة وتجربة",
      featuredStay: "إقامة مميزة",
      featuredExperience: "تجربة مميزة",
      relatedKicker: "المزيد من مجلة ALMAR",
      related: "قصص ذات صلة",
      intro: "إقامات موثّقة بالكامل، وسائقون خاصون، وكونسيرج عند الطلب. أخبرونا بتواريخكم ونخطط لكم الباقي.",
      barLabel: "خطّط لرحلتك",
      englishOnly: "هذا المقال متاح بالإنجليزية حاليًا.",
    },
  },
  es: {
    list: {
      meta: {
        title: "Guías de viaje por Colombia | ALMAR",
        description: "Guías sencillas sobre adónde ir, qué hacer y cómo viajar en privado por Colombia.",
      },
      kicker: "Blog / Noticias",
      heading: "Guías de viaje",
      empty: "Aún no hay historias.",
    },
    post: {
      kicker: "Diario ALMAR",
      cta: "Planifica tu viaje — Contacta a ALMAR",
      links: { back: "← Volver a las guías de viaje", home: "Inicio", destinations: "Destinos" },
      readingTime: { one: "# min de lectura", other: "# min de lectura" },
      onThisPage: "En esta página",
      share: "Compartir",
      copyLink: "Copiar enlace",
      copied: "Enlace copiado",
      copyFailed: "No se pudo copiar el enlace: {url}",
      pairKicker: "Elegidas para esta historia",
      pairHeading: "Estancia y experiencia",
      featuredStay: "Estancia destacada",
      featuredExperience: "Experiencia destacada",
      relatedKicker: "Más del Diario ALMAR",
      related: "Historias relacionadas",
      intro:
        "Estancias totalmente verificadas, conductores privados y concierge disponible. Cuéntanos tus fechas y nosotros planificamos el resto.",
      barLabel: "Planea tu viaje",
      englishOnly: "Por ahora, este artículo está en inglés.",
    },
  },
};

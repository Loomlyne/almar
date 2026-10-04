// Home page copy for the React home (phase 3.3 plan 04). The eleven live sections keep their live order;
// the words come from here, the images and the welcome letter come from lib/data.
//
// A per-page copy file, imported directly by components/pages/home-page.tsx and NOT registered in
// lib/copy/index.ts (controller reconcile R-9, 2026-10-03).
//
// EN is the live home text, verbatim, except the strings marked DRAFTED UI COPY below: they have no live
// source (the live page has no rate note, no slider control names and no named planner region). Each
// of those is interface wording for the owner to review. None of them is a price or legal text.
//
// AR and ES are DRAFTS for the owner's review, written from the EN in the practice of lib/copy/journey.ts
// (Gulf-friendly Modern Standard Arabic, neutral Latin American Spanish). Where lib/copy/home.ts or the
// canvas dictionary already holds an approved AR/ES line with the same meaning, that line is reused.
//
// Not in this file on purpose: any amount, any currency code, any person's name. The three journey prices
// come from lib/data (published text, never retyped here).

export type HomePageLocale = "en" | "ar" | "es";

export type HomePageCopy = {
  meta: { title: string; description: string };
  hero: {
    /** DRAFTED UI COPY: the accessible name of the region that holds the planner (bar, entry row). */
    barLabel: string;
  };
  stays: {
    kicker: string;
    heading: string;
    intro: string;
    viewAll: string;
  };
  services: { kicker: string; heading: string; intro: string; viewAll: string };
  moments: { kicker: string; heading: string; intro: string; cta: string };
  journeys: {
    heading: string;
    intro: string;
    featured: string;
    /** DRAFTED UI COPY: shown only after a currency is chosen. `{date}` is the day the rates were read. */
    ratesOf: string;
  };
  stories: { kicker: string; heading: string; intro: string; readAll: string };
  begin: { heading: string; intro: string; cta: string };
  team: { kicker: string; heading: string };
  /**
   * DRAFTED UI COPY: the gallery strip's controls (plan 43; the lightbox is gone). `slide` names a slide and the live line
   * (`{n}` of `{total}`), `goTo` names a dot (`{n}`).
   */
  gallery: { previous: string; next: string; slide: string; goTo: string };
};

export const HOME_PAGE_COPY: Record<HomePageLocale, HomePageCopy> = {
  en: {
    meta: {
      title: "Private luxury trips in Colombia | ALMAR",
      description:
        "ALMAR plans private trips in Colombia. We book villas, set up tours, and give you a concierge for your whole stay.",
    },
    hero: { barLabel: "Plan your journey" },
    stays: {
      kicker: "Private Stays",
      heading: "Private Stays, Fully Vetted",
      intro:
        "Verified private houses, island estates, and countryside retreats across Cartagena and Antioquia — each selected for security, staff readiness, and total discretion.",
      viewAll: "View All Private Stays",
    },
    services: {
      kicker: "Services & Experiences",
      heading: "Everything Handled. Nothing Left to Chance.",
      intro:
        "From private villas to dedicated concierge, ALMAR manages every detail of your Colombia journey, so you can simply live it.",
      viewAll: "View All Services",
    },
    moments: {
      kicker: "Curated Experiences",
      heading: "Moments Designed for You",
      intro: "From private yacht charters to helicopter tours, every ALMAR experience is curated exclusively around you.",
      cta: "Request Consultation",
    },
    journeys: {
      heading: "Choose Your Journey",
      intro:
        "Three tiers of privacy, luxury, and Colombia immersion — each crafted around a different depth of experience.",
      featured: "Most Popular",
      ratesOf: "Converted at the exchange rate of {date}.",
    },
    stories: {
      kicker: "Travel Insights",
      heading: "ALMAR Stories",
      intro:
        "Discover Colombia through our eyes, destination guides, local tips, and insider insights from our team on the ground.",
      readAll: "Read All",
    },
    begin: {
      heading: "Begin Your Journey",
      intro:
        "Your private Colombia journey begins with a conversation, share your vision and our team will design the rest.",
      cta: "Request Consultation",
    },
    team: { kicker: "The People Behind Your Journey", heading: "Local insight, personally delivered." },
    gallery: {
      previous: "Previous image",
      next: "Next image",
      slide: "{n} of {total}",
      goTo: "Show photo {n}",
    },
  },
  ar: {
    meta: {
      title: "رحلات خاصة فاخرة في كولومبيا | المار",
      description:
        "تخطّط المار رحلات خاصة في كولومبيا. نحجز الفلل وننظّم الجولات ونوفّر لكم كونسيرج طوال إقامتكم.",
    },
    hero: { barLabel: "خطّط لرحلتك" },
    stays: {
      kicker: "إقامات خاصة",
      heading: "إقامات خاصة، تم التحقق منها",
      intro:
        "بيوت خاصة موثّقة وعزب جزر ومنتجعات ريفية في كارتاخينا وأنتيوكيا — اختيرت كلٌّ منها للأمان وجاهزية الطاقم والخصوصية التامة.",
      viewAll: "عرض كل الإقامات الخاصة",
    },
    services: {
      kicker: "التجارب والخدمات",
      heading: "كل شيء مُرتَّب. لا شيء متروك للصدفة.",
      intro: "من الفلل الخاصة إلى كونسيرج مخصّص، تدير المار كل تفصيل في رحلتكم إلى كولومبيا، لتعيشوها فقط.",
      viewAll: "عرض كل الخدمات",
    },
    moments: {
      kicker: "تجارب منتقاة",
      heading: "لحظات صُمّمت لكم",
      intro: "من رحلات اليخوت الخاصة إلى جولات الطائرات المروحية، تُصمَّم كل تجربة من تجارب المار حصرياً حولكم.",
      cta: "اطلبوا استشارة",
    },
    journeys: {
      heading: "اختاروا رحلتكم",
      intro: "ثلاثة مستويات من الخصوصية والفخامة والانغماس في كولومبيا — لكلٍّ منها عمق مختلف من التجربة.",
      featured: "الأكثر طلباً",
      ratesOf: "حُوِّلت المبالغ بسعر الصرف بتاريخ {date}.",
    },
    stories: {
      kicker: "رؤى السفر",
      heading: "حكايات المار",
      intro: "اكتشفوا كولومبيا بعيوننا: أدلة الوجهات ونصائح محلية ورؤى من فريقنا على الأرض.",
      readAll: "عرض كل الحكايات",
    },
    begin: {
      heading: "ابدأوا رحلتكم",
      intro: "تبدأ رحلتكم الخاصة في كولومبيا بمحادثة: شاركونا رؤيتكم ويصمّم فريقنا الباقي.",
      cta: "اطلبوا استشارة",
    },
    team: { kicker: "الأشخاص وراء رحلتكم", heading: "معرفة محلية، تُقدَّم شخصياً." },
    gallery: {
      previous: "الصورة السابقة",
      next: "الصورة التالية",
      slide: "{n} من {total}",
      goTo: "عرض الصورة {n}",
    },
  },
  es: {
    meta: {
      title: "Viajes privados de lujo en Colombia | ALMAR",
      description:
        "ALMAR organiza viajes privados por Colombia. Reservamos villas, armamos recorridos y les damos un conserje durante toda la estancia.",
    },
    hero: { barLabel: "Planea tu viaje" },
    stays: {
      kicker: "Estancias privadas",
      heading: "Estancias privadas, ya revisadas",
      intro:
        "Casas privadas verificadas, fincas de isla y retiros de campo en Cartagena y Antioquia, cada una elegida por seguridad, personal preparado y total discreción.",
      viewAll: "Ver todas las estancias privadas",
    },
    services: {
      kicker: "Experiencias y servicios",
      heading: "Todo resuelto. Nada dejado al azar.",
      intro:
        "De villas privadas a un conserje dedicado, ALMAR lleva cada detalle del viaje por Colombia, para que ustedes solo lo vivan.",
      viewAll: "Ver todos los servicios",
    },
    moments: {
      kicker: "Experiencias seleccionadas",
      heading: "Momentos pensados para ustedes",
      intro:
        "De yates privados a vuelos en helicóptero, cada experiencia de ALMAR se diseña en exclusiva alrededor de ustedes.",
      cta: "Soliciten una consulta",
    },
    journeys: {
      heading: "Elijan su viaje",
      intro:
        "Tres niveles de privacidad, lujo e inmersión en Colombia, cada uno pensado para una profundidad distinta de experiencia.",
      featured: "Más popular",
      ratesOf: "Convertido al tipo de cambio del {date}.",
    },
    stories: {
      kicker: "Guías de viaje",
      heading: "Historias ALMAR",
      intro:
        "Descubran Colombia a través de nuestros ojos: guías de destinos, consejos locales y perspectivas de nuestro equipo sobre el terreno.",
      readAll: "Ver todas las historias",
    },
    begin: {
      heading: "Empiecen su viaje",
      intro:
        "Su viaje privado por Colombia empieza con una conversación: compartan su visión y nuestro equipo diseñará el resto.",
      cta: "Soliciten una consulta",
    },
    team: { kicker: "Las personas detrás de su viaje", heading: "Conocimiento local, entregado en persona." },
    gallery: {
      previous: "Imagen anterior",
      next: "Imagen siguiente",
      slide: "{n} de {total}",
      goTo: "Ver foto {n}",
    },
  },
};

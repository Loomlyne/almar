// Copy for the /destinations page (phase 3.3 plan 13, controller reconcile R-9).
//
// EN is the published text of the live Framer page where it has one (the meta title and description). The kicker and the h1 in
// all three languages are board 5d's dictionary keys k22 and k14, verbatim. The slider labels are the stay gallery's own
// (lib/copy/stay-detail.ts), except `region`, the hero's accessible name, which is drafted here.
// AR (Gulf-friendly Modern Standard Arabic) and ES (neutral Latin American) meta strings and the three `region` names are
// DRAFTS written from the EN strings, flagged for the owner's review, in the same practice as lib/copy/journey.ts.
// Imported directly by components/pages/destinations-page.tsx; deliberately not registered in lib/copy/index.ts
// (reconcile R-9). The footer is shared and lives in lib/copy/site-footer.ts.

import type { SliderLabels } from "../../components/ui/slider";

export type DestinationsPageLocale = "en" | "ar" | "es";

export type DestinationsPageCopy = {
  /** "published" is the live Framer wording; "draft" waits for the owner's review. */
  status: "published" | "draft";
  meta: { title: string; description: string };
  /** The small line above the h1. */
  kicker: string;
  /** The page h1. */
  heading: string;
  /** The hero slideshow's labels. Previous and next are required by the type and never drawn in layout "hero". */
  slider: SliderLabels;
};

export const DESTINATIONS_PAGE_COPY: Record<DestinationsPageLocale, DestinationsPageCopy> = {
  en: {
    status: "published",
    meta: {
      title: "Best places to visit in Colombia | ALMAR",
      description: "Cartagena, Medellín, Bogotá, coffee country, and islands. ALMAR plans private trips to each place.",
    },
    kicker: "Destinations",
    heading: "Colombia’s most extraordinary cities",
    slider: {
      region: "Destinations photos",
      previous: "Previous picture",
      next: "Next picture",
      goTo: "Show photo {n}",
      slide: "{n} of {total}",
      pause: "Pause slideshow",
      play: "Play slideshow",
    },
  },
  ar: {
    status: "draft",
    meta: {
      title: "أفضل الأماكن للزيارة في كولومبيا | ALMAR",
      description: "كارتاخينا وميديلين وبوغوتا وأرض القهوة والجزر. تخطط ALMAR رحلات خاصة إلى كل مكان منها.",
    },
    kicker: "الوجهات",
    heading: "أروع مدن كولومبيا",
    slider: {
      region: "صور الوجهات",
      previous: "الصورة السابقة",
      next: "الصورة التالية",
      goTo: "عرض الصورة {n}",
      slide: "{n} من {total}",
      pause: "إيقاف العرض مؤقتاً",
      play: "تشغيل العرض",
    },
  },
  es: {
    status: "draft",
    meta: {
      title: "Los mejores lugares para visitar en Colombia | ALMAR",
      description: "Cartagena, Medellín, Bogotá, la región del café y las islas. ALMAR planea viajes privados a cada lugar.",
    },
    kicker: "Destinos",
    heading: "Las ciudades más extraordinarias de Colombia",
    slider: {
      region: "Fotos de los destinos",
      previous: "Imagen anterior",
      next: "Imagen siguiente",
      goTo: "Ver foto {n}",
      slide: "{n} de {total}",
      pause: "Pausar presentación",
      play: "Reproducir presentación",
    },
  },
};

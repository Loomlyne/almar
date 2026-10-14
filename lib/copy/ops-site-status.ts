// Copy for the site status line in the dashboard header and the hint under a published item's Save button, phase 3.2
// plan 05. New file, so lib/copy/dashboard.ts stays free for 02-06 (controller, 2026-10-13: keep the block self-contained).
//
// Every string is as signed by the owner on 2026-10-13 (pictures/site-status/, EN, AR and ES drafts accepted as shown).
// `updating` is the one string not in the pictures: the line when the request time is unknown, which the server never
// sends for a real request (requested_at is set with the sequence). Imported directly; not registered in lib/copy/index.ts.

export type OpsSiteStatusLocale = "en" | "ar" | "es";

export type OpsSiteStatusCopy = {
  /** "Up to date · 14:05" */
  upToDate: string;
  /** "Updating since 14:02" (the time follows) */
  updatingSince: string;
  /** "Updating", when no time is known */
  updating: string;
  /** "Update failed · 14:30 · Try again" */
  failed: string;
  tryAgain: string;
  /** The endpoint did not answer, or the live site could not be read (state "unavailable"): never a made-up state. */
  unavailable: string;
  /** Under a published item's Save button; the screens plans place it. */
  publishedSaveHint: string;
};

export const OPS_SITE_STATUS_COPY: Record<OpsSiteStatusLocale, OpsSiteStatusCopy> = {
  en: {
    upToDate: "Up to date",
    updatingSince: "Updating since",
    updating: "Updating",
    failed: "Update failed",
    tryAgain: "Try again",
    unavailable: "Status unavailable",
    publishedSaveHint: "Saving updates the public site in a few minutes",
  },
  ar: {
    upToDate: "الموقع محدَّث",
    updatingSince: "جارٍ التحديث منذ",
    updating: "جارٍ التحديث",
    failed: "تعذّر التحديث",
    tryAgain: "حاول مرة أخرى",
    unavailable: "الحالة غير متاحة",
    publishedSaveHint: "الحفظ يحدّث الموقع العام خلال دقائق قليلة",
  },
  es: {
    upToDate: "Sitio al día",
    updatingSince: "Actualizando desde las",
    updating: "Actualizando",
    failed: "Falló la actualización",
    tryAgain: "Intentar de nuevo",
    unavailable: "Estado no disponible",
    publishedSaveHint: "Al guardar, el sitio público se actualiza en unos minutos",
  },
};

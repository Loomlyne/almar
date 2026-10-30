// Public copy of plan 06-07: the heart, Share and Account -> Saved stays, in EN, AR and ES.
//
// Verbatim from the signed dictionary C of .planning/phases/06-site-and-rest-of-cms/pictures/06-07/index.html (signed 2026-10-30
// 12:20, .planning/decisions/2026-10-30-06-04-06-05-06-07-pictures-signed.md). EN is the plan's; AR and ES are the drafts he
// approved as drawn (public Spanish tú). {stay} and {url} are fill slots, never shown. A leaf: no imports, so node tests load it
// directly. Imported directly; deliberately not registered in lib/copy/index.ts (reconcile R-9).

type L = "en" | "ar" | "es";

export type SavedStaysCopy = {
  save: string;
  saved: string;
  saveStay: string;
  removeStay: string;
  signInToSave: string;
  savedNotice: string;
  removedNotice: string;
  saveFailed: string;
  share: string;
  shareOn: string;
  whatsappText: string;
  copy: string;
  copied: string;
  failed: string;
  savedStays: string;
  savedEmpty: string;
  browseStays: string;
  remove: string;
};

export const SAVED_STAYS_COPY: Record<L, SavedStaysCopy> = {
  en: {
    save: "Save",
    saved: "Saved",
    saveStay: "Save {stay} to your stays",
    removeStay: "Remove {stay} from your stays",
    signInToSave: "Sign in to save {stay}",
    savedNotice: "Saved to your stays.",
    removedNotice: "Removed from your stays.",
    saveFailed: "Could not save now. Try again.",
    share: "Share",
    shareOn: "Share on WhatsApp",
    whatsappText: "{stay} · ALMAR Private Journey {url}",
    copy: "Copy link",
    copied: "Link copied.",
    failed: "Could not copy. The address is {url}",
    savedStays: "Saved stays",
    savedEmpty: "No saved stays yet. Tap the heart on a stay to keep it here.",
    browseStays: "See Private Stays",
    remove: "Remove",
  },
  ar: {
    save: "حفظ",
    saved: "تم الحفظ",
    saveStay: "احفظ {stay} في إقاماتك",
    removeStay: "أزل {stay} من إقاماتك",
    signInToSave: "سجّل الدخول لحفظ {stay}",
    savedNotice: "تم الحفظ في إقاماتك.",
    removedNotice: "تمت الإزالة من إقاماتك.",
    saveFailed: "تعذّر الحفظ الآن. حاول مرة أخرى.",
    share: "مشاركة",
    shareOn: "المشاركة عبر واتساب",
    whatsappText: "{stay} · ALMAR Private Journey {url}",
    copy: "نسخ الرابط",
    copied: "تم نسخ الرابط.",
    failed: "تعذّر النسخ. العنوان هو {url}",
    savedStays: "الإقامات المحفوظة",
    savedEmpty: "لا توجد إقامات محفوظة بعد. اضغط على القلب في أي إقامة لتحتفظ بها هنا.",
    browseStays: "عرض الإقامات الخاصة",
    remove: "إزالة",
  },
  es: {
    save: "Guardar",
    saved: "Guardada",
    saveStay: "Guardar {stay} en tus estancias",
    removeStay: "Quitar {stay} de tus estancias",
    signInToSave: "Inicia sesión para guardar {stay}",
    savedNotice: "Guardada en tus estancias.",
    removedNotice: "Quitada de tus estancias.",
    saveFailed: "No se pudo guardar ahora. Inténtalo de nuevo.",
    share: "Compartir",
    shareOn: "Compartir por WhatsApp",
    whatsappText: "{stay} · ALMAR Private Journey {url}",
    copy: "Copiar enlace",
    copied: "Enlace copiado.",
    failed: "No se pudo copiar. La dirección es {url}",
    savedStays: "Estancias guardadas",
    savedEmpty: "Aún no tienes estancias guardadas. Toca el corazón en una estancia para guardarla aquí.",
    browseStays: "Ver estancias privadas",
    remove: "Quitar",
  },
};

/** What a heart needs: small, because the server page sends it once per card. */
export type SaveHeartCopy = Pick<SavedStaysCopy, "save" | "saved" | "saveStay" | "removeStay" | "signInToSave" | "savedNotice" | "saveFailed">;

export function saveHeartCopy(locale: L): SaveHeartCopy {
  const { save, saved, saveStay, removeStay, signInToSave, savedNotice, saveFailed } = SAVED_STAYS_COPY[locale];
  return { save, saved, saveStay, removeStay, signInToSave, savedNotice, saveFailed };
}

/** What Share needs on the stay page. */
export type StayShareCopy = Pick<SavedStaysCopy, "share" | "shareOn" | "whatsappText" | "copy" | "copied" | "failed">;

export function stayShareCopy(locale: L): StayShareCopy {
  const { share, shareOn, whatsappText, copy, copied, failed } = SAVED_STAYS_COPY[locale];
  return { share, shareOn, whatsappText, copy, copied, failed };
}

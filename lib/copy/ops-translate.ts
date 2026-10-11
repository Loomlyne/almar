// Copy for the Translate button (components/ops/translate-button.tsx), phase 3.2 plan 10. New file; no other copy file
// is edited. Imported directly by the button; deliberately not registered in lib/copy/index.ts (same as ops-kit.ts).
//
// EN lines are the plan's own wording (03.2-10-PLAN.md Task 1), for the owner's review at the picture gate.
// AR (Modern Standard Arabic) and ES (Latin American, informal "tú", the house rule of lib/copy/ops-kit.ts) are DRAFTS
// written from the EN, flagged for the owner's review. Nothing here is a price, a rate or legal text.

export type OpsTranslateLocale = "en" | "ar" | "es";

export type OpsTranslateCopy = {
  /** The one button. */
  action: string;
  /** The button while the two requests run. */
  busy: string;
  /** Both targets came back. */
  done: string;
  /** Arabic came back, Spanish failed. */
  partialArabicOnly: string;
  /** Spanish came back, Arabic failed (the mirror line). */
  partialSpanishOnly: string;
  /** Both targets failed (bad output or a network error). */
  failed: string;
  /** The free daily allocation is used up (429 translate_limit). */
  limit: string;
  /** Every English field is empty: the button is off and says why. */
  needEnglish: string;
  /** Arabic or Spanish already has text: asked before replacing. */
  confirmTitle: string;
  replace: string;
  keep: string;
};

export const OPS_TRANSLATE_COPY: Record<OpsTranslateLocale, OpsTranslateCopy> = {
  en: {
    action: "Translate to Arabic and Spanish",
    busy: "Translating…",
    done: "Arabic and Spanish filled as drafts. Check them before you publish.",
    partialArabicOnly: "Arabic filled as a draft. Spanish failed: type it or try again.",
    partialSpanishOnly: "Spanish filled as a draft. Arabic failed: type it or try again.",
    failed: "Translation failed, type it or try again.",
    limit: "Translation limit reached for today (resets 04:00 Dubai). Type it or try tomorrow.",
    needEnglish: "Write the English text first.",
    confirmTitle: "Replace the Arabic and Spanish text?",
    replace: "Replace",
    keep: "Keep",
  },
  ar: {
    action: "ترجمة إلى العربية والإسبانية",
    busy: "جارٍ الترجمة…",
    done: "تمت تعبئة العربية والإسبانية كمسودتين. راجعهما قبل النشر.",
    partialArabicOnly: "تمت تعبئة العربية كمسودة. تعذّرت الإسبانية: اكتبها أو حاول مرة أخرى.",
    partialSpanishOnly: "تمت تعبئة الإسبانية كمسودة. تعذّرت العربية: اكتبها أو حاول مرة أخرى.",
    failed: "تعذّرت الترجمة، اكتب النص أو حاول مرة أخرى.",
    limit: "بلغت الترجمة حدّها لهذا اليوم (يُعاد ضبطه الساعة 04:00 بتوقيت دبي). اكتب النص أو حاول غدًا.",
    needEnglish: "اكتب النص الإنجليزي أولًا.",
    confirmTitle: "استبدال النص العربي والإسباني؟",
    replace: "استبدال",
    keep: "إبقاء",
  },
  es: {
    action: "Traducir al árabe y al español",
    busy: "Traduciendo…",
    done: "Árabe y español completados como borradores. Revísalos antes de publicar.",
    partialArabicOnly: "Árabe completado como borrador. El español falló: escríbelo o inténtalo de nuevo.",
    partialSpanishOnly: "Español completado como borrador. El árabe falló: escríbelo o inténtalo de nuevo.",
    failed: "La traducción falló, escríbela o inténtalo de nuevo.",
    limit: "Se alcanzó el límite de traducción de hoy (se reinicia a las 04:00, hora de Dubái). Escríbela o inténtalo mañana.",
    needEnglish: "Escribe primero el texto en inglés.",
    confirmTitle: "¿Reemplazar el texto en árabe y español?",
    replace: "Reemplazar",
    keep: "Conservar",
  },
};

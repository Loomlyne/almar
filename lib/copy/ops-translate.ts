// Copy for the Translate button (components/ops/translate-button.tsx), phase 3.2 plan 10. New file; no other copy file
// is edited. Imported directly by the button; deliberately not registered in lib/copy/index.ts (same as ops-kit.ts).
//
// EN lines are the plan's own wording (03.2-10-PLAN.md Task 1), for the owner's review at the picture gate.
// AR (Modern Standard Arabic) and ES are DRAFTS written from the EN, flagged for the owner's review. ES is Latin
// American / Colombian, formal "usted" (owner, 2026-10-11, 03.2-10-NOTES.md), unlike the "tú" of lib/copy/ops-kit.ts.
// Nothing here is a price, a rate or legal text.

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
  /** Neither target came back and the service was busy (503 translate_busy: a rate or capacity answer). */
  retryLater: string;
  /** Arabic came back, Spanish hit the daily limit (429 translate_limit). */
  partialArabicLimit: string;
  /** Spanish came back, Arabic hit the daily limit. */
  partialSpanishLimit: string;
  /** Both targets failed (bad output, a timeout or a network error). */
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
    retryLater: "Translation is busy right now. Try again in a minute.",
    partialArabicLimit: "Arabic filled as a draft. Spanish: translation limit reached for today (resets 04:00 Dubai). Type it or try tomorrow.",
    partialSpanishLimit: "Spanish filled as a draft. Arabic: translation limit reached for today (resets 04:00 Dubai). Type it or try tomorrow.",
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
    retryLater: "الترجمة مشغولة الآن. حاول مرة أخرى بعد دقيقة.",
    partialArabicLimit: "تمت تعبئة العربية كمسودة. الإسبانية: بلغت الترجمة حدّها لهذا اليوم (يُعاد ضبطه الساعة 04:00 بتوقيت دبي). اكتبها أو حاول غدًا.",
    partialSpanishLimit: "تمت تعبئة الإسبانية كمسودة. العربية: بلغت الترجمة حدّها لهذا اليوم (يُعاد ضبطه الساعة 04:00 بتوقيت دبي). اكتبها أو حاول غدًا.",
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
    done: "Árabe y español completados como borradores. Revíselos antes de publicar.",
    partialArabicOnly: "Árabe completado como borrador. El español falló: escríbalo o inténtelo de nuevo.",
    partialSpanishOnly: "Español completado como borrador. El árabe falló: escríbalo o inténtelo de nuevo.",
    retryLater: "La traducción está ocupada en este momento. Inténtelo de nuevo en un minuto.",
    partialArabicLimit: "Árabe completado como borrador. Español: se alcanzó el límite de traducción de hoy (se reinicia a las 04:00, hora de Dubái). Escríbalo o inténtelo mañana.",
    partialSpanishLimit: "Español completado como borrador. Árabe: se alcanzó el límite de traducción de hoy (se reinicia a las 04:00, hora de Dubái). Escríbalo o inténtelo mañana.",
    failed: "La traducción falló, escríbala o inténtelo de nuevo.",
    limit: "Se alcanzó el límite de traducción de hoy (se reinicia a las 04:00, hora de Dubái). Escríbala o inténtelo mañana.",
    needEnglish: "Escriba primero el texto en inglés.",
    confirmTitle: "¿Reemplazar el texto en árabe y español?",
    replace: "Reemplazar",
    keep: "Conservar",
  },
};

// A control's accessible name when one page shows two controls with the same visible words (03.2-15, controller
// 2026-10-19): the visible words first, so the name holds the label a sighted user sees (WCAG 2.5.3), then the card it
// belongs to, so a screen reader's list of controls tells them apart. "Edit translations, Text" / "تعديل الترجمات، النص".
import type { Locale3 } from "./api-types";

export function controlName(locale: Locale3, words: string, card: string): string {
  return `${words}${locale === "ar" ? "، " : ", "}${card}`;
}

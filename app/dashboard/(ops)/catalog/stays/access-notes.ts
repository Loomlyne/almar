// Plan 03.2-15 (owner, 2026-10-15 02:56): the pure rule behind the Access card's Notes translation. The card writes the
// Notes in English; on Save the kit's plan (components/ops/auto-translate.ts) says which of Arabic and Spanish the AI
// is asked for, and this decides what the save sends and what the card shows after it. A language the AI did not fill
// is left out of the save, so the server keeps what it had (owner rule: the English and the other fields still save).

import { TARGETS, planTranslation, sendable, type Target } from "../../../../../components/ops/auto-translate";
import { MAX_ACCESS_CHARS } from "./rates-forms";

export type Notes = Record<Target, string>;
const NOTE_KEY: Record<Target, "notes_ar" | "notes_es"> = { ar: "notes_ar", es: "notes_es" };

export const blankToEmpty = (value: string) => (value.trim() === "" ? "" : value);

/**
 * The Arabic and Spanish of the Notes for one Save, from the kit's plan and the AI's replies: the value to send per
 * language (absent = the server keeps what it has), what the card shows after the Save, and whether a language failed.
 */
export function notesForSave(input: {
  english: string;
  savedEnglish: string;
  notes: Notes;
  savedNotes: Notes;
  touched: ReadonlySet<string>;
  replies: Partial<Record<Target, unknown>>;
}): { send: Partial<Record<"notes_ar" | "notes_es", string | null>>; after: Notes; asked: Target[]; failed: boolean } {
  const plan = planTranslation({ notes: input.english }, { notes: input.savedEnglish }, { ar: { notes: input.notes.ar }, es: { notes: input.notes.es } }, input.touched);
  const asked = TARGETS.filter((target) => "notes" in plan.send[target]);
  const send: Partial<Record<"notes_ar" | "notes_es", string | null>> = {};
  const after: Notes = { ...input.savedNotes };
  let failed = false;
  for (const target of TARGETS) {
    let value: string | null = input.notes[target];
    if (asked.includes(target)) {
      const reply = input.replies[target] as { ok?: boolean; fields?: Record<string, unknown> } | null | undefined;
      const got = reply?.ok === true ? reply.fields?.notes : undefined;
      if (typeof got === "string" && sendable(got) && [...got].length <= MAX_ACCESS_CHARS) value = got;
      else {
        // The AI did not fill this language: it stays out of the save, so the stored text is kept.
        failed = true;
        continue;
      }
    } else if (plan.clear[target].includes("notes")) {
      value = "";
    }
    if (value !== input.savedNotes[target]) {
      send[NOTE_KEY[target]] = value.trim() === "" ? null : value;
      after[target] = blankToEmpty(value);
    }
  }
  return { send, after, asked, failed };
}


"use client";

// Plan 03.2-15: the Access card of the stay editor (kit EditPage, option B), signed 2026-10-15.
// Private per stay (C-14, OPS-10): address, Wi-Fi name and password, door code, notes. Saved on its own route
// (/api/ops/stay-access), never through the page's Save/Publish, never in a URL, never logged; nothing here is on the
// public site. The password and the door code are hidden until the eye is pressed (standing rule).
// Notes (owner, 2026-10-15 02:56): written in English; on Save the kit's auto-translate fills Arabic and Spanish
// (the same plan and request the kit page uses, no new pipeline), with "Edit translations" for a fix. If the AI fails,
// the English and the other fields still save and the Arabic and Spanish stay as they were. The other fields are
// literal values and are never translated.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { TARGETS, planTranslation, requestTranslations, touchKey, type Send, type Target } from "../../../../../components/ops/auto-translate";
import { errorText } from "../../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import type { Locale3, StayAccessView } from "../../../../../components/ops/api-types";
import { ChevronIcon } from "../../../../../components/icons/icons";
import { Button } from "../../../../../components/ui/button";
import { Field } from "../../../../../components/ui/field";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_STAY_TABS_COPY } from "../../../../../lib/copy/ops-stay-tabs";
import { blankToEmpty, notesForSave, type Notes } from "./access-notes";
import { MAX_ACCESS_CHARS, accessPayload, type AccessInput } from "./rates-forms";

const PATH = "/api/ops/stay-access";
const BLANK: AccessInput = { address: "", wifi_name: "", wifi_password: "", door_code: "", notes: "" };
const NO_NOTES: Notes = { ar: "", es: "" };

function fromView(view: StayAccessView): { access: AccessInput; notes: Notes } {
  const access = view.access;
  if (!access) return { access: BLANK, notes: NO_NOTES };
  return {
    access: {
      address: access.address ?? "",
      wifi_name: access.wifi_name ?? "",
      wifi_password: access.wifi_password ?? "",
      door_code: access.door_code ?? "",
      notes: access.notes ?? "",
    },
    notes: { ar: access.notes_ar ?? "", es: access.notes_es ?? "" },
  };
}

const same = (a: AccessInput, b: AccessInput) => (Object.keys(a) as Array<keyof AccessInput>).every((key) => a[key] === b[key]);
export function StayAccessSection({
  stayId,
  locale,
  onDirtyChange,
  send = opsSend,
}: {
  stayId: string;
  locale: Locale3;
  onDirtyChange?: (dirty: boolean) => void;
  /** Test seam: the translate request (opsSend by default), as on the kit's EditPage. */
  send?: Send;
}) {
  const copy = OPS_STAY_TABS_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const id = useId();
  const [saved, setSaved] = useState<AccessInput | null>(null);
  const [typed, setTyped] = useState<AccessInput>(BLANK);
  const [savedNotes, setSavedNotes] = useState<Notes>(NO_NOTES);
  const [notes, setNotes] = useState<Notes>(NO_NOTES);
  // The English the stored Arabic and Spanish were made from. It moves only when the AI filled both, so after a failed
  // translation the card stays saveable and the next Save asks again.
  const [translatedFrom, setTranslatedFrom] = useState("");
  // Arabic or Spanish typed by the owner since the last save: the AI leaves those alone.
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [showTranslations, setShowTranslations] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [phase, setPhase] = useState<"idle" | "translating" | "saving">("idle");
  const [tooLong, setTooLong] = useState<keyof AccessInput | Target | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [translationFailed, setTranslationFailed] = useState(false);
  const [done, setDone] = useState<"saved" | "translated" | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    const reply = await opsFetch<StayAccessView>(PATH, { stay_id: stayId });
    if (!reply.ok) {
      setLoadError(true);
      return;
    }
    const values = fromView(reply);
    setSaved(values.access);
    setTyped(values.access);
    setSavedNotes(values.notes);
    setNotes(values.notes);
    setTranslatedFrom(values.access.notes);
  }, [stayId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = saved !== null && (!same(saved, typed) || TARGETS.some((target) => notes[target] !== savedNotes[target]));
  const retry = saved !== null && translatedFrom !== typed.notes;
  // Told only when it changes; the latest callback is kept in a ref so an inline one cannot loop. A layout effect, so the
  // page's own state (its "Unsaved changes" and its Escape and Back guard, a document listener re-set in a passive effect)
  // is updated in the same task as the keystroke: from a passive effect the page re-rendered at default priority, its
  // listener still held the old `dirty` after the status was painted, and an Escape in that gap closed with no
  // "Discard changes?" (slot 8, 2026-10-19, 1440 ar under load).
  const tell = useRef(onDirtyChange);
  tell.current = onDirtyChange;
  useLayoutEffect(() => {
    tell.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => tell.current?.(false), []);

  async function save() {
    if (!saved) return;
    const payload = accessPayload(typed);
    if (!payload.ok) {
      setTooLong(payload.field);
      return;
    }
    const longNote = TARGETS.find((target) => [...notes[target]].length > MAX_ACCESS_CHARS);
    if (longNote) {
      setTooLong(longNote);
      setShowTranslations(true);
      return;
    }
    setTooLong(null);
    setFailed(null);
    setTranslationFailed(false);
    setDone(null);

    const plan = planTranslation({ notes: typed.notes }, { notes: translatedFrom }, { ar: { notes: notes.ar }, es: { notes: notes.es } }, touched);
    let replies: Partial<Record<Target, unknown>> = {};
    if (TARGETS.some((target) => "notes" in plan.send[target])) {
      setPhase("translating");
      replies = await requestTranslations(plan, send);
    }
    const result = notesForSave({ english: typed.notes, savedEnglish: translatedFrom, notes, savedNotes, touched, replies });

    setPhase("saving");
    // The reply carries no row (contract 5.5), so the card keeps what it sent: blanks as empty, the rest as typed.
    const reply = await opsSend<object>(PATH, { action: "save", stay_id: stayId, access: { ...payload.value, ...result.send } });
    setPhase("idle");
    if (!reply.ok) {
      setFailed(errorText(kit, reply.error));
      return;
    }
    const keptAccess = { ...typed };
    for (const key of Object.keys(keptAccess) as Array<keyof AccessInput>) keptAccess[key] = blankToEmpty(keptAccess[key]);
    setSaved(keptAccess);
    setTyped(keptAccess);
    setSavedNotes(result.after);
    setNotes(result.after);
    setTouched(new Set());
    if (!result.failed) setTranslatedFrom(keptAccess.notes);
    setTranslationFailed(result.failed);
    setDone(result.asked.length > 0 && !result.failed ? "translated" : "saved");
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="m-0 text-label text-error">
          {copy.loadFailed}
        </p>
        <Button variant="secondary" onClick={() => void load()}>
          {copy.retry}
        </Button>
      </div>
    );
  }
  if (saved === null) {
    return (
      <p className="m-0 text-label text-muted" aria-live="polite">
        {copy.loading}
      </p>
    );
  }

  const working = phase !== "idle";
  const field = (key: keyof AccessInput) => ({
    id: `${id}-${key}`,
    value: typed[key],
    autoComplete: "off",
    className: "max-w-none",
    disabled: working,
    error: tooLong === key ? copy.access.tooLong : undefined,
    onChange: (event: { target: { value: string } }) => {
      setTyped((was) => ({ ...was, [key]: event.target.value }));
      setDone(null);
    },
  });

  // The password and door code keep the page's direction: the field reserves the eye's room at its inline end, and a
  // forced dir="ltr" would put that room on the other side from the eye in Arabic.
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-label text-ink">{copy.access.guestLine}</p>
      <p className="m-0 text-label text-muted">{copy.access.privateLine}</p>
      <Field {...field("address")} label={copy.access.address} multiline />
      <Field {...field("wifi_name")} label={copy.access.wifiName} dir="auto" />
      <Field {...field("wifi_password")} label={copy.access.wifiPassword} type="password" autoComplete="new-password" />
      <Field {...field("door_code")} label={copy.access.doorCode} type="password" autoComplete="new-password" />
      <Field {...field("notes")} label={copy.access.notes} hint={copy.access.notesHint} multiline lang="en" dir="ltr" />
      <div className="flex min-w-0 flex-col items-start gap-4" data-notes-translations>
        {/* The kit's Edit translations control (TranslationBoxes in components/ops/edit-page.tsx, not exported): the same
            button, chevron and classes, so it reads the same as on the Text card. The page also shows the Text card's,
            so this one's accessible name adds the field after the words on screen, from signed strings only:
            "Edit translations: Notes" (controller 2026-10-19). */}
        <button
          type="button"
          aria-label={`${showTranslations ? kit.editor.hideTranslations : kit.editor.editTranslations}: ${copy.access.notes}`}
          aria-expanded={showTranslations}
          aria-controls={showTranslations ? `${id}-notes-translations` : undefined}
          onClick={() => setShowTranslations((was) => !was)}
          className="inline-flex min-h-control cursor-pointer items-center gap-2 border-0 bg-transparent p-0 font-body text-label text-teal underline decoration-gold decoration-1 underline-offset-4"
        >
          <ChevronIcon size={16} className={showTranslations ? "-rotate-90" : "rotate-90"} aria-hidden="true" />
          {showTranslations ? kit.editor.hideTranslations : kit.editor.editTranslations}
        </button>
        {showTranslations ? (
          // Full width like Notes above (the column's items-start would shrink each box to its text).
          <div id={`${id}-notes-translations`} className="flex w-full min-w-0 flex-col gap-4">
            <p className="m-0 text-label text-muted">{kit.editor.translationsNote}</p>
            {TARGETS.map((target) => (
              <Field
                key={target}
                id={`${id}-notes-${target}`}
                label={`${copy.access.notes} · ${kit.languages[target]}`}
                className="max-w-none"
                multiline
                lang={target}
                dir={target === "ar" ? "rtl" : "ltr"}
                disabled={working}
                error={tooLong === target ? copy.access.tooLong : undefined}
                value={notes[target]}
                onChange={(event) => {
                  const value = event.target.value;
                  setNotes((was) => ({ ...was, [target]: value }));
                  setTouched((was) => new Set(was).add(touchKey(target, "notes")));
                  setDone(null);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
      {failed ? (
        <p role="alert" className="m-0 text-label text-error">
          {failed}
        </p>
      ) : null}
      {translationFailed ? (
        <p role="alert" className="m-0 text-label text-error">
          {copy.access.translationFailed}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {/* The card's only action: filled (card buttons are outlined unless they are the only one; never gold). */}
        <Button variant="primary" onClick={() => void save()} disabled={working || (!dirty && !retry)}>
          {copy.access.saveAccess}
        </Button>
        {phase === "translating" ? (
          <span role="status" className="text-label text-muted">
            {kit.editor.translating}
          </span>
        ) : done && !dirty && !translationFailed ? (
          <span role="status" className="text-label text-muted">
            {done === "translated" ? kit.editor.translationsUpdated : copy.access.saved}
          </span>
        ) : null}
      </div>
    </div>
  );
}

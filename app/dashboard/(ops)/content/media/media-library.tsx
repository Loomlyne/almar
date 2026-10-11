"use client";

import { useCallback, useState, type ReactNode } from "react";
import { MediaPicker } from "../../../../../components/ops/media-picker";
import { opsSend } from "../../../../../components/ops/ops-client";
import { errorText } from "../../../../../components/ops/error-text";
import {
  altDraftOf,
  applyAltDrafts,
  buildSaveAlt,
  itemAfterSave,
  sameAltDraft,
  type AltDraft,
} from "../../../../../components/ops/media-alt";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { useMediaLibrary } from "../../../../../components/ops/use-media-library";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_MEDIA_COPY } from "../../../../../lib/copy/ops-media";
import { MediaScreen, type ScreenNotice } from "./media-screen";

const PATH = "/api/ops/media";

const EMPTY: AltDraft = { alt: { en: "", ar: "", es: "" }, checked: { ar: false, es: false } };

/** What the Translate button calls with a reply: see applyAltDrafts in components/ops/media-alt.ts. */
export type ApplyAltDrafts = (target: "ar" | "es", fields: Record<string, string | string[]>) => void;

/**
 * Content -> Media, connected: the list, search, Upload, the alt text panel (Save), and Delete image, all through the kit
 * client. `slotOf` is the test seam for the Translate slot; the page passes nothing.
 */
export function MediaLibrary({ slotOf }: { slotOf?: (apply: ApplyAltDrafts) => ReactNode }) {
  const locale = useDashboardLocale();
  const copy = OPS_MEDIA_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const { library, setItems } = useMediaLibrary({ enabled: true, locale });

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AltDraft>(EMPTY);
  const [baseline, setBaseline] = useState<AltDraft>(EMPTY);
  const [notice, setNotice] = useState<ScreenNotice | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = library.items.find((item) => item.id === openId) ?? null;

  function onOpen(id: string) {
    const item = library.items.find((other) => other.id === id);
    if (!item) return;
    const start = altDraftOf(item);
    setOpenId(id);
    setDraft(start);
    setBaseline(start);
    setPanelError(null);
    setNotice(null);
  }

  /** The panel's handler for the Translate button: fills the box, marks it Draft, unticks "I checked". */
  const applyDrafts: ApplyAltDrafts = useCallback((target, fields) => {
    setDraft((previous) => applyAltDrafts(previous, target, fields));
  }, []);

  async function onSave() {
    if (!open || busy) return;
    setBusy(true);
    setPanelError(null);
    const body = buildSaveAlt(open.id, draft);
    const reply = await opsSend<{ id: string; affects_site: boolean }>(PATH, body);
    setBusy(false);
    if (!reply.ok) {
      setPanelError(errorText(kit, reply.error));
      return;
    }
    setItems((known) => known.map((item) => (item.id === open.id ? itemAfterSave(item, body) : item)));
    setBaseline(draft);
  }

  async function onDelete() {
    if (!open || busy) return;
    setBusy(true);
    setPanelError(null);
    const reply = await opsSend<{ id: string; affects_site: boolean }>(PATH, { action: "delete", id: open.id });
    setBusy(false);
    if (reply.ok) {
      setItems((known) => known.filter((item) => item.id !== open.id));
      setOpenId(null);
      setNotice({ kind: "info", text: copy.staysInStorage });
      return;
    }
    if (reply.error.code === "in_use") {
      // The list was out of date: this photo is used. Say so and keep Delete off.
      setItems((known) => known.map((item) => (item.id === open.id ? { ...item, used_by: Math.max(1, item.used_by) } : item)));
      setPanelError(copy.usedBlocksDelete);
      return;
    }
    setPanelError(errorText(kit, reply.error));
  }

  // 03.2-10: render <TranslateButton source={{ alt: draft.alt.en }} hasExisting={draft.alt.ar !== "" || draft.alt.es !== ""} onDrafts={applyDrafts} locale={locale} disabled={draft.alt.en.trim() === ""} /> here and nothing else; until then the slot stays empty (no fake control on the live page).
  const translateSlot = slotOf ? slotOf(applyDrafts) : null;

  return (
    <>
      <MediaScreen
        locale={locale}
        items={library.items}
        query={library.query}
        onQueryChange={(next) => {
          setNotice(null);
          library.onQueryChange(next);
        }}
        hasMore={library.hasMore}
        onLoadMore={library.onLoadMore}
        onPickFile={library.onPickFile}
        openId={open ? open.id : null}
        onOpen={onOpen}
        onClosePanel={() => setOpenId(null)}
        draft={draft}
        dirty={!sameAltDraft(draft, baseline)}
        onAltChange={(code, text) => setDraft((previous) => ({ ...previous, alt: { ...previous.alt, [code]: text } }))}
        onCheckedChange={(code, checked) => setDraft((previous) => ({ ...previous, checked: { ...previous.checked, [code]: checked } }))}
        onSave={() => void onSave()}
        onDelete={() => void onDelete()}
        translateSlot={translateSlot}
        notice={library.listError ? { kind: "error", text: library.listError } : notice}
        panelError={panelError}
      />
      <MediaPicker
        {...library}
        uploadOnly
        open
        onOpenChange={() => undefined}
        locale={locale}
        multiple={false}
        selected={[]}
        onSelectedChange={() => undefined}
        onChoose={() => undefined}
      />
    </>
  );
}

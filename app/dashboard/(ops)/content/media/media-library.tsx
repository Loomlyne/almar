"use client";

import { useState } from "react";
import { MediaPicker } from "../../../../../components/ops/media-picker";
import { opsSend } from "../../../../../components/ops/ops-client";
import { errorText } from "../../../../../components/ops/error-text";
import type { Send } from "../../../../../components/ops/auto-translate";
import type { SaveIntent, SavePayload } from "../../../../../components/ops/edit-page";
import { ALT_FIELD, altOf, buildSaveAlt, itemAfterSave, type AltText } from "../../../../../components/ops/media-alt";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { useMediaLibrary } from "../../../../../components/ops/use-media-library";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_MEDIA_COPY } from "../../../../../lib/copy/ops-media";
import { MediaScreen, type ScreenNotice } from "./media-screen";

const PATH = "/api/ops/media";

const EMPTY: AltText = { en: "", ar: "", es: "" };

const textOf = (value: unknown) => (typeof value === "string" ? value : Array.isArray(value) ? value.join(" ") : "");

/**
 * Content -> Media, connected: the list, search, Upload, the photo's editor page (Save, Publish, automatic Arabic and
 * Spanish through the kit) and Delete image, all through the kit client. `send` is the test seam for the translate
 * request; the page passes nothing.
 */
export function MediaLibrary({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const copy = OPS_MEDIA_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const { library, setItems, removeItem } = useMediaLibrary({ enabled: true, locale });

  const [openId, setOpenId] = useState<string | null>(null);
  const [alt, setAlt] = useState<AltText>(EMPTY);
  const [saved, setSaved] = useState<AltText>(EMPTY);
  const [notice, setNotice] = useState<ScreenNotice | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = library.items.find((item) => item.id === openId) ?? null;

  function onOpen(id: string) {
    const item = library.items.find((other) => other.id === id);
    if (!item) return;
    const start = altOf(item);
    setOpenId(id);
    setAlt(start);
    setSaved(start);
    setPanelError(null);
    setNotice(null);
  }

  /**
   * One save_alt. `publish`: Arabic and Spanish go live with the English (no review step, owner 2026-10-14). Without it
   * a language already published stays published, the others are drafts.
   */
  async function persist(next: AltText, publish: boolean, locked?: SavePayload["locked"]): Promise<boolean> {
    if (!open) return false;
    setBusy(true);
    setPanelError(null);
    const live = { ar: open.alt_status.ar === "published", es: open.alt_status.es === "published" };
    const body = buildSaveAlt(open.id, next, publish, live, locked);
    const reply = await opsSend<{ id: string; affects_site: boolean }>(PATH, body);
    setBusy(false);
    if (!reply.ok) {
      setPanelError(errorText(kit, reply.error));
      return false;
    }
    setItems((known) => known.map((item) => (item.id === open.id ? itemAfterSave(item, body) : item)));
    const stored = { en: body.alt.en, ar: body.alt.ar ?? "", es: body.alt.es ?? "" };
    setAlt(stored);
    setSaved(stored);
    return true;
  }

  /** The kit's Save: the English as typed and the Arabic and Spanish the kit filled. Live languages stay live. */
  function onSave(payload: SavePayload, intent: SaveIntent): Promise<boolean> {
    const next = { en: alt.en, ar: textOf(payload.translations.ar[ALT_FIELD]), es: textOf(payload.translations.es[ALT_FIELD]) };
    return persist(next, intent === "publish", payload.locked);
  }

  async function onDelete() {
    if (!open || busy) return;
    setBusy(true);
    setPanelError(null);
    const reply = await opsSend<{ id: string; affects_site: boolean }>(PATH, { action: "delete", id: open.id });
    setBusy(false);
    if (reply.ok) {
      removeItem(open.id);
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
        onClose={() => setOpenId(null)}
        alt={alt}
        savedAlt={saved}
        onAltChange={(code, text) => {
          setPanelError(null);
          setAlt((previous) => ({ ...previous, [code]: text }));
        }}
        onSave={onSave}
        onPublish={() => persist(alt, true)}
        onDelete={() => void onDelete()}
        busy={busy}
        send={send}
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

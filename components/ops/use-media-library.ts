"use client";

// The photo library client of the picker and the Media screen (03.2-09 Task 3): the list (search, Load more), the upload
// and nothing else. Every request goes through ops-client.ts (opsFetch for the list, opsPut for the upload); this file
// never calls the network itself. The owner's session and the Origin check are the server's business (contract 1.1).
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { OPS_KIT_COPY } from "../../lib/copy/ops-kit";
import { OPS_MEDIA_COPY, type OpsMediaLocale } from "../../lib/copy/ops-media";
import { errorText } from "./error-text";
import { ImagePrepError, isAcceptedType, prepareImage } from "./image-prep";
import type { MediaItem, UploadDraft } from "./media-types";
import { opsFetch, opsPut } from "./ops-client";
import type { PickerLibrary } from "./media-picker";

/** Search waits this long after the last key before it asks the server. */
export const SEARCH_DELAY_MS = 250;

const PATH = "/api/ops/media";

type ListReply = { items: MediaItem[]; next: string | null };
type PutReply = { id: string; key: string; url: string; created: boolean };

function mergeById(known: MediaItem[], more: MediaItem[]): MediaItem[] {
  const have = new Set(known.map((item) => item.id));
  return [...known, ...more.filter((item) => !have.has(item.id))];
}

export type MediaLibrary = {
  /** What MediaPicker takes. */
  library: PickerLibrary;
  /** The screen edits the list after a save without asking the server again. */
  setItems: Dispatch<SetStateAction<MediaItem[]>>;
  /** After a delete: drops the photo from the list and from this session's uploads, so a later list never brings it back. */
  removeItem: (id: string) => void;
};

/**
 * The library: the list from GET /api/ops/media (q after 250 ms of no typing, Load more with `after` = the last key)
 * and the upload form. `enabled` false (a closed picker) sends nothing; it loads on open, so a photo uploaded elsewhere
 * shows. `onUploaded` gets the stored photo as a library row, after it was added to the top of the list.
 */
export function useMediaLibrary({
  enabled,
  locale,
  onUploaded,
}: {
  enabled: boolean;
  locale: OpsMediaLocale;
  onUploaded?: (item: MediaItem) => void;
}): MediaLibrary {
  const kit = OPS_KIT_COPY[locale];
  const copy = OPS_MEDIA_COPY[locale];
  // The dashboard language arrives a render after the first (cookie): errors read the latest, a list never re-asks for it.
  const kitRef = useRef(kit);
  kitRef.current = kit;

  const [items, setItems] = useState<MediaItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [listError, setListError] = useState<string | null>(null);
  const request = useRef(0);
  // A list request is on its way: Load more waits, so a page of an older search is never merged into a newer one.
  const [loading, setLoading] = useState(false);
  // Photos uploaded while the picker is open: a list reply that left before the upload still shows them.
  const uploaded = useRef<MediaItem[]>([]);

  useEffect(() => {
    if (query === applied) return;
    const timer = window.setTimeout(() => setApplied(query), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, applied]);

  useEffect(() => {
    if (!enabled) return;
    const mine = ++request.current;
    const q = applied.trim();
    setNext(null);
    setLoading(true);
    void opsFetch<ListReply>(PATH, { q: q === "" ? undefined : q }).then((reply) => {
      if (mine !== request.current) return;
      setLoading(false);
      if (reply.ok) {
        const fresh = q === "" ? uploaded.current.filter((item) => !reply.items.some((row) => row.id === item.id)) : [];
        setItems([...fresh, ...reply.items]);
        setNext(reply.next);
        setListError(null);
      } else {
        setListError(errorText(kitRef.current, reply.error));
      }
    });
  }, [enabled, applied]);

  const onLoadMore = useCallback(() => {
    if (next === null || loading) return;
    const mine = ++request.current;
    setLoading(true);
    void opsFetch<ListReply>(PATH, { q: applied.trim() === "" ? undefined : applied.trim(), after: next }).then((reply) => {
      if (mine !== request.current) return;
      setLoading(false);
      if (reply.ok) {
        setItems((known) => mergeById(known, reply.items));
        setNext(reply.next);
        setListError(null);
      } else {
        setListError(errorText(kitRef.current, reply.error));
      }
    });
  }, [next, applied, loading]);

  // ---- upload ----------------------------------------------------------------------------------------------------
  const [upload, setUpload] = useState<UploadDraft | null>(null);
  const file = useRef<File | null>(null);
  const alt = useRef("");
  const sending = useRef(false);
  const preview = useRef<string | null>(null);

  const dropPreview = useCallback(() => {
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = null;
  }, []);
  useEffect(() => dropPreview, [dropPreview]);

  const onPickFile = useCallback(
    (picked: File) => {
      dropPreview();
      file.current = picked;
      const base = { fileName: picked.name, bytes: picked.size, altEn: alt.current };
      // A wrong type is refused here: nothing is sent. Size is not: a 20 MB phone photo re-encoded at 2560 px is about
      // 2 MB, so only the re-encoded file is measured (prepareImage, at Upload; job 03.2-09b).
      if (!isAcceptedType(picked.type)) {
        setUpload({ ...base, previewUrl: null, phase: "rejected", error: copy.wrongType });
        return;
      }
      preview.current = URL.createObjectURL(picked);
      setUpload({ ...base, previewUrl: preview.current, phase: "ready", error: null });
    },
    [copy, dropPreview],
  );

  const onAltChange = useCallback((altEn: string) => {
    alt.current = altEn;
    setUpload((previous) => (previous ? { ...previous, altEn } : previous));
  }, []);

  const onCancelUpload = useCallback(() => {
    dropPreview();
    file.current = null;
    alt.current = "";
    setUpload(null);
  }, [dropPreview]);

  const onSubmitUpload = useCallback(async () => {
    const chosen = file.current;
    const altEn = alt.current.trim();
    if (!chosen || altEn === "" || sending.current) return;
    sending.current = true;
    const settle = (patch: Partial<UploadDraft>) => setUpload((previous) => (previous ? { ...previous, ...patch } : previous));
    settle({ phase: "uploading", error: null });
    try {
      let prepared;
      try {
        prepared = await prepareImage(chosen);
      } catch (error) {
        const tooLarge = error instanceof ImagePrepError && error.reason === "too_large";
        settle({ phase: "rejected", error: tooLarge ? copy.tooLarge : copy.wrongType });
        return;
      }
      const reply = await opsPut<PutReply>(PATH, prepared.blob, {
        "content-type": prepared.contentType,
        "x-almar-sha256": prepared.sha256,
        "x-almar-width": String(prepared.width),
        "x-almar-height": String(prepared.height),
        "x-almar-alt-en": encodeURIComponent(altEn),
      });
      if (!reply.ok) {
        const { status, error } = reply;
        if (status === 413) settle({ phase: "rejected", error: copy.tooLarge });
        else if (status === 415) settle({ phase: "rejected", error: copy.wrongType });
        else if (error.code === "invalid" && (error.field === "sha256" || error.field === "content_length")) {
          settle({ phase: "failed", error: copy.incomplete });
        } else if (error.code === "slug_taken") {
          // The same file was being stored by another upload at that moment: a retry finds it (created false).
          settle({ phase: "failed", error: kit.errors.unavailable });
        } else settle({ phase: "failed", error: errorText(kit, error) });
        return;
      }
      // The same file was already in the library (created false): the server kept its row and its alt text, so show
      // that row as it is, not the text typed here.
      let existing: MediaItem | undefined;
      if (!reply.created) {
        const found = await opsFetch<ListReply>(PATH, { q: reply.key });
        if (found.ok) existing = found.items.find((item) => item.id === reply.id);
      }
      const stored: MediaItem = existing ?? {
        id: reply.id,
        key: reply.key,
        url: reply.url,
        width: prepared.width,
        height: prepared.height,
        alt_en: altEn,
        content_type: prepared.contentType,
        source: "upload",
        alt: { en: altEn, ar: null, es: null },
        alt_status: { en: "published", ar: "missing", es: "missing" },
        used_by: 0,
      };
      uploaded.current = [stored, ...uploaded.current.filter((item) => item.id !== stored.id)];
      setItems((known) => [stored, ...known.filter((item) => item.id !== stored.id)]);
      settle({ phase: "done", error: null });
      onUploaded?.(stored);
    } finally {
      sending.current = false;
    }
  }, [copy, kit, onUploaded]);

  const removeItem = useCallback((id: string) => {
    uploaded.current = uploaded.current.filter((item) => item.id !== id);
    setItems((known) => known.filter((item) => item.id !== id));
  }, []);

  return {
    library: {
      items,
      query,
      onQueryChange: setQuery,
      hasMore: next !== null,
      onLoadMore,
      upload,
      onPickFile,
      onAltChange,
      onSubmitUpload: () => void onSubmitUpload(),
      onCancelUpload,
      listError,
    },
    setItems,
    removeItem,
  };
}

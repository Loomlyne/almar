"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees (job 02). The scene frames every state in the preview shell, like the ops-kit scene.
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { MediaLibrary } from "../../../app/dashboard/(ops)/content/media/media-library";
import { MediaScreen } from "../../../app/dashboard/(ops)/content/media/media-screen";
import type { AltDraft } from "../../../components/ops/media-alt";
import type { Locale3, MediaRef } from "../../../components/ops/api-types";
import { MediaField, MediaListField } from "../../../components/ops/media-field";
import { MediaPicker, type PickerLibrary } from "../../../components/ops/media-picker";
import { MAX_UPLOAD_BYTES, type MediaAltStatus, type MediaItem, type UploadDraft } from "../../../components/ops/media-types";
import { mediaUrl } from "../../../lib/data/media";
import { foldText } from "../../../lib/data/stay-filter";
import { OPS_MEDIA_COPY } from "../../../lib/copy/ops-media";
import type { SceneContext, Scenes } from "../scene-types";

/**
 * Every state of the photo field, the picker, the upload form and the Media library, bracket data only. The photos are
 * the repo's own fixture photos on the media host (media-manifest keys through mediaUrl). The words are lib/copy/ops-media.ts.
 * Test-only: nothing here sends a request.
 */
const KEYS = [
  "destinations/cartagena/hero.webp",
  "destinations/medellin/hero.webp",
  "destinations/bogota/hero.webp",
  "destinations/san-andres/hero.webp",
  "destinations/cocora-valley/hero.webp",
  "destinations/cartagena/inset.webp",
  "destinations/medellin/inset.webp",
  "destinations/page/hero-2.webp",
  "destinations/page/hero-3.webp",
  "home/gallery/01.webp",
];

const ALT_WORD: Record<Locale3, string> = { en: "[Alt text", ar: "[النص البديل", es: "[Texto alternativo" };

/** Status of (en, ar, es) per photo: a spread of published, draft and missing. */
const STATUS: [MediaAltStatus, MediaAltStatus, MediaAltStatus][] = [
  ["published", "published", "published"],
  ["published", "draft", "missing"],
  ["published", "draft", "draft"],
  ["published", "missing", "missing"],
  ["published", "published", "draft"],
];

function itemOf(key: string, index: number): MediaItem {
  const status = STATUS[index % STATUS.length]!;
  const alt = (code: Locale3, at: number): string | null => (status[at] === "missing" ? null : `${ALT_WORD[code]} ${index + 1}]`);
  return {
    id: `m${index + 1}`,
    key,
    url: mediaUrl(key),
    width: 1920,
    height: 1280,
    alt_en: `${ALT_WORD.en} ${index + 1}]`,
    content_type: "image/webp",
    source: "import",
    alt: { en: alt("en", 0), ar: alt("ar", 1), es: alt("es", 2) },
    alt_status: { en: status[0], ar: status[1], es: status[2] },
    used_by: index === 2 ? 3 : index % 4,
  };
}

const ITEMS: MediaItem[] = KEYS.map(itemOf);

/** The kit and the shell read the almar-locale cookie; the harness picks the language from ?l=, so set it first. */
function Frame({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

const PREVIEW = "/assets/img/01b7e3d407f3fb73.webp";

function uploadDraft(ctx: SceneContext, kind: "ready" | "uploading" | "size"): UploadDraft {
  const copy = OPS_MEDIA_COPY[ctx.locale];
  const base = { fileName: "[File name].jpg", previewUrl: PREVIEW, altEn: "[Alt text]" };
  if (kind === "uploading") return { ...base, bytes: 3.4 * 1024 * 1024, phase: "uploading", error: null };
  if (kind === "size") return { ...base, bytes: MAX_UPLOAD_BYTES + 2.7 * 1024 * 1024, phase: "rejected", error: copy.tooLarge };
  return { ...base, bytes: 3.4 * 1024 * 1024, phase: "ready", error: null };
}

/** A picker library over the fixture photos: search is the same folded substring the real list will use. */
function useLibrary(upload: UploadDraft | null): PickerLibrary {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<UploadDraft | null>(upload);
  const needle = foldText(query.trim());
  const items = needle ? ITEMS.filter((item) => foldText(`${item.key} ${item.alt_en}`).includes(needle)) : ITEMS;
  return {
    items,
    query,
    onQueryChange: setQuery,
    hasMore: false,
    onLoadMore: () => undefined,
    upload: draft,
    onPickFile: (file) =>
      setDraft({ fileName: file.name, bytes: file.size, previewUrl: null, altEn: "", phase: "ready", error: null }),
    onAltChange: (altEn) => setDraft((previous) => (previous ? { ...previous, altEn } : previous)),
    onSubmitUpload: () => undefined,
    onCancelUpload: () => setDraft(null),
  };
}

function PickerScene({ ctx, upload }: { ctx: SceneContext; upload?: "ready" | "uploading" | "size" }) {
  const library = useLibrary(upload ? uploadDraft(ctx, upload) : null);
  const [selected, setSelected] = useState<string[]>(upload ? [] : ["m3"]);
  const [open, setOpen] = useState(true);
  return (
    <Frame locale={ctx.locale}>
      <FieldBehind locale={ctx.locale} />
      <MediaPicker
        {...library}
        open={open}
        onOpenChange={setOpen}
        locale={ctx.locale}
        multiple={false}
        selected={selected}
        onSelectedChange={setSelected}
        onChoose={() => setOpen(false)}
      />
    </Frame>
  );
}

const LABEL: Record<Locale3, { hero: string; gallery: string; heading: string }> = {
  en: { hero: "[Hero photo]", gallery: "[Gallery]", heading: "[Destination]" },
  ar: { hero: "[الصورة الرئيسية]", gallery: "[المعرض]", heading: "[الوجهة]" },
  es: { hero: "[Foto principal]", gallery: "[Galería]", heading: "[Destino]" },
};

/** The screen the field lives on: a heading and the field, so the picture shows it in its place. */
function FieldBehind({ locale }: { locale: Locale3 }) {
  const [photo, setPhoto] = useState<MediaRef | null>(null);
  return (
    <div className="flex max-w-dialog min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{LABEL[locale].heading}</h1>
      <MediaField id="media-behind" label={LABEL[locale].hero} value={photo} onChange={setPhoto} required locale={locale} />
    </div>
  );
}

function FieldScene({ ctx, chosen }: { ctx: SceneContext; chosen: boolean }) {
  const [photo, setPhoto] = useState<MediaRef | null>(chosen ? ITEMS[0]! : null);
  return (
    <Frame locale={ctx.locale}>
      <div className="flex max-w-dialog min-w-0 flex-col gap-6">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{LABEL[ctx.locale].heading}</h1>
        <MediaField id="media-hero" label={LABEL[ctx.locale].hero} value={photo} onChange={setPhoto} required locale={ctx.locale} />
      </div>
    </Frame>
  );
}

function GalleryScene({ ctx }: { ctx: SceneContext }) {
  const [photos, setPhotos] = useState<MediaRef[]>(ITEMS.slice(0, 4));
  return (
    <Frame locale={ctx.locale}>
      <div className="flex max-w-dialog min-w-0 flex-col gap-6">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{LABEL[ctx.locale].heading}</h1>
        <MediaListField id="media-gallery" label={LABEL[ctx.locale].gallery} value={photos} onChange={setPhotos} locale={ctx.locale} />
      </div>
    </Frame>
  );
}

/** Where 03.2-10's Translate button goes. It is not on main yet, so the scene marks the place. */
const TRANSLATE_SLOT: Record<Locale3, string> = { en: "[Translate button]", ar: "[زر الترجمة]", es: "[Botón Traducir]" };

function LibraryScene({ ctx, panel }: { ctx: SceneContext; panel: boolean }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(panel ? "m3" : null);
  const open = ITEMS.find((item) => item.id === "m3")!;
  const [draft, setDraft] = useState<AltDraft>({
    alt: { en: open.alt.en ?? "", ar: open.alt.ar ?? "", es: open.alt.es ?? "" },
    checked: { ar: false, es: false },
  });
  const [dirty, setDirty] = useState(false);
  const needle = foldText(query.trim());
  const items = needle ? ITEMS.filter((item) => foldText(`${item.key} ${item.alt_en}`).includes(needle)) : ITEMS;
  return (
    <Frame locale={ctx.locale}>
      <MediaScreen
        locale={ctx.locale}
        items={items}
        query={query}
        onQueryChange={setQuery}
        hasMore
        onLoadMore={() => undefined}
        onPickFile={() => undefined}
        openId={openId}
        onOpen={setOpenId}
        onClosePanel={() => setOpenId(null)}
        draft={draft}
        dirty={dirty}
        onAltChange={(code, text) => {
          setDraft((previous) => ({ ...previous, alt: { ...previous.alt, [code]: text } }));
          setDirty(true);
        }}
        onCheckedChange={(code, checked) => {
          setDraft((previous) => ({ ...previous, checked: { ...previous.checked, [code]: checked } }));
          setDirty(true);
        }}
        onSave={() => setDirty(false)}
        onDelete={() => setOpenId(null)}
        translateSlot={
          <span className="inline-flex min-h-control items-center border border-dashed border-line px-4 text-label text-muted">
            {TRANSLATE_SLOT[ctx.locale]}
          </span>
        }
      />
    </Frame>
  );
}

/**
 * The connected Media screen (MediaLibrary) as the page mounts it, for the behaviour tests: its requests are answered by
 * page.route fixtures. The Translate slot gets a test button that calls the panel's handler with a fixed reply, standing
 * in for 03.2-10's TranslateButton (not on main yet). Not one of the signed pictures.
 */
function LiveScene({ ctx }: { ctx: SceneContext }) {
  return (
    <Frame locale={ctx.locale}>
      <MediaLibrary
        slotOf={(apply) => (
          <>
            <button type="button" data-testid="fake-translate-ar" onClick={() => apply("ar", { alt: "[AR draft]" })}>
              ar
            </button>
            <button type="button" data-testid="fake-translate-es" onClick={() => apply("es", { alt: ["[ES draft]"] })}>
              es
            </button>
          </>
        )}
      />
    </Frame>
  );
}

export const scenes: Scenes = {
  "field-empty": (ctx) => <FieldScene ctx={ctx} chosen={false} />,
  "field-chosen": (ctx) => <FieldScene ctx={ctx} chosen />,
  gallery: (ctx) => <GalleryScene ctx={ctx} />,
  picker: (ctx) => <PickerScene ctx={ctx} />,
  "picker-upload": (ctx) => <PickerScene ctx={ctx} upload="ready" />,
  "picker-uploading": (ctx) => <PickerScene ctx={ctx} upload="uploading" />,
  "picker-error-size": (ctx) => <PickerScene ctx={ctx} upload="size" />,
  library: (ctx) => <LibraryScene ctx={ctx} panel={false} />,
  "library-panel": (ctx) => <LibraryScene ctx={ctx} panel />,
  "library-live": (ctx) => <LiveScene ctx={ctx} />,
};

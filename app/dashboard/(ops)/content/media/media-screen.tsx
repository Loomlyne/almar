"use client";

import { useRef, useState } from "react";
import { Button } from "../../../../../components/ui/button";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { PlusIcon } from "../../../../../components/icons/icons";
import type { Send, Target } from "../../../../../components/ops/auto-translate";
import { EditPage, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { ALT_FIELD, altMissing, isAltPublished, type AltText } from "../../../../../components/ops/media-alt";
import { FileName, fileNameOf } from "../../../../../components/ops/media-picker";
import { UPLOAD_TYPES, type MediaItem } from "../../../../../components/ops/media-types";
import { StatusChip } from "../../../../../components/ops/status-chip";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { formatPlural } from "../../../../../lib/journey-format";
import { OPS_MEDIA_COPY, type OpsMediaLocale } from "../../../../../lib/copy/ops-media";

export type { AltText };

/** A line under the heading: `info` is a plain status, `error` is read out as an alert. */
export type ScreenNotice = { kind: "info" | "error"; text: string };

/** The longest alt text the server takes (validate-media.ts ALT_MAX). */
const ALT_MAX = 300;

/**
 * Content -> Media (design canvas DashMediaNav): a grid of the library with search and Upload, and the kit's editor page
 * for one photo (kit panel B): the English alt text (Arabic and Spanish are added on Save), the photo and where it is
 * used, Save, Publish and Delete image. Presentational: media-library.tsx wires the data and the requests.
 */
export function MediaScreen({
  locale,
  items,
  query,
  onQueryChange,
  hasMore,
  onLoadMore,
  onPickFile,
  openId,
  onOpen,
  onClose,
  alt,
  savedAlt,
  onAltChange,
  onSave,
  onPublish,
  onDelete,
  busy = false,
  notice,
  panelError,
  send,
}: {
  locale: OpsMediaLocale;
  items: MediaItem[];
  query: string;
  onQueryChange: (query: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  onPickFile: (file: File) => void;
  openId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  alt: AltText;
  savedAlt: AltText;
  onAltChange: (locale: "en" | Target, text: string) => void;
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  onPublish: () => Promise<unknown>;
  onDelete: () => void;
  busy?: boolean;
  /** A line above the list, such as "The file stays in storage" after a delete. */
  notice?: ScreenNotice | null;
  /** A refusal shown on the open photo's page, such as "This photo is used, so it cannot be deleted." */
  panelError?: string | null;
  /** Test seam for the translate request (the scenes answer it themselves). */
  send?: Send;
}) {
  const copy = OPS_MEDIA_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const open = items.find((item) => item.id === openId) ?? null;
  // An imported photo is kept by the site pages (ops_delete_media refuses it), so it reads as used.
  const kept = open ? open.used_by > 0 || open.source === "import" : false;

  const list = (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.media}</h1>
        <input
          ref={fileInput}
          type="file"
          accept={UPLOAD_TYPES}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPickFile(file);
            event.target.value = "";
          }}
        />
        <Button onClick={() => fileInput.current?.click()}>
          <PlusIcon size={16} aria-hidden="true" />
          {copy.upload}
        </Button>
      </div>
      {notice ? (
        <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "m-0 text-label text-error" : "m-0 text-label text-ink"}>
          {notice.text}
        </p>
      ) : null}
      <Field
        id="media-search"
        label={copy.search}
        search
        className="max-w-none md:max-w-80"
        autoComplete="off"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      {items.length === 0 ? (
        <p className="m-0 text-label text-muted">{copy.noMatch}</p>
      ) : (
        <ul aria-label={copy.media} className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <li key={item.id} className="flex min-w-0 flex-col border border-line bg-surface">
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="m-0 flex min-w-0 cursor-pointer flex-col border-0 bg-transparent p-0 text-start font-body"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.alt_en}
                  width={item.width ?? undefined}
                  height={item.height ?? undefined}
                  loading="lazy"
                  decoding="async"
                  className="block aspect-4/3 w-full bg-ivory object-cover"
                />
                <span className="truncate px-3 pt-2 text-caption text-ink">
                  <FileName>{fileNameOf(item.key)}</FileName>
                </span>
              </button>
              <div className="px-3 pb-2 pt-1">
                <StatusChip published={isAltPublished(item)} locale={locale} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {hasMore ? (
        <div>
          <Button variant="secondary" onClick={onLoadMore}>
            {copy.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <EditPage
        openKey={open ? open.id : null}
        list={list}
        backLabel={copy.media}
        onClose={onClose}
        title={open ? fileNameOf(open.key) : ""}
        isPublished={open ? isAltPublished(open) : false}
        dirty={alt.en !== savedAlt.en || alt.ar !== savedAlt.ar || alt.es !== savedAlt.es}
        busy={busy}
        canSave={alt.en.trim() !== ""}
        missing={altMissing(alt)}
        error={null}
        english={{ [ALT_FIELD]: alt.en }}
        savedEnglish={{ [ALT_FIELD]: savedAlt.en }}
        translations={{ ar: { [ALT_FIELD]: alt.ar }, es: { [ALT_FIELD]: alt.es } }}
        translationFields={[{ name: ALT_FIELD, label: copy.altText, maxLength: ALT_MAX }]}
        onTranslationChange={(target, _name, value) => onAltChange(target, Array.isArray(value) ? value.join(" ") : value)}
        onSave={onSave}
        onPublish={onPublish}
        onDelete={() => setConfirming(true)}
        deleteLabel={copy.deleteImage}
        deleteDisabled={kept}
        deleteNote={kept ? copy.usedBlocksDelete : copy.staysInStorage}
        notice={
          panelError ? (
            <p role="alert" className="m-0 text-label text-error">
              {panelError}
            </p>
          ) : null
        }
        send={send}
        sections={
          open
            ? [
                {
                  key: "alt",
                  title: copy.altText,
                  translatable: true,
                  content: (
                    <Field
                      id="media-alt-en"
                      label={copy.altText}
                      className="max-w-none"
                      required
                      maxLength={ALT_MAX}
                      autoComplete="off"
                      lang="en"
                      dir="ltr"
                      value={alt.en}
                      onChange={(event) => onAltChange("en", event.target.value)}
                    />
                  ),
                },
                {
                  key: "photo",
                  title: kit.editor.sections.photo,
                  column: "side",
                  content: (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={open.url} alt={open.alt_en} className="block aspect-4/3 w-full bg-ivory object-cover" />
                      <p className="m-0 text-label text-ink">{formatPlural(copy.usedIn, open.used_by, locale)}</p>
                    </>
                  ),
                },
              ]
            : []
        }
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.deleteImage}
        description={copy.staysInStorage}
        confirmLabel={copy.deleteImage}
        cancelLabel={kit.cancel}
        onConfirm={() => {
          setConfirming(false);
          onDelete();
        }}
      />
    </>
  );
}

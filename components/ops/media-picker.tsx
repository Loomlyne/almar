"use client";

import { useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Dialog } from "../ui/dialog";
import { Field } from "../ui/field";
import { AlertCircleIcon, CheckIcon, SpinnerIcon } from "../icons/icons";
import { cn } from "../../lib/cn";
import { OPS_MEDIA_COPY, type OpsMediaLocale } from "../../lib/copy/ops-media";
import { UPLOAD_TYPES, type MediaItem, type UploadDraft } from "./media-types";

/** Tailwind's lg. Below it the picker is a full-screen sheet with its buttons docked at the bottom; from it, a dialog. */
const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}

/** A file name is Latin text inside any language: isolate it so Arabic does not reorder the dots and brackets. */
export function FileName({ children }: { children: ReactNode }) {
  return <bdi>{children}</bdi>;
}

/** The last part of a media key: the file name the owner knows the photo by. */
export function fileNameOf(key: string): string {
  return key.split("/").pop() ?? key;
}

/** "3.4 MB" in the dashboard language (Intl writes the unit). */
export function sizeText(bytes: number, locale: OpsMediaLocale): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024));
}

/** What the picker needs from its owner. The picker holds no data and sends no request: Task 3 of 03.2-09 wires it. */
export type PickerLibrary = {
  items: MediaItem[];
  query: string;
  onQueryChange: (query: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  /** The upload form, or null while the library is shown. */
  upload: UploadDraft | null;
  /** A file was chosen: the owner validates it and fills `upload`. */
  onPickFile: (file: File) => void;
  onAltChange: (altEn: string) => void;
  onSubmitUpload: () => void;
  /** Back from the upload form to the library. */
  onCancelUpload: () => void;
};

type PickerProps = PickerLibrary & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: OpsMediaLocale;
  /** One photo (selectable cards, aria-pressed) or several (checkboxes). */
  multiple: boolean;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  onChoose: (items: MediaItem[]) => void;
};

function Thumb({ item }: { item: MediaItem }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt={item.alt_en}
      width={item.width ?? undefined}
      height={item.height ?? undefined}
      loading="lazy"
      decoding="async"
      className="block aspect-4/3 w-full bg-ivory object-cover"
    />
  );
}

function Caption({ item }: { item: MediaItem }) {
  return (
    <span className="flex min-w-0 flex-col gap-1 px-2 py-2 text-start">
      <span className="truncate text-caption text-ink">
        <FileName>{fileNameOf(item.key)}</FileName>
      </span>
      <span className="truncate text-caption text-muted">{item.alt_en}</span>
    </span>
  );
}

/**
 * The photo picker: a dialog over the library (grid, search, choose one or several) and, from "Upload a photo", the
 * upload form (file, required English alt text). Everything arrives through props.
 */
export function MediaPicker({
  open,
  onOpenChange,
  locale,
  multiple,
  selected,
  onSelectedChange,
  onChoose,
  items,
  query,
  onQueryChange,
  hasMore,
  onLoadMore,
  upload,
  onPickFile,
  onAltChange,
  onSubmitUpload,
  onCancelUpload,
}: PickerProps) {
  const copy = OPS_MEDIA_COPY[locale];
  const base = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const wide = useWide();
  const picked = items.filter((item) => selected.includes(item.id));

  function toggle(id: string, on: boolean) {
    if (!multiple) onSelectedChange(on ? [id] : []);
    else
      onSelectedChange(
        on ? [...selected, id] : selected.filter((other) => other !== id),
      );
  }

  const fileControl = (
    <>
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
      <Button variant="secondary" onClick={() => fileInput.current?.click()}>
        {copy.uploadPhoto}
      </Button>
    </>
  );

  const footerButtons = upload ? (
    <>
      <Button
        onClick={onSubmitUpload}
        busy={upload.phase === "uploading"}
        disabled={
          upload.phase === "rejected" ||
          upload.phase === "done" ||
          upload.altEn.trim() === ""
        }
      >
        {upload.phase === "uploading" ? copy.uploading : copy.upload}
      </Button>
      <Button variant="ghost" onClick={onCancelUpload}>
        {copy.choosePhoto}
      </Button>
    </>
  ) : (
    <>
      <Button disabled={picked.length === 0} onClick={() => onChoose(picked)}>
        {copy.choose}
      </Button>
      {fileControl}
    </>
  );

  const body = upload ? (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {upload.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={upload.previewUrl}
            alt=""
            className="block h-24 w-32 shrink-0 bg-ivory object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <p className="m-0 break-all text-label text-ink">
            <FileName>{upload.fileName}</FileName>
          </p>
          <p className="m-0 text-caption text-muted">
            {sizeText(upload.bytes, locale)}
          </p>
        </div>
      </div>
      {upload.error ? (
        <p
          role="alert"
          className="m-0 flex items-start gap-2 text-label text-error"
        >
          <AlertCircleIcon size={20} className="shrink-0" />
          <span>{upload.error}</span>
        </p>
      ) : null}
      <Field
        id={`${base}-alt`}
        label={copy.altEnRequired}
        hint={copy.uploadHint}
        className="max-w-none"
        required
        maxLength={300}
        autoComplete="off"
        dir="ltr"
        lang="en"
        value={upload.altEn}
        onChange={(event) => onAltChange(event.target.value)}
      />
      <p
        className="m-0 flex min-h-6 items-center gap-2 text-label text-ink"
        aria-live="polite"
      >
        {upload.phase === "uploading" ? (
          <>
            <SpinnerIcon size={20} />
            {copy.uploading}
          </>
        ) : upload.phase === "done" ? (
          <>
            <CheckIcon size={20} />
            {copy.uploaded}
          </>
        ) : null}
      </p>
    </div>
  ) : (
    <div className="flex min-w-0 flex-col gap-4">
      <Field
        id={`${base}-search`}
        label={copy.search}
        search
        className="max-w-none"
        autoComplete="off"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      {items.length === 0 ? (
        <p className="m-0 text-label text-muted">{copy.noMatch}</p>
      ) : (
        <ul
          aria-label={copy.media}
          className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5"
        >
          {items.map((item) => {
            const on = selected.includes(item.id);
            return (
              <li
                key={item.id}
                className={cn(
                  "flex min-w-0 flex-col border bg-surface",
                  on ? "border-teal shadow-selected" : "border-line",
                )}
              >
                {multiple ? (
                  <>
                    <Thumb item={item} />
                    <div className="px-2">
                      <Checkbox
                        className="w-full"
                        checked={on}
                        onChange={(event) =>
                          toggle(item.id, event.target.checked)
                        }
                        label={
                          <span className="truncate text-caption">
                            <FileName>{fileNameOf(item.key)}</FileName>
                          </span>
                        }
                      />
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(item.id, !on)}
                    className="m-0 flex min-w-0 cursor-pointer flex-col border-0 bg-transparent p-0 font-body"
                  >
                    <Thumb item={item} />
                    <Caption item={item} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hasMore ? (
        <Button variant="secondary" onClick={onLoadMore}>
          {copy.loadMore}
        </Button>
      ) : null}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={multiple ? copy.addPhotos : copy.choosePhoto}
      closeLabel={copy.close}
      size={wide ? "wide" : "full"}
      footer={
        wide ? (
          footerButtons
        ) : (
          <div className="flex w-full flex-wrap items-center gap-2 border-t border-line bg-surface p-4">
            {footerButtons}
          </div>
        )
      }
    >
      {wide ? body : <div className="p-4">{body}</div>}
    </Dialog>
  );
}

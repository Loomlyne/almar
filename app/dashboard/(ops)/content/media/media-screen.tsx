"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "../../../../../components/ui/button";
import { Checkbox } from "../../../../../components/ui/checkbox";
import { Chip } from "../../../../../components/ui/chip";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { PlusIcon } from "../../../../../components/icons/icons";
import { EditPanel } from "../../../../../components/ops/edit-panel";
import type { Locale3 } from "../../../../../components/ops/api-types";
import { altStateOf, type AltDraft } from "../../../../../components/ops/media-alt";
import { FileName, fileNameOf } from "../../../../../components/ops/media-picker";
import { UPLOAD_TYPES, type MediaAltStatus, type MediaItem } from "../../../../../components/ops/media-types";
import { OPS_KIT_COPY, fillCopy } from "../../../../../lib/copy/ops-kit";
import { OPS_MEDIA_COPY, type OpsMediaLocale } from "../../../../../lib/copy/ops-media";

const LOCALES: readonly Locale3[] = ["en", "ar", "es"];

export type { AltDraft };

/** A line under the heading: `info` is a plain status, `error` is read out as an alert. */
export type ScreenNotice = { kind: "info" | "error"; text: string };

function StatusChips({ item, locale }: { item: MediaItem; locale: OpsMediaLocale }) {
  const kit = OPS_KIT_COPY[locale];
  const word = (status: MediaAltStatus) => (status === "published" ? kit.published : status === "draft" ? kit.draft : kit.missing);
  return (
    <span role="group" aria-label={OPS_MEDIA_COPY[locale].altRow} className="flex flex-wrap gap-1">
      {LOCALES.map((code) => {
        const status = item.alt_status[code];
        return (
          <Chip key={code} interactive={false} size="dense" on={status === "published"} muted={status === "missing"}>
            {code.toUpperCase()}
            <span className="sr-only"> {word(status)}</span>
          </Chip>
        );
      })}
    </span>
  );
}

/**
 * Content -> Media (design canvas DashMediaNav): a grid of the library with search and Upload, and a side panel for
 * one photo with alt text in three languages, where it is used, Save and Delete image. Presentational: the page wires
 * the data and the requests (03.2-09 Task 3).
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
  onClosePanel,
  draft,
  dirty,
  onAltChange,
  onCheckedChange,
  onSave,
  onDelete,
  translateSlot,
  notice,
  panelError,
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
  onClosePanel: () => void;
  draft: AltDraft;
  dirty: boolean;
  onAltChange: (locale: Locale3, text: string) => void;
  onCheckedChange: (locale: "ar" | "es", checked: boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  /** Where 03.2-10's Translate button goes (props fixed by its draft). */
  translateSlot?: ReactNode;
  /** A line above the list, such as "The file stays in storage" after a delete. */
  notice?: ScreenNotice | null;
  /** A refusal shown in the open panel, such as "This photo is used, so it cannot be deleted." */
  panelError?: string | null;
}) {
  const copy = OPS_MEDIA_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const open = items.find((item) => item.id === openId) ?? null;

  const stateOf = (code: Locale3): MediaAltStatus => altStateOf(draft, code);

  return (
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
                <StatusChips item={item} locale={locale} />
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

      {open ? (
        <EditPanel
          open
          onOpenChange={(next) => {
            if (!next) onClosePanel();
          }}
          title={fileNameOf(open.key)}
          tabs={[{ key: "alt", label: copy.altText }]}
          tab="alt"
          onTabChange={() => undefined}
          dirty={dirty}
          footer={
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button disabled={!dirty} onClick={onSave}>
                  {copy.save}
                </Button>
                <Button
                  variant="danger"
                  disabled={open.used_by > 0}
                  aria-describedby="media-delete-note"
                  onClick={() => setConfirming(true)}
                >
                  {copy.deleteImage}
                </Button>
              </div>
              {panelError ? (
                <p role="alert" className="m-0 text-label text-error">
                  {panelError}
                </p>
              ) : null}
              <p id="media-delete-note" className="m-0 text-label text-muted">
                {open.used_by > 0 ? copy.usedBlocksDelete : copy.staysInStorage}
              </p>
            </div>
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt={open.alt_en} className="block h-36 w-full bg-ivory object-cover" />
          <p className="m-0 text-label text-ink">
            {open.used_by === 1 ? copy.usedInOne : fillCopy(copy.usedIn, { n: open.used_by })}
          </p>
          <div className="flex min-w-0 flex-col gap-4">
            {LOCALES.map((code) => (
              <div key={code} className="flex min-w-0 flex-col gap-2">
                {/* 03.2-10: render <TranslateButton source={{ alt: draft.alt.en }} hasExisting onDrafts={applyAltDrafts} locale disabled> here (media-library.tsx passes it in). */}
                {code === "ar" && translateSlot ? (
                  <div className="flex items-center gap-2">{translateSlot}</div>
                ) : null}
                <Field
                  id={`media-alt-${code}`}
                  label={`${copy.altText} · ${code.toUpperCase()}`}
                  className="max-w-none"
                  maxLength={300}
                  autoComplete="off"
                  lang={code}
                  dir={code === "ar" ? "rtl" : "ltr"}
                  value={draft.alt[code]}
                  onChange={(event) => onAltChange(code, event.target.value)}
                />
                {code === "en" ? null : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Checkbox
                      label={copy.checkedTranslation}
                      checked={draft.checked[code]}
                      disabled={stateOf(code) === "missing"}
                      onChange={(event) => onCheckedChange(code, event.target.checked)}
                    />
                    <Chip interactive={false} size="dense" on={stateOf(code) === "published"} muted={stateOf(code) === "missing"}>
                      {stateOf(code) === "published" ? kit.published : stateOf(code) === "draft" ? kit.draft : kit.missing}
                    </Chip>
                  </div>
                )}
              </div>
            ))}
          </div>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={copy.deleteImage}
            description={copy.staysInStorage}
            confirmLabel={copy.deleteImage}
            cancelLabel={copy.close}
            onConfirm={() => {
              setConfirming(false);
              onDelete();
            }}
          />
        </EditPanel>
      ) : null}
    </div>
  );
}

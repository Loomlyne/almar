"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { CameraIcon } from "../icons/icons";
import { OPS_MEDIA_COPY, type OpsMediaLocale } from "../../lib/copy/ops-media";
import { OPS_KIT_COPY } from "../../lib/copy/ops-kit";
import type { MediaRef } from "./api-types";
import { FileName, MediaPicker, fileNameOf, type PickerLibrary } from "./media-picker";

function Thumb({ photo }: { photo: MediaRef }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      alt={photo.alt_en}
      width={photo.width ?? undefined}
      height={photo.height ?? undefined}
      className="block h-20 w-28 shrink-0 bg-ivory object-cover"
    />
  );
}

function PhotoText({ photo }: { photo: MediaRef }) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-label text-ink">
        <FileName>{fileNameOf(photo.key)}</FileName>
      </span>
      <span className="truncate text-caption text-muted">{photo.alt_en}</span>
    </span>
  );
}

/**
 * The one photo control of every dashboard screen (one photo): choose from the library or upload. `library` is the
 * picker's data and handlers; 03.2-09 Task 3 replaces it with the real client, the visible props stay.
 */
export function MediaField({
  id,
  label,
  value,
  onChange,
  required,
  locale,
  library,
}: {
  id: string;
  label: string;
  value: MediaRef | null;
  onChange: (next: MediaRef | null) => void;
  required?: boolean;
  locale: OpsMediaLocale;
  library: PickerLibrary;
}) {
  const copy = OPS_MEDIA_COPY[locale];
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-label text-ink">
        {label}
        {required ? (
          <span aria-hidden="true"> *</span>
        ) : null}
      </label>
      {value ? (
        <div className="flex min-w-0 items-center gap-4 border border-line bg-surface p-2">
          <Thumb photo={value} />
          <PhotoText photo={value} />
        </div>
      ) : (
        <div className="flex h-20 items-center justify-center border border-dashed border-line bg-surface text-muted">
          <CameraIcon size={24} aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          id={id}
          variant="secondary"
          aria-required={required || undefined}
          onClick={() => {
            setSelected(value ? [value.id] : []);
            setOpen(true);
          }}
        >
          {value ? copy.changePhoto : copy.choosePhoto}
        </Button>
        {value ? (
          <Button variant="ghost" onClick={() => onChange(null)}>
            {copy.removePhoto}
          </Button>
        ) : null}
      </div>
      <MediaPicker
        {...library}
        open={open}
        onOpenChange={setOpen}
        locale={locale}
        multiple={false}
        selected={selected}
        onSelectedChange={setSelected}
        onChoose={(items) => {
          if (items[0]) onChange(items[0]);
          setOpen(false);
          document.getElementById(id)?.focus();
        }}
      />
    </div>
  );
}

/** An ordered gallery: add several from the library, Move up / Move down, Remove. The order is the position. */
export function MediaListField({
  id,
  label,
  value,
  onChange,
  locale,
  library,
}: {
  id: string;
  label: string;
  value: MediaRef[];
  onChange: (next: MediaRef[]) => void;
  locale: OpsMediaLocale;
  library: PickerLibrary;
}) {
  const copy = OPS_MEDIA_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  function move(at: number, by: -1 | 1) {
    const to = at + by;
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [taken] = next.splice(at, 1);
    if (taken) next.splice(to, 0, taken);
    onChange(next);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      {value.length > 0 ? (
        <ol aria-label={label} className="m-0 flex list-none flex-col gap-2 p-0">
          {value.map((photo, at) => (
            <li key={photo.id} className="flex min-w-0 flex-col gap-2 border border-line bg-surface p-2">
              <div className="flex min-w-0 items-center gap-4">
                <Thumb photo={photo} />
                <PhotoText photo={photo} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={at === 0} onClick={() => move(at, -1)}>
                  {kit.moveUp}
                </Button>
                <Button variant="secondary" disabled={at === value.length - 1} onClick={() => move(at, 1)}>
                  {kit.moveDown}
                </Button>
                <Button variant="ghost" onClick={() => onChange(value.filter((other) => other.id !== photo.id))}>
                  {copy.removePhoto}
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex h-20 items-center justify-center border border-dashed border-line bg-surface text-muted">
          <CameraIcon size={24} aria-hidden="true" />
        </div>
      )}
      <div>
        <Button
          id={id}
          variant="secondary"
          onClick={() => {
            setSelected([]);
            setOpen(true);
          }}
        >
          {copy.addPhotos}
        </Button>
      </div>
      <MediaPicker
        {...library}
        open={open}
        onOpenChange={setOpen}
        locale={locale}
        multiple
        selected={selected}
        onSelectedChange={setSelected}
        onChoose={(items) => {
          const have = new Set(value.map((photo) => photo.id));
          onChange([...value, ...items.filter((item) => !have.has(item.id))]);
          setOpen(false);
          document.getElementById(id)?.focus();
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronIcon } from "../icons/icons";
import { cn } from "../../lib/cn";
import { Dialog } from "./dialog";

export type GalleryImage = { src: string; alt: string };

export type GalleryLabels = {
  /** Template for a tile's accessible name, for example "Open {alt}". */
  open: string;
  previous: string;
  next: string;
  close: string;
  /** Template for the position line, for example "{n} of {total}". */
  count: string;
};

const STEP =
  "inline-flex size-control shrink-0 cursor-pointer items-center justify-center rounded-none border border-line bg-surface p-0 text-teal";

/**
 * A grid of pictures; each opens a lightbox on the shared Dialog (scrim, layer, focus trap and
 * Escape are the Dialog's own). Previous and next wrap round, so neither is ever disabled.
 * ArrowRight is next in left-to-right pages and ArrowLeft is next in right-to-left pages.
 * Focus goes back to the tile that opened the lightbox.
 */
export function Gallery({
  images,
  labels,
  className,
}: {
  images: GalleryImage[];
  labels: GalleryLabels;
  className?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const tiles = useRef<Array<HTMLButtonElement | null>>([]);
  const lastOpened = useRef(0);
  const total = images.length;
  const open = index !== null;

  function step(by: 1 | -1) {
    setIndex((current) => (current === null ? current : (current + by + total) % total));
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const rtl = document.documentElement.dir === "rtl";
      const forward = rtl ? event.key === "ArrowLeft" : event.key === "ArrowRight";
      step(forward ? 1 : -1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // step reads only the state setter and `total`.
  }, [open, total]);

  // The Dialog has no trigger element to hand focus back to, so return it to the tile by hand,
  // after the dialog's own cleanup has run.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const timer = window.setTimeout(() => tiles.current[lastOpened.current]?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (total === 0) return null;
  const current = index === null ? null : images[index];

  return (
    <>
      <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3", className)}>
        {images.map((image, i) => (
          <button
            key={`${image.src}-${i}`}
            ref={(el) => {
              tiles.current[i] = el;
            }}
            type="button"
            aria-label={labels.open.replace("{alt}", image.alt)}
            onClick={() => {
              lastOpened.current = i;
              setIndex(i);
            }}
            className="block w-full min-w-0 cursor-pointer rounded-none border-0 bg-transparent p-0"
          >
            <img
              src={image.src}
              alt=""
              decoding="async"
              className="block w-full object-cover outline outline-1 outline-line -outline-offset-1"
              style={{ aspectRatio: "4 / 3" }}
            />
          </button>
        ))}
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setIndex(null);
        }}
        title={current?.alt ?? ""}
        closeLabel={labels.close}
        size="wide"
        footer={
          current ? (
            <div className="flex w-full items-center justify-between gap-4">
              {total > 1 ? (
                <button type="button" className={STEP} aria-label={labels.previous} onClick={() => step(-1)}>
                  <ChevronIcon size={20} className="-scale-x-100 rtl:scale-x-100" />
                </button>
              ) : (
                <span />
              )}
              <p aria-live="polite" className="m-0 text-label text-ink tabular-nums">
                {labels.count.replace("{n}", String((index ?? 0) + 1)).replace("{total}", String(total))}
              </p>
              {total > 1 ? (
                <button type="button" className={STEP} aria-label={labels.next} onClick={() => step(1)}>
                  <ChevronIcon size={20} className="rtl:-scale-x-100" />
                </button>
              ) : (
                <span />
              )}
            </div>
          ) : null
        }
      >
        {current ? (
          <img
            src={current.src}
            alt={current.alt}
            className="block h-auto w-full object-contain"
          />
        ) : null}
      </Dialog>
    </>
  );
}

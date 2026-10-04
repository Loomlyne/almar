"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronIcon, PauseIcon, PlayIcon } from "../icons/icons";
import { cn } from "../../lib/cn";
import { Reveal } from "./reveal";

export type SliderImage = { src: string; alt: string };

export type SliderLabels = {
  /** The carousel region's name, for example "Photos of Casa Verde". */
  region: string;
  previous: string;
  next: string;
  /** Names a dot: "{n}" is the 1-based slide number, for example "Go to photo {n}". */
  goTo: string;
  /** Names a slide and the live line: "{n}" and "{total}", for example "Photo {n} of {total}". */
  slide: string;
  /** The Pause and Play control names. Autoplay runs only when both are given (WCAG 2.2.2: a way to stop it). */
  pause?: string;
  play?: string;
};

/** One slide every 2000 ms (measured on the live Framer page, A11). */
export const AUTOPLAY_MS = 2000;

type Box = { offsetLeft: number; offsetWidth: number };

/**
 * The horizontal translation in px that brings slide `index` to where slide 0 sits. `boxes` are the measured slide
 * boxes relative to the track. LTR: slides run left to right; RTL: right to left, so the offset is measured between
 * the slides' right edges and is positive.
 */
export function slideOffset(boxes: Box[], index: number, rtl: boolean): number {
  const first = boxes[0];
  const target = boxes[index];
  if (!first || !target) return 0;
  const offset = rtl
    ? first.offsetLeft + first.offsetWidth - (target.offsetLeft + target.offsetWidth)
    : -(target.offsetLeft - first.offsetLeft);
  return offset + 0; // + 0 turns -0 into 0
}

const fill = (template: string, slots: Record<string, number>) =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in slots ? String(slots[key]) : whole));

const REDUCED = "(prefers-reduced-motion: reduce)";

const SLIDE = {
  strip: "h-70 w-75 md:h-120 md:w-150",
  peek: "w-full aspect-video",
  hero: "h-120 w-full md:h-svh",
} as const;

const ARROW =
  "absolute top-1/2 z-10 inline-flex size-control -translate-y-1/2 cursor-pointer items-center justify-center rounded-none border-0 bg-ivory p-0 text-teal";

/**
 * A photo slider. Served HTML (and with JavaScript off) is a horizontally scrollable, scroll-snapped track holding every
 * image and no control. After mount it becomes a clipped, transformed track with previous and next buttons, dots, swipe,
 * arrow keys, wrap-around, mirrored in right-to-left pages.
 *
 * - "strip": fixed-size slides in a full-bleed clip (the home gallery); no side padding.
 * - "peek": 16:9 slides with the page's side padding inside the clip, so the neighbours show at both edges (the stay
 *   gallery).
 * - "hero": full-width, full-height slides with no gap and no previous/next arrows (dots and Pause only). The caller's
 *   `children` sit centred over the photos under a shade (the /destinations kicker and h1). The photos enter with the
 *   "photo" reveal; every slide loads eagerly, so each is a real image in the served HTML.
 * `dotsEvery` 2 draws one dot per two slides (dot i shows slide 2i). `autoplay` moves one slide every AUTOPLAY_MS while
 * not hovered, not keyboard-focused and the tab is visible; any manual input stops it for good, a Pause/Play button is
 * offered, and under prefers-reduced-motion it never moves and the button is not drawn.
 */
export function Slider({
  images,
  labels,
  layout,
  dotsEvery = 1,
  autoplay = false,
  className,
  children,
}: {
  images: SliderImage[];
  labels: SliderLabels;
  layout: "strip" | "peek" | "hero";
  dotsEvery?: number;
  autoplay?: boolean;
  className?: string;
  /** Hero layout only: the overlay drawn over the photos. */
  children?: ReactNode;
}) {
  const hero = layout === "hero";
  const total = images.length;
  const [enhanced, setEnhanced] = useState(false);
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [rtl, setRtl] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [playing, setPlaying] = useState(autoplay);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number } | null>(null);

  const autoplayAllowed = autoplay && Boolean(labels.pause && labels.play) && total > 1;

  useEffect(() => {
    setEnhanced(true);
    const mq = window.matchMedia(REDUCED);
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      mq.removeEventListener("change", onChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Measure the slide boxes and place the track. Runs on mount of the transformed track, on every slide change and on resize.
  const place = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const direction = (el.closest("[dir]")?.getAttribute("dir") ?? document.documentElement.dir) === "rtl";
    const boxes = Array.from(el.children).map((child) => ({
      offsetLeft: (child as HTMLElement).offsetLeft,
      offsetWidth: (child as HTMLElement).offsetWidth,
    }));
    setRtl(direction);
    setOffset(slideOffset(boxes, index, direction));
  }, [index]);

  useEffect(() => {
    if (!enhanced) return;
    place();
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", place);
      return () => window.removeEventListener("resize", place);
    }
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => observer.disconnect();
  }, [enhanced, place]);

  const autoplaying = enhanced && autoplayAllowed && playing && !reduced;
  const running = autoplaying && !hovered && !focused && visible;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % total), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [running, total]);

  /** Manual movement: it stops autoplay for good (the Play button restarts it). */
  function move(to: number) {
    setPlaying(false);
    setIndex(((to % total) + total) % total);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const forward = rtl ? event.key === "ArrowLeft" : event.key === "ArrowRight";
    move(index + (forward ? 1 : -1));
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const start = press.current;
    press.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) <= 40 || Math.abs(dx) <= Math.abs(dy)) return;
    // Next is a leftward swipe in left-to-right pages and a rightward one in right-to-left pages.
    const forward = rtl ? dx > 0 : dx < 0;
    move(index + (forward ? 1 : -1));
  }

  const dotCount = Math.ceil(total / Math.max(1, dotsEvery));
  const activeDot = Math.floor(index / Math.max(1, dotsEvery));
  const near = (i: number) => i === index || i === (index + 1) % total || i === (index - 1 + total) % total;
  const gap = layout === "strip" ? "gap-8" : hero ? "gap-0" : "gap-2";

  const slides = images.map((image, i) => (
    <div
      key={`${image.src}-${i}`}
      role="group"
      aria-roledescription="slide"
      aria-label={fill(labels.slide, { n: i + 1, total })}
      className={cn("shrink-0", SLIDE[layout], !enhanced && "snap-start")}
    >
      <img
        src={image.src}
        alt={image.alt}
        loading={hero || i === 0 || (enhanced && near(i)) ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className="block size-full object-cover"
      />
    </div>
  ));

  const photos = enhanced ? (
    <div className={cn(layout === "peek" && "px-4 md:px-16")}>
      <div
        ref={track}
        style={{ translate: `${offset}px 0` }}
        className={cn(
          "relative flex touch-pan-y transition-transform duration-slide ease-reveal motion-reduce:transition-none",
          gap,
        )}
      >
        {slides}
      </div>
    </div>
  ) : (
    // Served HTML and no JavaScript: every photo, reached by scrolling. Focusable so a keyboard can scroll it.
    <div
      tabIndex={0}
      className={cn(
        "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
        layout === "peek" && "px-4 md:px-16 scroll-px-4 md:scroll-px-16",
        gap,
      )}
    >
      {slides}
    </div>
  );

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label={labels.region}
      onKeyDown={enhanced ? onKeyDown : undefined}
      // Swipe is read on the whole region, not on the photos' track: at the last slide the track ends before the region
      // does, and a swipe that starts in the empty strip beside it must still go (plan 45). A press that starts on a
      // button (arrow, dot, Pause) is a click, not a swipe.
      onPointerDown={
        enhanced
          ? (event) => {
              press.current = (event.target as Element).closest("button") ? null : { x: event.clientX, y: event.clientY };
            }
          : undefined
      }
      onPointerUp={enhanced ? onPointerUp : undefined}
      onPointerCancel={
        enhanced
          ? () => {
              press.current = null;
            }
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      className={cn("relative w-full touch-pan-y overflow-hidden", className)}
    >
      {hero ? <Reveal kind="photo">{photos}</Reveal> : photos}
      {hero ? (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-b from-ink/55 via-ink/30 to-ink/60" />
          {children ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 md:px-8">{children}</div>
          ) : null}
        </>
      ) : null}

      {enhanced && total > 1 ? (
        <>
          {hero ? null : (
            <>
              <button type="button" aria-label={labels.previous} onClick={() => move(index - 1)} className={cn(ARROW, "start-4")}>
                <ChevronIcon size={20} className="-scale-x-100 rtl:scale-x-100" />
              </button>
              <button type="button" aria-label={labels.next} onClick={() => move(index + 1)} className={cn(ARROW, "end-4")}>
                <ChevronIcon size={20} className="rtl:-scale-x-100" />
              </button>
            </>
          )}
          {dotCount > 1 ? (
            // A dark strip behind the dots, so they read on a light photo too (an ivory outline alone vanished).
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
              <div className="pointer-events-auto flex max-w-full flex-wrap justify-center bg-ink/50 px-2 py-1">
              {Array.from({ length: dotCount }, (_, dot) => (
                <button
                  key={dot}
                  type="button"
                  aria-label={fill(labels.goTo, { n: dot + 1 })}
                  aria-current={dot === activeDot ? "true" : undefined}
                  onClick={() => move(dot * Math.max(1, dotsEvery))}
                  className="inline-flex size-6 cursor-pointer items-center justify-center rounded-none border-0 bg-transparent p-0"
                >
                  <span aria-hidden="true" className={cn("block size-2 border border-ivory", dot === activeDot && "bg-ivory")} />
                </button>
              ))}
              </div>
            </div>
          ) : null}
          {autoplayAllowed && !reduced ? (
            <button
              type="button"
              aria-label={playing ? labels.pause : labels.play}
              onClick={() => {
                if (!playing) {
                  // An explicit Play wins over a pointer that is still resting on the region.
                  setHovered(false);
                  setFocused(false);
                }
                setPlaying(!playing);
              }}
              className="absolute bottom-4 end-4 z-10 inline-flex size-control cursor-pointer items-center justify-center rounded-none border-0 bg-ivory p-0 text-teal"
            >
              {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
            </button>
          ) : null}
          <p className="sr-only" aria-live={autoplaying ? "off" : "polite"}>
            {fill(labels.slide, { n: index + 1, total })}
          </p>
        </>
      ) : null}
    </section>
  );
}

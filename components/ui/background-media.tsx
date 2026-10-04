"use client";

import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";

const REDUCED = "(prefers-reduced-motion: reduce)";
const FILL = "absolute inset-0 size-full object-cover";

/**
 * A full-bleed background for a hero: the poster photo is always in the served HTML (or nothing, when the page has no
 * poster). After mount, when a video URL is set and motion is allowed, a muted, looping, inline video plays over the
 * poster. Under prefers-reduced-motion, or if the video fails, the poster stays and no video is ever added.
 * The parent is the positioned box; this fills it.
 */
export function BackgroundMedia({
  poster,
  videoUrl,
  className,
}: {
  /** A URL, or {src, alt}. A hero poster is decorative (empty alt) unless the page gives it an alt. */
  poster?: string | { src: string; alt?: string } | null;
  /** Null until the owner copies the video to the media host. The page still works without it. */
  videoUrl?: string | null;
  className?: string;
}) {
  const [motion, setMotion] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(REDUCED);
    const sync = () => setMotion(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const still = typeof poster === "string" ? { src: poster, alt: "" } : poster ? { src: poster.src, alt: poster.alt ?? "" } : null;
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {still ? <img src={still.src} alt={still.alt} decoding="async" className={FILL} /> : null}
      {videoUrl && motion && !failed ? (
        <video
          src={videoUrl}
          poster={still?.src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setFailed(true)}
          className={FILL}
        />
      ) : null}
    </div>
  );
}

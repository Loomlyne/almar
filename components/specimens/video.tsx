"use client";

import { useEffect, useRef, useState } from "react";

const SRC = "https://files.catbox.moe/v0nj1o.mp4";

export function VideoSpecimen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    const pauseIfHidden = () => {
      const rect = node.getBoundingClientRect();
      const hidden = rect.bottom <= 0 || rect.top >= window.innerHeight;
      if (hidden) {
        node.pause();
        setPlaying(false);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) pauseIfHidden();
    });
    observer.observe(node);
    node.addEventListener("play", pauseIfHidden);
    window.addEventListener("scroll", pauseIfHidden, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener("play", pauseIfHidden);
      window.removeEventListener("scroll", pauseIfHidden);
    };
  }, []);

  function toggle() {
    const node = videoRef.current;
    if (!node) return;
    if (node.paused) {
      void node.play();
      setPlaying(true);
    } else {
      node.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="video-frame">
      <video
        ref={videoRef}
        src={SRC}
        poster="/assets/img/caedcb84dd0d35bb.webp"
        muted
        playsInline
      />
      <button type="button" className="video-control" onClick={toggle}>
        {playing ? "Pause video" : "Play video"}
      </button>
    </div>
  );
}

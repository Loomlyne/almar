"use client";

import { useEffect } from "react";
import { dropOffset, fadeOpacity } from "../../lib/motion";

// Runs the reveal system (plan 41, 11-DESIGN section 3). Mounted once by PublicFrame; renders nothing.
//  - [data-reveal] elements get data-revealed once: on load for data-reveal-on="load", on entering the viewport for the rest.
//  - [data-scroll="fade"] gets opacity from the scroll; [data-scroll="drop"] gets a translate that follows the scroll.
// Nothing here runs unless the boot script set data-motion="on" on the root element (so never with reduced motion), and it sets
// data-motion-ready first so the boot script's 3 s safety reveal stands down.

const REVEAL = "[data-reveal]:not([data-revealed])";

export function MotionController() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-motion-ready", "");
    if (root.getAttribute("data-motion") !== "on") return;

    const reveal = (el: Element) => el.setAttribute("data-revealed", "");
    const frames: number[] = [];
    const later = (fn: () => void) => {
      // Two frames: the hidden state must be painted once, so the transition runs from it.
      frames.push(
        requestAnimationFrame(() => {
          frames.push(requestAnimationFrame(fn));
        }),
      );
    };

    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                reveal(entry.target);
                io?.unobserve(entry.target);
              }
            },
            { rootMargin: "0px 0px -10% 0px", threshold: 0 },
          );

    const seen = new WeakSet<Element>();
    const take = (el: Element) => {
      if (seen.has(el) || el.hasAttribute("data-revealed")) return;
      seen.add(el);
      if (!io) reveal(el);
      else if (el.getAttribute("data-reveal-on") === "load") later(() => reveal(el));
      else io.observe(el);
    };
    const scan = (scope: ParentNode) => {
      if (scope instanceof Element && scope.matches(REVEAL)) take(scope);
      scope.querySelectorAll(REVEAL).forEach(take);
    };
    scan(document);

    const mo = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Scroll effects. The drop's untransformed top is the rect top minus the offset applied now.
    const applied = new WeakMap<HTMLElement, number>();
    const update = () => {
      for (const el of document.querySelectorAll<HTMLElement>('[data-scroll="fade"]')) {
        el.style.opacity = String(fadeOpacity(window.scrollY, el.offsetHeight));
      }
      for (const el of document.querySelectorAll<HTMLElement>('[data-scroll="drop"]')) {
        const top = el.getBoundingClientRect().top - (applied.get(el) ?? 0);
        const offset = dropOffset(window.innerHeight, top, el.offsetHeight);
        applied.set(el, offset);
        el.style.translate = `0 ${offset}px`;
      }
    };
    let pending = 0;
    const schedule = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        update();
      });
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      io?.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      for (const id of frames) cancelAnimationFrame(id);
      if (pending) cancelAnimationFrame(pending);
    };
    const onMotionChange = () => {
      if (!query.matches) return;
      root.setAttribute("data-motion", "off");
      for (const el of document.querySelectorAll<HTMLElement>('[data-scroll="fade"]')) el.style.removeProperty("opacity");
      for (const el of document.querySelectorAll<HTMLElement>('[data-scroll="drop"]')) el.style.removeProperty("translate");
      stop();
    };
    query.addEventListener("change", onMotionChange);

    return () => {
      query.removeEventListener("change", onMotionChange);
      stop();
    };
  }, []);

  return null;
}

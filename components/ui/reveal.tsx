import { createElement, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import { cn } from "../../lib/cn";

// The reveal system (11-DESIGN section 3, plan 41). A page declares motion with markup only:
//   <Reveal kind="heading">...</Reveal>
// The hidden start state sits behind the `pre-reveal` variant (app/globals.css), which matches only while <html> carries
// data-motion="on" (set by the boot script, never with reduced motion) and the element has no data-revealed. With
// JavaScript off, or with reduced motion, nothing is ever hidden. MotionController sets data-revealed once.
//
// A revealed element gets no transform, so it never becomes a containing block for fixed or sticky descendants. Never wrap
// a sticky or fixed element in a Reveal: put the Reveal inside it.

export type RevealKind = "photo" | "nav" | "headline" | "bar" | "heading" | "button" | "row" | "row-sm" | "letter";

/** "load": revealed as soon as the page is ready. "view": revealed when it enters the viewport. */
export type RevealOn = "load" | "view";

const BASE = "transition ease-reveal motion-reduce:transition-none";

const KIND: Record<RevealKind, { on: RevealOn; hidden: string; duration: string; delay?: string }> = {
  photo: { on: "load", hidden: "pre-reveal:opacity-0 pre-reveal:scale-102", duration: "duration-reveal-photo", delay: "delay-200" },
  nav: { on: "load", hidden: "pre-reveal:opacity-0 pre-reveal:-translate-y-2.5", duration: "duration-reveal-nav", delay: "delay-500" },
  headline: { on: "load", hidden: "pre-reveal:opacity-0 pre-reveal:translate-y-5", duration: "duration-reveal-headline", delay: "delay-600" },
  bar: { on: "load", hidden: "pre-reveal:opacity-0 pre-reveal:translate-y-5", duration: "duration-reveal-headline", delay: "delay-1000" },
  heading: { on: "view", hidden: "pre-reveal:opacity-0 pre-reveal:translate-y-2.5", duration: "duration-reveal-heading" },
  button: { on: "view", hidden: "pre-reveal:opacity-0 pre-reveal:translate-y-5", duration: "duration-reveal-button" },
  row: { on: "view", hidden: "pre-reveal:opacity-0 pre-reveal:translate-y-10", duration: "duration-reveal-row" },
  "row-sm": { on: "view", hidden: "pre-reveal:opacity-0 pre-reveal:translate-y-5", duration: "duration-reveal-row" },
  letter: { on: "view", hidden: "pre-reveal:opacity-0 pre-reveal:translate-y-5", duration: "duration-reveal-nav" },
};

/**
 * The attributes of a revealed element, for markup that cannot be wrapped (a component with its own root). `on` defaults
 * to the kind's own timing: load for photo, nav, headline and bar, view for the rest.
 */
export function revealProps(kind: RevealKind, on?: RevealOn) {
  const spec = KIND[kind];
  const when = on ?? spec.on;
  return {
    "data-reveal": kind,
    "data-reveal-on": when === "load" ? ("load" as const) : undefined,
    className: cn(BASE, spec.duration, spec.delay, spec.hidden),
  };
}

type RevealOwnProps<T extends ElementType> = {
  kind: RevealKind;
  on?: RevealOn;
  as?: T;
  className?: string;
  children?: ReactNode;
};

export function Reveal<T extends ElementType = "div">({
  kind,
  on,
  as,
  className,
  children,
  ...rest
}: RevealOwnProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof RevealOwnProps<T>>) {
  const props = revealProps(kind, on);
  return createElement(as ?? "div", { ...rest, ...props, className: cn(props.className, className) }, children);
}

"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { SaveHeartCopy } from "../../lib/copy/saved-stays";
import { fill } from "../../lib/journey-format";
import type { Locale } from "../../lib/locale-path";
import { loadSaved, pushNotice, rememberIntent, setSaved, subscribeNotices, takeIntent, toggle, useSavedStay } from "../../lib/saved-stays/client";
import { loginHrefForSave } from "../../lib/saved-stays/rules";
import { HeartIcon } from "../icons/icons";
import { ToastProvider, useToast } from "./toast";

export type SaveStayState = "signed-out" | "off" | "on";
export type SaveStayTone = "on-image" | "on-surface";

const ROOT =
  "inline-flex min-h-control min-w-control cursor-pointer items-center justify-center gap-2 rounded-none text-label uppercase tracking-kicker no-underline ar:normal-case ar:tracking-normal";
const TONE: Record<SaveStayTone, string> = {
  "on-image": "border-0 bg-ink/45 text-ivory hover:bg-ink/60",
  "on-surface": "border border-line bg-ivory text-teal hover:bg-surface",
};
/** The stay page's Save, the word beside the heart: as signed, an ivory control with a gold line. */
const WITH_WORD = "border border-gold px-4";
/** Square, as signed; the kit's SpinnerIcon is round. */
const SPINNER: Record<SaveStayTone, string> = {
  "on-image": "border-ivory/40 border-t-ivory",
  "on-surface": "border-teal-tint border-t-teal",
};

/**
 * The heart, from props alone. Signed out it is a link, so it works without JavaScript. Otherwise a toggle button; busy it
 * shows the spinner and does nothing for that moment, keeping the keyboard's place. Outline when not saved, filled when saved.
 * `label` is its accessible name and `word` the visible text beside the heart (the stay page only).
 */
export function SaveStayView({
  state,
  tone,
  label,
  word,
  href,
  onToggle,
  onFollow,
  busy = false,
}: {
  state: SaveStayState;
  tone: SaveStayTone;
  label: string;
  word?: string;
  href?: string;
  onToggle?: () => void;
  /** The click on the signed-out link, before it navigates. */
  onFollow?: () => void;
  busy?: boolean;
}) {
  const on = state === "on";
  const className = cn(ROOT, TONE[tone], word && WITH_WORD, busy && "cursor-default");
  const body = (
    <>
      {busy ? (
        <span aria-hidden="true" className={cn("size-4 shrink-0 border-2 motion-safe:animate-spin", SPINNER[tone])} />
      ) : (
        <HeartIcon size={24} className="shrink-0" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      )}
      {word ? <span>{word}</span> : null}
    </>
  );
  if (state === "signed-out") {
    return (
      <a href={href} aria-label={label} onClick={onFollow} className={className}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" aria-label={label} aria-pressed={on} aria-busy={busy || undefined} onClick={busy ? undefined : onToggle} className={className}>
      {body}
    </button>
  );
}

/**
 * The live heart. The server HTML and the first client render are the signed-out link, so a visitor with JavaScript off still reaches
 * sign-in. Back from the sign-in link, the stay she tapped is saved once and the notice says so. `showWord` puts Save / Saved beside
 * the heart (the stay page; hearts on cards stand alone).
 */
export function SaveStayButton({
  slug,
  title,
  locale,
  tone,
  copy,
  showWord = false,
}: {
  slug: string;
  title: string;
  locale: Locale;
  tone: SaveStayTone;
  copy: SaveHeartCopy;
  showWord?: boolean;
}) {
  const { status, saved, busy } = useSavedStay(slug);

  useEffect(() => {
    void loadSaved();
  }, []);

  useEffect(() => {
    if (status !== "ready" || takeIntent(slug) !== slug) return;
    if (saved) {
      pushNotice(copy.savedNotice, "success");
      return;
    }
    void setSaved(slug, true).then((result) => {
      if (result === "ok") pushNotice(copy.savedNotice, "success");
      else if (result !== "busy") pushNotice(copy.saveFailed, "warning");
    });
    // Once per page, when the list has arrived: takeIntent deletes what it returns.
  }, [status]);

  const href = loginHrefForSave(locale, slug);
  if (!href) return null;

  const word = showWord ? (saved ? copy.saved : copy.save) : undefined;
  if (status !== "ready") {
    return <SaveStayView state="signed-out" tone={tone} label={fill(copy.signInToSave, { stay: title })} word={word} href={href} onFollow={() => rememberIntent(slug)} />;
  }

  async function onToggle() {
    const result = await toggle(slug);
    if (result === "failed" || result === "signed-out") pushNotice(copy.saveFailed, "warning");
  }

  return (
    <SaveStayView
      state={saved ? "on" : "off"}
      tone={tone}
      label={fill(saved ? copy.removeStay : copy.saveStay, { stay: title })}
      word={word}
      busy={busy}
      onToggle={onToggle}
    />
  );
}

function NoticeBridge() {
  const { push } = useToast();
  useEffect(() => subscribeNotices(push), [push]);
  return null;
}

/**
 * Shows the hearts' notices, once per page. Put it where no ancestor forms a stacking context: the toasts are fixed to the viewport.
 * Whatever it wraps may use the kit's toasts too (Copy link in the hero). `dismissLabel` names the toast's close button.
 */
export function SaveStayNotices({ dismissLabel, children }: { dismissLabel: string; children?: ReactNode }) {
  return (
    <ToastProvider dismissLabel={dismissLabel}>
      <NoticeBridge />
      {children}
    </ToastProvider>
  );
}

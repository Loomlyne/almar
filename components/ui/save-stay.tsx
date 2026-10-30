import { cn } from "../../lib/cn";
import { HeartIcon } from "../icons/icons";

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

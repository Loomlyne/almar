"use client";

import { useId, useState, type JSX } from "react";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { OPS_TRANSLATE_COPY } from "../../lib/copy/ops-translate";

/**
 * What the button shows. `idle` and `confirm` are the resting and asking states; `busy` while the two requests run;
 * the rest are the result line after a run (contract 5.11: 200 per target, 429 translate_limit, 502 translate_failed).
 */
export type TranslateView =
  | "idle"
  | "confirm"
  | "busy"
  | "done"
  | "partial-ar"
  | "partial-es"
  | "limit"
  | "failed";

type Locale = "en" | "ar" | "es";
type Source = Record<string, string | string[] | null>;

/** True when at least one English value has text (null, "" and lists of blanks are skipped). */
export function hasEnglish(source: Source): boolean {
  return Object.values(source).some((value) =>
    Array.isArray(value) ? value.some((item) => item.trim() !== "") : typeof value === "string" && value.trim() !== "",
  );
}

/**
 * The look of the Translate button for one state, with no behaviour of its own. TranslateButton drives it; the harness
 * scene (tests/journey/scenes/ops-translate.tsx) renders each state directly for the owner's pictures.
 */
export function TranslateButtonView({
  view,
  locale,
  disabled = false,
  needsEnglish = false,
  onTranslate,
  onConfirm,
  onKeep,
}: {
  view: TranslateView;
  locale: Locale;
  disabled?: boolean;
  /** Every English field is empty: the button is off and the reason is said under it. */
  needsEnglish?: boolean;
  onTranslate: () => void;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  const copy = OPS_TRANSLATE_COPY[locale];
  const hintId = useId();
  const busy = view === "busy";
  const result =
    view === "done"
      ? copy.done
      : view === "partial-ar"
        ? copy.partialArabicOnly
        : view === "partial-es"
          ? copy.partialSpanishOnly
          : view === "limit"
            ? copy.limit
            : view === "failed"
              ? copy.failed
              : "";
  const isError = view === "limit" || view === "failed";

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <Button
        variant="secondary"
        busy={busy}
        disabled={disabled || needsEnglish}
        aria-describedby={needsEnglish ? hintId : undefined}
        onClick={onTranslate}
      >
        {busy ? copy.busy : copy.action}
      </Button>
      {needsEnglish ? (
        <p id={hintId} className="m-0 text-label text-muted">
          {copy.needEnglish}
        </p>
      ) : null}
      {/* One polite live line, always in the page, so a screen reader hears each result. */}
      <p role="status" aria-live="polite" className={result ? `m-0 max-w-menu text-label text-pretty ${isError ? "text-error" : "text-ink"}` : "sr-only"}>
        {result}
      </p>
      <ConfirmDialog
        open={view === "confirm"}
        onOpenChange={(open) => {
          if (!open) onKeep();
        }}
        title={copy.confirmTitle}
        confirmLabel={copy.replace}
        cancelLabel={copy.keep}
        onConfirm={onConfirm}
      />
    </div>
  );
}

/**
 * One button "Translate to Arabic and Spanish". DRAFT (plan 03.2-10 Task 1, for the owner's pictures): the props are
 * final, the request is not wired yet. Task 2 sends two POSTs to /api/ops/translate in parallel (target ar and es)
 * through the kit client; each target that succeeds calls onDrafts, a target that fails leaves its tab unchanged and
 * the line says which one failed. Until then a click (after the replace question when AR or ES has text) does nothing.
 */
export function TranslateButton(props: {
  source: Record<string, string | string[] | null>;
  hasExisting: boolean;
  onDrafts: (target: "ar" | "es", fields: Record<string, string | string[]>) => void;
  locale: "en" | "ar" | "es";
  disabled?: boolean;
}): JSX.Element {
  const { source, hasExisting, locale, disabled } = props;
  const [view, setView] = useState<TranslateView>("idle");

  function run() {
    // Task 2: the two requests, then onDrafts per target that succeeded and the matching result view.
    setView("idle");
  }

  return (
    <TranslateButtonView
      view={view}
      locale={locale}
      disabled={disabled}
      needsEnglish={!hasEnglish(source)}
      onTranslate={() => (hasExisting ? setView("confirm") : run())}
      onConfirm={run}
      onKeep={() => setView("idle")}
    />
  );
}

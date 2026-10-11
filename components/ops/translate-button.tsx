"use client";

import { useEffect, useId, useRef, useState, type JSX } from "react";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { OPS_TRANSLATE_COPY } from "../../lib/copy/ops-translate";
import { opsSend, type OpsResponse } from "./ops-client";

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

type Target = "ar" | "es";
type Drafts = Record<string, string | string[]>;
type TranslateReply = { target: Target; fields: Drafts };

/**
 * What is sent: strings with text, and lists whose every item has text (a list's length is the contract the answer
 * must keep, so a list with a blank item is left for the owner). The route applies the same rule server side.
 */
export function sendable(source: Source): Drafts {
  const out: Drafts = {};
  for (const [name, value] of Object.entries(source)) {
    if (typeof value === "string" && value.trim() !== "") out[name] = value;
    else if (Array.isArray(value) && value.length > 0 && value.every((item) => item.trim() !== "")) out[name] = value;
  }
  return out;
}

/** The result line from the two answers: both ok, one ok, the daily limit on either, or nothing. */
export function outcomeView(ar: OpsResponse<TranslateReply> | null, es: OpsResponse<TranslateReply> | null): TranslateView {
  const limited = [ar, es].some((r) => r !== null && !r.ok && r.status === 429 && r.error.code === "translate_limit");
  if (limited) return "limit";
  const arOk = ar?.ok === true;
  const esOk = es?.ok === true;
  if (arOk && esOk) return "done";
  if (arOk) return "partial-ar";
  if (esOk) return "partial-es";
  return "failed";
}

/**
 * One button "Translate to Arabic and Spanish". Two POSTs to /api/ops/translate run in parallel (target ar and es)
 * through the kit client (components/ops/ops-client.ts: owner redirect on 403 not_owner, network errors as status 0).
 * Each target that succeeds calls onDrafts (the screen sets that tab to draft); a target that fails leaves its tab
 * unchanged and the line says which one failed. It never writes AR or ES itself. When AR or ES already has text, the
 * replace question comes first.
 *
 * The English is snapshotted at the click. If it changed before the answers came back, or the button is gone, the
 * answers are dropped: no onDrafts call (a draft of old English must not land), and the failed line ("type it or try
 * again") when still on screen.
 */
export function TranslateButton(props: {
  source: Record<string, string | string[] | null>;
  hasExisting: boolean;
  onDrafts: (target: "ar" | "es", fields: Record<string, string | string[]>) => void;
  locale: "en" | "ar" | "es";
  disabled?: boolean;
}): JSX.Element {
  const { source, hasExisting, onDrafts, locale, disabled } = props;
  const [view, setView] = useState<TranslateView>("idle");
  // The latest English, read when the answers come back, and whether the button is still on screen.
  const sourceRef = useRef(source);
  const mounted = useRef(true);
  const snapshot = useRef<Source>(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function run(clicked: Source) {
    const fields = sendable(clicked);
    if (Object.keys(fields).length === 0) {
      setView("failed");
      return;
    }
    setView("busy");
    let next: TranslateView = "failed";
    try {
      const targets: Target[] = ["ar", "es"];
      const settled = await Promise.allSettled(
        targets.map((target) => opsSend<TranslateReply>("/api/ops/translate", { target, fields })),
      );
      if (!mounted.current || JSON.stringify(sourceRef.current) !== JSON.stringify(clicked)) return;
      const [ar, es] = settled.map((s) => (s.status === "fulfilled" ? s.value : null));
      for (const [i, answer] of [ar, es].entries()) {
        if (answer?.ok) onDrafts(targets[i], answer.fields);
      }
      next = outcomeView(ar, es);
    } finally {
      // The busy state always ends, even when onDrafts throws.
      if (mounted.current) setView(next);
    }
  }

  return (
    <TranslateButtonView
      view={view}
      locale={locale}
      disabled={disabled}
      needsEnglish={!hasEnglish(source)}
      onTranslate={() => {
        snapshot.current = source;
        if (hasExisting) setView("confirm");
        else void run(source);
      }}
      onConfirm={() => void run(snapshot.current)}
      onKeep={() => setView("idle")}
    />
  );
}

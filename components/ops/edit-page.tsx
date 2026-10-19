"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronIcon } from "../icons/icons";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Field } from "../ui/field";
import { cn } from "../../lib/cn";
import { OPS_KIT_COPY, type OpsKitCopy } from "../../lib/copy/ops-kit";
import type { Locale3, OpsError, PublishWarningCode } from "./api-types";
import { controlName } from "./control-name";
import { missingLine } from "./error-text";
import {
  TARGETS,
  applyReplies,
  blankLive,
  emptiedLive,
  pendingFields,
  planTranslation,
  plansAnything,
  requestTranslations,
  touchKey,
  type FailReason,
  type Fields,
  type FieldValue,
  type LiveFields,
  type LiveGap,
  type Send,
  type Target,
} from "./auto-translate";
import { opsSend } from "./ops-client";
import { PublishBar } from "./publish-bar";
import type { MissingItem } from "./publish-check";
import { StatusChip } from "./status-chip";
import { useDashboardLocale } from "./use-dashboard-locale";

/** One card of the page. `main` is the wide column at desktop width, `side` the narrow one; a phone has one column. */
export type EditSection = {
  key: string;
  title: string;
  column?: "main" | "side";
  /** The card holding the English text: it says "Write in English" and carries the Edit translations link. */
  translatable?: boolean;
  /**
   * Optional: this card's name in the Edit translations link's accessible name ("Edit translations, Text"), for a page
   * that shows another control with the same words (a stay's Access card). The visible words do not change.
   */
  translationsName?: string;
  content: ReactNode;
};

/** A field the AI translates: its name (the route's field name) and how its Arabic and Spanish boxes are drawn. */
export type TranslatableField = { name: string; label: string; multiline?: boolean; maxLength?: number };

/** What Save hands the screen: every Arabic and Spanish value after this Save, and whether every one came back. */
export type SavePayload = { translations: Record<Target, Fields>; complete: boolean };

/** `publish`: the owner pressed Publish with unsaved work, so the screen saves and publishes in one go. */
export type SaveIntent = "save" | "publish";

type Result = { kind: "updated" } | { kind: "failed"; reason: FailReason; live: boolean } | null;
type Saved = "complete" | "incomplete" | "not-saved";
/** What the "Discard changes?" question answers for: the back link or Escape, a link elsewhere, the browser's Back. */
type Leaving = "close" | "link" | "back";

function failText(copy: OpsKitCopy, reason: FailReason, live: boolean): string {
  if (live) return copy.editor.translationFailedLive;
  if (reason === "limit") return copy.editor.translationLimit;
  if (reason === "busy") return copy.editor.translationBusy;
  return copy.editor.translationFailed;
}

const asText = (value: FieldValue | undefined) => (Array.isArray(value) ? value.join("\n") : (value ?? ""));

/** The same gap in two lists. */
const sameGap = (a: LiveGap, b: LiveGap) => a.locale === b.locale && a.field === b.field;

/**
 * A plain left click on a link to another page of this site, which the browser or the router would follow: the one the
 * guard asks about. A new tab, a download, another site (the browser's own question covers it) and a link to this same
 * page are left alone.
 */
function leavingLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  const to = new URL(anchor.href, window.location.href);
  if (to.origin !== window.location.origin) return null;
  // This same page (a jump, or the rail's link to the list itself): nothing is left.
  if (to.pathname === window.location.pathname && to.search === window.location.search) return null;
  return anchor;
}

/**
 * Where the Back guard's extra history entry is, kept for this tab: a reload while it is up lands on it, and the next
 * clean load takes it away again (otherwise Back would stay on the same page once).
 */
const TRAP_KEY = "almar:edit-trap";

function markTrap(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(TRAP_KEY, JSON.stringify({ href: window.location.href, length: window.history.length }));
    else window.sessionStorage.removeItem(TRAP_KEY);
  } catch {
    // No session storage (a locked-down browser): a reload may leave one extra Back step, nothing worse.
  }
}

/** True once per load when this entry is a Back guard left by a reload while the form had unsaved changes. */
function onLeftTrap(): boolean {
  try {
    const raw = window.sessionStorage.getItem(TRAP_KEY);
    if (raw === null) return false;
    window.sessionStorage.removeItem(TRAP_KEY);
    const mark = JSON.parse(raw) as { href?: unknown; length?: unknown };
    return mark.href === window.location.href && mark.length === window.history.length;
  } catch {
    return false;
  }
}

/** A dialog or a popup is open over the page: its own Escape wins. */
const overlayOpen = () => document.querySelector('[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]') !== null;

/**
 * The one editor of the dashboard (kit panel B, owner 2026-10-14): a full page that replaces the list, with a back link
 * to it. The top bar holds the title, the status, Save (outlined) and Publish (teal); sections are cards in two columns
 * at desktop width (the screen says which column each goes in), one column on a phone; Delete is a link.
 *
 * Translation is automatic: the screen's fields are English only. On Save the page asks the translate route for the
 * Arabic and Spanish of the English that changed (or has none yet), hands them to `onSave`, and says "Arabic and Spanish
 * updated". If the AI fails, the gaps are saved empty, Publish waits and an alert says why; on a published item nothing
 * is saved. "Edit translations" opens the Arabic and Spanish boxes for a fix; a box typed in is left alone by the AI.
 *
 * The list stays mounted (hidden) while the page is open, so its search and scroll survive, and focus returns to the
 * row that opened the page. Escape and the back link close it; with unsaved changes they ask "Discard changes?" first,
 * and so do a link elsewhere in the dashboard (the rail) and the browser's Back; the browser asks before the tab is left.
 *
 * A published Arabic or Spanish text (`liveTranslations`) is never lost by accident: a Save that would leave one empty
 * by hand asks first, and a failed translation that would empty one saves nothing. An item in use (`holdOnFailure`)
 * saves nothing on a failed translation either.
 */
export function EditPage({
  openKey,
  list,
  backLabel,
  onClose,
  title,
  isNew = false,
  isPublished,
  dirty,
  busy = false,
  missing,
  warnings = [],
  error,
  fieldLabel,
  english,
  savedEnglish,
  translations,
  translationFields,
  onTranslationChange,
  onSave,
  onPublish,
  onUnpublish,
  onDelete,
  deleteLabel,
  deleteDisabled = false,
  deleteNote,
  notice,
  sections,
  canSave = true,
  liveTranslations = {},
  holdOnFailure = false,
  send = opsSend,
}: {
  /** The open item's id, or null for the list. A new key starts the page afresh. */
  openKey: string | null;
  list: ReactNode;
  /** The list's name: the back link says it. */
  backLabel: string;
  onClose: () => void;
  title: string;
  isNew?: boolean;
  isPublished: boolean;
  dirty: boolean;
  busy?: boolean;
  missing: MissingItem[];
  warnings?: PublishWarningCode[];
  error: OpsError | null;
  fieldLabel?: (field: string) => string | undefined;
  /** The English values of the translated fields, as typed, and as last saved. */
  english: Fields;
  savedEnglish: Fields;
  translations: Record<Target, Fields>;
  translationFields: TranslatableField[];
  onTranslationChange: (target: Target, name: string, value: string | string[]) => void;
  /** Saves (and on `publish`, publishes); resolves true when the server took it. */
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  /** Publish with nothing to save. Absent on a screen with no publish step. */
  onPublish?: () => void | Promise<unknown>;
  onUnpublish?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
  /** Said under Delete (why it is off, or what it does). A published item says "Unpublish first". */
  deleteNote?: string;
  /** A line of the screen's own under the bar, such as a refusal. */
  notice?: ReactNode;
  sections: EditSection[];
  /** False while the screen's own required fields cannot be saved (e.g. the English alt text is empty). */
  canSave?: boolean;
  /** The Arabic and Spanish fields published on the site now (an item can be live in one language and not the other). */
  liveTranslations?: LiveFields;
  /** The item is used on the site (a photo on a page): a failed translation saves nothing, as on a published item. */
  holdOnFailure?: boolean;
  /** Test seam: the translate request (opsSend by default). */
  send?: Send;
}) {
  const locale = useDashboardLocale();
  const copy = OPS_KIT_COPY[locale];
  const open = openKey !== null;
  const idBase = useId();
  const alertId = `${idBase}-translation`;
  const deleteNoteId = `${idBase}-delete-note`;
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const scrollY = useRef(0);
  const wasOpen = useRef(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const mounted = useRef(true);
  const englishNow = useRef(english);
  englishNow.current = english;

  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [phase, setPhase] = useState<"idle" | "translating" | "saving">("idle");
  const [result, setResult] = useState<Result>(null);
  const [showTranslations, setShowTranslations] = useState(false);
  const [asking, setAsking] = useState<Leaving | null>(null);
  const [emptying, setEmptying] = useState<{ intent: SaveIntent; gaps: LiveGap[] } | null>(null);
  // The link a "Discard changes?" waits on, and a pass for it once Discard is pressed.
  const leavingTo = useRef<HTMLAnchorElement | null>(null);
  const letGo = useRef(false);
  // Puts the Back guard on again after Keep editing (set while the guard is up).
  const guardAgain = useRef<(() => void) | null>(null);
  // Takes the Back guard's entry away, then runs `then` (set while the guard is up).
  const dropGuard = useRef<((then: () => void) => void) | null>(null);

  // A clean load on the Back guard's entry (the page was reloaded with unsaved changes): step off it once.
  useEffect(() => {
    if (onLeftTrap()) window.history.back();
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Opening: remember where the owner was, start clean, show the top of the page and put focus on its title.
  // Closing: the list is back; return to the same scroll and to the row that opened the page.
  useLayoutEffect(() => {
    if (open) {
      if (!wasOpen.current) {
        const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
        opener.current = active ?? lastFocus.current;
        scrollY.current = window.scrollY;
      }
      setTouched(new Set());
      setResult(null);
      setShowTranslations(false);
      setAsking(null);
      setEmptying(null);
      window.scrollTo(0, 0);
      heading.current?.focus();
    } else if (wasOpen.current) {
      window.scrollTo(0, scrollY.current);
      // After a "Discard changes?" question the dialog hands focus back on its own (a timer after unmount): return to
      // the row once that has run.
      // A row that is gone (a deleted item) hands focus to the list's heading instead of dropping it.
      const row = opener.current;
      requestAnimationFrame(() =>
        window.setTimeout(() => {
          if (row?.isConnected && row.offsetParent !== null) row.focus();
          else {
            const title = document.querySelector<HTMLElement>("h1");
            if (title) {
              if (!title.hasAttribute("tabindex")) title.tabIndex = -1;
              title.focus();
            }
          }
        }, 0),
      );
    }
    wasOpen.current = open;
  }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = planTranslation(english, savedEnglish, translations, touched);
  const pending = pendingFields(plan);
  const savePending = plansAnything(plan) || TARGETS.some((target) => plan.clear[target].length > 0);
  // An Arabic or Spanish gap the next Save fills is not Maria's to fill: Publish saves first and fills it.
  const gaps = missing.filter((item) => !(item.locale === "ar" || item.locale === "es") || !pending[item.locale].has(item.field));
  const working = busy || phase !== "idle";
  const failed = result?.kind === "failed" ? result : null;

  function requestClose() {
    if (working) return;
    if (dirty) setAsking("close");
    else onClose();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || overlayOpen()) return;
      requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // While the list shows, remember the last thing focused in it: the row a click or Enter opens the page from.
  useEffect(() => {
    if (open) return;
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) lastFocus.current = event.target;
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [open]);

  // Unsaved changes: a link elsewhere (the rail) and the browser's Back ask "Discard changes?" too. Back is caught with
  // one extra history entry for this same address: Back lands on it (nothing moves) and the question is asked; Keep
  // editing puts the entry back, Discard goes on back. The entry is taken away again once the changes are saved, before a
  // confirmed link is followed, and on the next load after a reload with unsaved changes.
  useEffect(() => {
    if (!open || !dirty) return;
    const onClick = (event: MouseEvent) => {
      if (letGo.current) return;
      const anchor = leavingLink(event);
      if (!anchor) return;
      event.preventDefault();
      event.stopPropagation();
      leavingTo.current = anchor;
      setAsking("link");
    };
    const here = window.location.href;
    let guarded = true;
    let afterPop: (() => void) | null = null;
    window.history.pushState(window.history.state, "", here);
    markTrap(true);
    const onPop = () => {
      if (letGo.current) {
        letGo.current = false;
        const next = afterPop;
        afterPop = null;
        if (next) {
          // The guard entry is gone: follow the link with the guard stood down.
          letGo.current = true;
          next();
          window.setTimeout(() => {
            letGo.current = false;
          }, 0);
        }
        return;
      }
      if (!guarded) return;
      guarded = false;
      markTrap(false);
      setAsking("back");
    };
    guardAgain.current = () => {
      if (guarded) return;
      guarded = true;
      window.history.pushState(window.history.state, "", window.location.href);
      markTrap(true);
    };
    dropGuard.current = (then) => {
      if (!guarded) {
        then();
        return;
      }
      guarded = false;
      markTrap(false);
      afterPop = then;
      letGo.current = true;
      window.history.back();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      guardAgain.current = null;
      dropGuard.current = null;
      // Saved or closed here: drop the extra entry. Gone elsewhere (a link was followed): leave history as it is.
      if (guarded && !letGo.current && window.location.href === here) {
        markTrap(false);
        window.history.back();
      }
    };
  }, [open, dirty]);

  useEffect(() => {
    if (!open || !dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [open, dirty]);

  async function save(intent: SaveIntent, emptyConfirmed = false): Promise<Saved> {
    if (working) return "not-saved";
    // A published Arabic or Spanish text left empty by hand: ask before the site loses it.
    const meant = emptiedLive(liveTranslations, translations, plan);
    if (meant.length > 0 && !emptyConfirmed) {
      setEmptying({ intent, gaps: meant });
      return "not-saved";
    }
    let payload: SavePayload = { translations, complete: true };
    let asked = false;
    let reason: FailReason = "failed";
    if (savePending) {
      let replies: Parameters<typeof applyReplies>[2] = { ar: null, es: null };
      if (plansAnything(plan)) {
        setPhase("translating");
        const sent = JSON.stringify(english);
        replies = await requestTranslations(plan, send);
        if (!mounted.current) return "not-saved";
        // The English changed while the AI worked: its answer is of old text. Nothing is saved; Save again.
        if (JSON.stringify(englishNow.current) !== sent) {
          setPhase("idle");
          return "not-saved";
        }
      }
      const limits = Object.fromEntries(translationFields.map((field) => [field.name, field.maxLength]));
      const outcome = applyReplies(plan, translations, replies, limits);
      asked = outcome.asked;
      reason = outcome.reason ?? "failed";
      payload = { translations: outcome.translations, complete: outcome.complete };
      // A published text the AI failed to replace would go empty (not one she chose to empty).
      const lost = blankLive(liveTranslations, outcome.translations).some((gap) => !meant.some((one) => sameGap(one, gap)));
      if (!outcome.complete && (isPublished || holdOnFailure || lost)) {
        // A live or used item is never saved with a hole in it: the site keeps what it has.
        setPhase("idle");
        setResult({ kind: "failed", reason, live: true });
        return "not-saved";
      }
      if (!outcome.complete) intent = "save";
    }
    setPhase("saving");
    const ok = await onSave(payload, intent);
    if (!mounted.current) return ok ? (payload.complete ? "complete" : "incomplete") : "not-saved";
    setPhase("idle");
    if (!ok) return "not-saved";
    setTouched(new Set());
    if (!payload.complete) {
      setResult({ kind: "failed", reason, live: false });
      return "incomplete";
    }
    setResult(asked ? { kind: "updated" } : null);
    return "complete";
  }

  async function publish() {
    if (working || failed) return;
    if (isNew || dirty || savePending) {
      await save("publish");
      return;
    }
    await onPublish?.();
  }

  const statusLine =
    phase === "translating"
      ? copy.editor.translating
      : dirty
        ? copy.editor.unsaved
        : result?.kind === "updated"
          ? copy.editor.translationsUpdated
          : "";

  const main = sections.filter((section) => (section.column ?? "main") === "main");
  const side = sections.filter((section) => section.column === "side");
  const translatableKey = (sections.find((section) => section.translatable) ?? main[0] ?? sections[0])?.key;

  const deleteLink = onDelete && !isNew ? (
    <div className="flex flex-col items-start gap-1 border-t border-line pt-4">
      <button
        type="button"
        disabled={working || deleteDisabled || isPublished}
        aria-describedby={deleteNote || isPublished ? deleteNoteId : undefined}
        onClick={onDelete}
        className="inline-flex min-h-control cursor-pointer items-center border-0 bg-transparent p-0 font-body text-label text-error underline decoration-1 underline-offset-4 disabled:cursor-default disabled:text-muted disabled:no-underline"
      >
        {deleteLabel ?? copy.delete}
      </button>
      {deleteNote || isPublished ? (
        <p id={deleteNoteId} className="m-0 text-label text-muted">
          {isPublished ? copy.unpublishFirst : deleteNote}
        </p>
      ) : null}
    </div>
  ) : null;

  function card(section: EditSection) {
    const headingId = `${idBase}-${section.key}`;
    const withTranslations = section.key === translatableKey && translationFields.length > 0;
    return (
      <section key={section.key} aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4 border border-line bg-surface p-4 md:p-6">
        <h2 id={headingId} className="m-0 text-balance font-display text-title font-normal text-teal">
          {section.title}
        </h2>
        {withTranslations ? <p className="m-0 text-label text-muted">{copy.editor.englishOnly}</p> : null}
        {section.content}
        {withTranslations ? (
          <TranslationBoxes
            idBase={idBase}
            copy={copy}
            locale={locale}
            name={section.translationsName}
            open={showTranslations}
            onToggle={() => setShowTranslations((was) => !was)}
            fields={translationFields}
            values={translations}
            disabled={working}
            onChange={(target, name, value) => {
              setTouched((was) => new Set(was).add(touchKey(target, name)));
              onTranslationChange(target, name, value);
            }}
          />
        ) : null}
      </section>
    );
  }

  return (
    <>
      <div hidden={open}>{list}</div>
      {open ? (
        <div data-edit-page="" className="flex min-w-0 flex-col gap-6">
          <div className="flex min-w-0 flex-col gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="inline-flex min-h-control w-max cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-body text-label text-teal underline decoration-gold decoration-1 underline-offset-4"
            >
              <ChevronIcon size={16} className="rotate-180 rtl:rotate-0" aria-hidden="true" />
              {backLabel}
            </button>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
              <div className="flex min-w-0 flex-col gap-2">
                <h1 ref={heading} tabIndex={-1} className="m-0 text-balance break-words font-display text-heading font-normal text-teal outline-none">
                  {title}
                </h1>
                <span className="inline-flex flex-wrap items-center gap-3">
                  {isNew ? null : <StatusChip published={isPublished} locale={locale} />}
                  <span role="status" className={statusLine ? "inline-flex items-center gap-2 text-label text-ink" : "sr-only"}>
                    {result?.kind === "updated" && phase === "idle" && !dirty ? <CheckIcon size={16} className="text-teal" aria-hidden="true" /> : null}
                    {statusLine}
                  </span>
                </span>
              </div>
              <PublishBar
                part="actions"
                idBase={idBase}
                isNew={isNew}
                isPublished={isPublished}
                dirty={dirty}
                busy={working}
                saveBlocked={!canSave}
                missing={gaps}
                warnings={warnings}
                error={error}
                fieldLabel={fieldLabel}
                savePending={savePending}
                translationAlertId={failed ? alertId : undefined}
                onSave={() => void save("save")}
                onPublish={onPublish ? () => void publish() : undefined}
                onUnpublish={onUnpublish}
              />
            </div>
            {failed ? (
              <div className="border border-line bg-surface p-4">
                <p id={alertId} role="alert" className="m-0 max-w-prose border-s-2 border-error ps-2 text-label text-ink">
                  {failText(copy, failed.reason, failed.live)}
                </p>
              </div>
            ) : null}
            <PublishBar
              part="notes"
              idBase={idBase}
              isNew={isNew}
              isPublished={isPublished}
              dirty={dirty}
              busy={working}
              missing={gaps}
              warnings={warnings}
              error={error}
              fieldLabel={fieldLabel}
              onSave={() => undefined}
            />
            {notice}
          </div>
          {/* Every field rests while a Save runs: what she types then would be lost under the reply. */}
          <fieldset disabled={working} className={cn("m-0 grid min-w-0 items-start gap-6 border-0 p-0", side.length > 0 && "lg:grid-cols-3")}>
            <div className={cn("flex min-w-0 flex-col gap-6", side.length > 0 && "lg:col-span-2")}>
              {main.map(card)}
              {side.length === 0 ? deleteLink : null}
            </div>
            {side.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-6">
                {side.map(card)}
                {deleteLink}
              </div>
            ) : null}
          </fieldset>
        </div>
      ) : null}
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(stay) => {
          if (stay) return;
          // Keep editing after Back: the guard entry goes back on, so the next Back asks again.
          if (asking === "back") guardAgain.current?.();
          setAsking(null);
        }}
        title={copy.discardTitle}
        confirmLabel={copy.discard}
        cancelLabel={copy.keepEditing}
        onConfirm={() => {
          const why = asking;
          setAsking(null);
          if (why === "close") onClose();
          else if (why === "link") {
            // Back off the guard entry first, so it does not stay under the new page; then follow the link.
            const anchor = leavingTo.current;
            const follow = () => anchor?.click();
            if (dropGuard.current) dropGuard.current(follow);
            else {
              letGo.current = true;
              follow();
              window.setTimeout(() => {
                letGo.current = false;
              }, 0);
            }
          } else if (why === "back") {
            letGo.current = true;
            window.history.back();
          }
        }}
      />
      <ConfirmDialog
        open={emptying !== null}
        onOpenChange={(stay) => {
          if (!stay) setEmptying(null);
        }}
        title={copy.editor.emptyLiveTitle}
        description={
          emptying
            ? `${copy.editor.emptyLiveText} ${emptying.gaps.map((gap) => missingLine(copy, gap, fieldLabel)).join(", ")}.`
            : undefined
        }
        confirmLabel={copy.editor.saveEmpty}
        cancelLabel={copy.keepEditing}
        onConfirm={() => {
          const intent = emptying?.intent ?? "save";
          setEmptying(null);
          void save(intent, true);
        }}
      />
    </>
  );
}

/** The Edit translations link and, when open, one block per language with a box per translated field. */
function TranslationBoxes({
  idBase,
  copy,
  locale,
  name,
  open,
  onToggle,
  fields,
  values,
  disabled,
  onChange,
}: {
  idBase: string;
  copy: OpsKitCopy;
  locale: Locale3;
  /** The card's name, added to the link's accessible name after its visible words (EditSection.translationsName). */
  name?: string;
  open: boolean;
  onToggle: () => void;
  fields: TranslatableField[];
  values: Record<Target, Fields>;
  disabled: boolean;
  onChange: (target: Target, name: string, value: string | string[]) => void;
}) {
  const regionId = `${idBase}-translations`;
  const words = open ? copy.editor.hideTranslations : copy.editor.editTranslations;
  return (
    <div className="flex min-w-0 flex-col items-start gap-4">
      <button
        type="button"
        aria-label={name ? controlName(locale, words, name) : undefined}
        aria-expanded={open}
        aria-controls={open ? regionId : undefined}
        onClick={onToggle}
        className="inline-flex min-h-control cursor-pointer items-center gap-2 border-0 bg-transparent p-0 font-body text-label text-teal underline decoration-gold decoration-1 underline-offset-4"
      >
        <ChevronIcon size={16} className={open ? "-rotate-90" : "rotate-90"} aria-hidden="true" />
        {words}
      </button>
      {open ? (
        <div id={regionId} className="flex w-full min-w-0 flex-col gap-4">
          <p className="m-0 text-label text-muted">{copy.editor.translationsNote}</p>
          <fieldset disabled={disabled} className="m-0 grid min-w-0 gap-4 border-0 p-0 md:grid-cols-2">
            {TARGETS.map((target) => (
              <div key={target} lang={target} dir={target === "ar" ? "rtl" : "ltr"} className="flex min-w-0 flex-col gap-4 border border-line bg-surface p-4">
                <h3 className="m-0 text-label font-normal text-muted">{copy.languages[target]}</h3>
                {fields.map((field) => {
                  const id = `${idBase}-${target}-${field.name}`;
                  const label = `${field.label} · ${target.toUpperCase()}`;
                  const current = values[target][field.name];
                  const list = Array.isArray(current);
                  const change = (text: string) => onChange(target, field.name, list ? text.split("\n") : text);
                  return field.multiline || list ? (
                    <Field
                      key={field.name}
                      id={id}
                      label={label}
                      className="max-w-none"
                      multiline
                      rows={4}
                      maxLength={field.maxLength}
                      value={asText(current)}
                      onChange={(event) => change(event.target.value)}
                    />
                  ) : (
                    <Field
                      key={field.name}
                      id={id}
                      label={label}
                      className="max-w-none"
                      autoComplete="off"
                      maxLength={field.maxLength}
                      value={asText(current)}
                      onChange={(event) => change(event.target.value)}
                    />
                  );
                })}
              </div>
            ))}
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}

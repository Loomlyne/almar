"use client";

import { useId } from "react";
import { Button } from "../ui/button";
import { OPS_KIT_COPY } from "../../lib/copy/ops-kit";
import type { OpsError, PublishWarningCode } from "./api-types";
import { errorText, missingFromError, missingLine } from "./error-text";
import type { MissingItem } from "./publish-check";
import { useDashboardLocale } from "./use-dashboard-locale";

/**
 * The actions of the editor page's top bar (kit panel B, research 4.5). An unpublished item has Save (outlined) and
 * Publish (teal); a published one has Save and update site (content is baked at build, so a save on a live item changes
 * the site) and, when the screen has one, Unpublish. Publish is disabled while anything is missing (the gaps are listed
 * in words), after a 409 publish_incomplete (the server's list, same words), and while a translation did not finish
 * (`translationAlertId` names the alert that says why). `part` splits the bar: the editor draws the buttons beside the
 * title and the notes under the bar; `all` (the default) draws both, notes first.
 */
export function PublishBar({
  isNew,
  isPublished,
  dirty,
  busy,
  missing,
  warnings,
  onSave,
  onPublish,
  onUnpublish,
  error,
  fieldLabel,
  savePending = false,
  translationAlertId,
  idBase,
  part = "all",
}: {
  isNew: boolean;
  isPublished: boolean;
  dirty: boolean;
  busy: boolean;
  missing: MissingItem[];
  warnings: PublishWarningCode[];
  onSave: () => void;
  /** Absent on a screen with no publish step: Save is then the one teal button. */
  onPublish?: () => void;
  onUnpublish?: () => void;
  error: OpsError | null;
  /** A screen's own words for a field name (its labels), when they differ from the kit's. */
  fieldLabel?: (field: string) => string | undefined;
  /** Save has work with nothing edited (a translation to try again): it stays live. */
  savePending?: boolean;
  /** The id of the alert saying the translation did not finish; while set, Publish waits and names it. */
  translationAlertId?: string;
  /** Shared by the two parts, so a button in one names a note in the other. */
  idBase?: string;
  part?: "all" | "actions" | "notes";
}) {
  const copy = OPS_KIT_COPY[useDashboardLocale()];
  const ownId = useId();
  const base = idBase ?? ownId;
  const gapsId = `${base}-gaps`;
  const alertId = `${base}-alert`;
  const fromServer = missingFromError(error);
  const gaps = fromServer ?? (isPublished ? [] : missing);
  const blocked = missing.length > 0 || fromServer !== null || translationAlertId !== undefined;
  // A 409 publish_incomplete whose list is absent or empty still says why, in its own sentence.
  const showAlert = error !== null && (fromServer === null || fromServer.length === 0);
  // What a disabled Publish waits for, so a screen reader hears the reason with the button.
  const publishReason = blocked
    ? gaps.length > 0
      ? gapsId
      : showAlert
        ? alertId
        : translationAlertId
    : undefined;
  const canSave = !busy && (isNew || dirty || savePending);

  const notes =
    gaps.length > 0 || warnings.length > 0 || showAlert ? (
      <div className="flex min-w-0 flex-col gap-2">
        {gaps.length > 0 ? (
          <div id={gapsId} className="flex flex-col gap-1 border-s border-gold ps-2">
            <p className="m-0 text-label text-ink">{copy.publishNeeds}</p>
            <ul className="m-0 flex list-none flex-col p-0 text-label text-ink">
              {gaps.map((item) => (
                <li key={`${item.locale ?? "any"}-${item.field}`}>{missingLine(copy, item, fieldLabel)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {warnings.map((code) => (
          <p key={code} role="status" className="m-0 border-s border-gold ps-2 text-label text-ink">
            {code === "no_base_rate" ? copy.warnNoBaseRate : copy.warnNoPrice}
          </p>
        ))}
        {showAlert && error ? (
          <p id={alertId} role="alert" className="m-0 text-label text-error">
            {errorText(copy, error, fieldLabel)}
          </p>
        ) : null}
      </div>
    ) : null;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {isPublished ? (
        <>
          {onUnpublish ? (
            <Button variant="secondary" disabled={busy} onClick={onUnpublish}>
              {copy.unpublish}
            </Button>
          ) : null}
          <Button busy={busy} disabled={!canSave} onClick={onSave}>
            {copy.saveAndUpdateSite}
          </Button>
        </>
      ) : onPublish ? (
        <>
          <Button variant="secondary" busy={busy} disabled={!canSave} onClick={onSave}>
            {copy.save}
          </Button>
          <Button disabled={busy || blocked} aria-describedby={publishReason} onClick={onPublish}>
            {copy.publish}
          </Button>
        </>
      ) : (
        <Button busy={busy} disabled={!canSave} onClick={onSave}>
          {copy.save}
        </Button>
      )}
    </div>
  );

  if (part === "actions") return actions;
  if (part === "notes") return notes;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {notes}
      {actions}
    </div>
  );
}

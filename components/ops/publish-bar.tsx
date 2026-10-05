"use client";

import { useId } from "react";
import { Button } from "../ui/button";
import { OPS_KIT_COPY } from "../../lib/copy/ops-kit";
import type { OpsError, PublishWarningCode } from "./api-types";
import { errorText, missingFromError, missingLine } from "./error-text";
import type { MissingItem } from "./publish-check";
import { useDashboardLocale } from "./use-dashboard-locale";

/**
 * The action row of an edit panel (research 4.5). An unpublished item has Save and Publish; a published one has
 * Save and update site (content is baked at build, so a save on a live item changes the site) and Unpublish. Publish
 * is disabled while anything is missing and the gaps are listed in words. A 409 publish_incomplete from the server is
 * shown through the same list. Delete exists only when `onDelete` is given, and waits for Unpublish.
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
  onDelete,
  deleteLabel,
  error,
  fieldLabel,
}: {
  isNew: boolean;
  isPublished: boolean;
  dirty: boolean;
  busy: boolean;
  missing: MissingItem[];
  warnings: PublishWarningCode[];
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  error: OpsError | null;
  /** A screen's own words for a field name (its labels), when they differ from the kit's. */
  fieldLabel?: (field: string) => string | undefined;
}) {
  const copy = OPS_KIT_COPY[useDashboardLocale()];
  const hintId = useId();
  const gapsId = useId();
  const alertId = useId();
  const fromServer = missingFromError(error);
  const gaps = fromServer ?? (isPublished ? [] : missing);
  const blocked = missing.length > 0 || fromServer !== null;
  // A 409 publish_incomplete whose list is absent or empty still says why, in its own sentence.
  const showAlert = error !== null && (fromServer === null || fromServer.length === 0);
  // What a disabled Publish waits for, so a screen reader hears the reason with the button.
  const publishReason = blocked ? (gaps.length > 0 ? gapsId : showAlert ? alertId : undefined) : undefined;
  const showDelete = Boolean(onDelete) && !isNew;

  return (
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
      <div className="flex flex-wrap items-center gap-2">
        {isPublished ? (
          <>
            <Button disabled={busy || !dirty} onClick={onSave}>
              {copy.saveAndUpdateSite}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={onUnpublish}>
              {copy.unpublish}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" disabled={busy || (!isNew && !dirty)} onClick={onSave}>
              {copy.save}
            </Button>
            <Button disabled={busy || blocked} aria-describedby={publishReason} onClick={onPublish}>
              {copy.publish}
            </Button>
          </>
        )}
        {showDelete ? (
          <>
            <Button
              variant="danger"
              disabled={busy || isPublished}
              aria-describedby={isPublished ? hintId : undefined}
              onClick={onDelete}
            >
              {deleteLabel ?? copy.delete}
            </Button>
            {isPublished ? (
              <span id={hintId} className="text-label text-muted">
                {copy.unpublishFirst}
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

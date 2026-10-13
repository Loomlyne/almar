// The photo library shapes the picker, the photo fields and the Media screen share (03.2-09, contract section 5.10).
// MediaRef is the kit's type (components/ops/api-types.ts); MediaItem adds the library fields of one GET list row.
// Types only: no runtime, no import of anything but types.
import type { Locale3, MediaRef } from "./api-types";

export type MediaAltStatus = "published" | "draft" | "missing";

export type MediaItem = MediaRef & {
  content_type: string;
  source: "import" | "upload";
  alt: Record<Locale3, string | null>;
  alt_status: Record<Locale3, MediaAltStatus>;
  used_by: number;
};

/** The largest file the owner can send, in bytes: 10 MB, the same as lib/ops/validate-media.ts (job 03.2-09b). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const UPLOAD_TYPES = "image/jpeg,image/png,image/webp";

/** What the upload form shows. The picker never owns the file; the caller does. */
export type UploadDraft = {
  fileName: string;
  bytes: number;
  /** An object URL of the file, for the preview; null when none. */
  previewUrl: string | null;
  altEn: string;
  /**
   * ready: file and alt can be sent; uploading: waiting for the server; done: stored; rejected: the file itself is
   * refused (size or type), Upload stays off until another file is chosen; failed: the send failed, Upload may be retried.
   */
  phase: "ready" | "uploading" | "done" | "rejected" | "failed";
  /** Plain message, already in the dashboard language; null when none. */
  error: string | null;
};

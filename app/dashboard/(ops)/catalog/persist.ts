// The write sequences of Catalog -> Destinations and Experiences and services (plan 03.2-06), apart from React so a
// node test can drive them with a fake send: one save, then the publish call; and the destination-level connect loop.

import type { OpsError, PublishResult, PublishWarningCode, WriteResult } from "../../../../components/ops/api-types";
import type { OpsResponse } from "../../../../components/ops/ops-client";

export type SendFn = <T>(path: `/api/ops/${string}`, body: unknown) => Promise<OpsResponse<T>>;

export type Persisted =
  | { ok: false; error: OpsError }
  | { ok: true; id: string; publishError: OpsError | null; warnings: PublishWarningCode[] };

/**
 * One save; on `publish`, the publish call after it, only when the save was taken. A refused publish still reports the
 * saved id (the save happened: the editor reads it back).
 */
export async function saveThenPublish(
  send: SendFn,
  path: `/api/ops/${string}`,
  entity: "destination" | "catalog_item",
  item: Record<string, unknown>,
  publish: boolean,
): Promise<Persisted> {
  const saved = await send<WriteResult>(path, { action: "save", item });
  if (!saved.ok) return { ok: false, error: saved.error };
  if (!publish) return { ok: true, id: saved.id, publishError: null, warnings: [] };
  const published = await send<PublishResult>("/api/ops/publish", { entity, id: saved.id, published: true });
  return published.ok
    ? { ok: true, id: saved.id, publishError: null, warnings: published.warnings.map((warning) => warning.code) }
    : { ok: true, id: saved.id, publishError: published.error, warnings: [] };
}

export type ConnectOutcome = { saved: number; total: number; failed: { id: string; error: OpsError } | null };

/** One catalog save per changed item, in order; the first refusal stops the rest and is reported with the count. */
export async function saveConnections(send: SendFn, changes: readonly { id: string; destination_ids: string[] }[]): Promise<ConnectOutcome> {
  let saved = 0;
  for (const change of changes) {
    const reply = await send<WriteResult>("/api/ops/catalog", { action: "save", item: change });
    if (!reply.ok) return { saved, total: changes.length, failed: { id: change.id, error: reply.error } };
    saved += 1;
  }
  return { saved, total: changes.length, failed: null };
}

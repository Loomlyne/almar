"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CatalogSummary,
  DestinationDetail,
  DestinationSummary,
  DetailReply,
  ListReply,
  OpsError,
  PublishResult,
  PublishWarningCode,
  StaySummary,
  WriteResult,
} from "../../../../../components/ops/api-types";
import type { Send } from "../../../../../components/ops/auto-translate";
import type { SaveIntent, SavePayload } from "../../../../../components/ops/edit-page";
import { errorText } from "../../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { OPS_CATALOG_COPY, fillCatalogCopy } from "../../../../../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import {
  afterSave,
  connectedAfter,
  connectionChanges,
  destinationFormOf,
  destinationPayload,
  emptyDestinationForm,
  movedIds,
  sameForm,
  strandedItems,
  withTranslations,
  type DestinationForm,
} from "../catalog-forms";
import { saveConnections, saveThenPublish } from "../persist";
import { DestinationsView, type DestinationRow } from "./destinations-view";

const PATH = "/api/ops/destinations";

type Open = { form: DestinationForm; saved: DestinationForm };

/**
 * Catalog -> Destinations, connected (plan 03.2-06 Task 2): the list, search and order, the destination's editor page
 * (Save, Publish, Unpublish, Delete, automatic Arabic and Spanish through the kit), its stays (read-only) and its
 * destination-level experiences and services, all through the kit client. `send` is the test seam for the translate
 * request; the page passes nothing.
 */
export function DestinationsScreen({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const kit = OPS_KIT_COPY[locale];
  const items$ = OPS_CATALOG_COPY[locale].items;
  const copy = OPS_CATALOG_COPY[locale].destinations;

  const [rows, setRows] = useState<DestinationSummary[]>([]);
  const [stays, setStays] = useState<StaySummary[]>([]);
  const [items, setItems] = useState<CatalogSummary[]>([]);
  const [listError, setListError] = useState<OpsError | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OpsError | null>(null);
  const [warnings, setWarnings] = useState<PublishWarningCode[]>([]);
  // The Connections card's own line: a refused removal, or a connect loop that stopped partway.
  const [connectNote, setConnectNote] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  // A second Save, Publish, connect or move while one is on its way is not taken (the kit's busy state lands a render later).
  const writing = useRef(false);
  const moving = useRef(false);

  /** The three lists the screen reads: destinations, stays (for each one's Stays card), experiences and services. */
  async function loadLists(): Promise<OpsError | null> {
    const [d, s, c] = await Promise.all([
      opsFetch<ListReply<DestinationSummary>>(PATH),
      opsFetch<ListReply<StaySummary>>("/api/ops/stays"),
      opsFetch<ListReply<CatalogSummary>>("/api/ops/catalog"),
    ]);
    if (d.ok) setRows(d.items);
    if (s.ok) setStays(s.items);
    if (c.ok) setItems(c.items);
    const failed = [d, s, c].find((reply) => !reply.ok);
    const refusal = failed && !failed.ok ? failed.error : null;
    setListError(refusal);
    return refusal;
  }

  useEffect(() => {
    void loadLists();
  }, []);

  /** Loads one destination into the editor (its saved state is the server's); the refusal, if any, is returned. */
  async function openDetail(id: string): Promise<OpsError | null> {
    const reply = await opsFetch<DetailReply<DestinationDetail>>(PATH, { id });
    if (!reply.ok) return reply.error;
    const form = destinationFormOf(reply.item);
    setOpen({ form, saved: form });
    return null;
  }

  async function onOpen(id: string) {
    if (busy) return;
    setError(null);
    setWarnings([]);
    setConnectNote(null);
    setBusy(true);
    const refusal = await openDetail(id);
    setBusy(false);
    // The editor did not open: the list says why.
    if (refusal) setListError(refusal);
  }

  function onNew() {
    const form = emptyDestinationForm();
    setError(null);
    setWarnings([]);
    setConnectNote(null);
    setOpen({ form, saved: form });
  }

  /** One save, and on `publish` the publish call after it; then the editor and the lists are read again. */
  async function persist(form: DestinationForm, publish: boolean): Promise<boolean> {
    if (writing.current) return false;
    writing.current = true;
    setBusy(true);
    setError(null);
    const result = await saveThenPublish(opsSend, PATH, "destination", destinationPayload(form, { publish }), publish);
    if (!result.ok) {
      writing.current = false;
      setBusy(false);
      setError(result.error);
      return false;
    }
    if (publish && !result.publishError) setWarnings(result.warnings);
    const reread = await openDetail(result.id);
    // Saved but not read back: the editor keeps what was sent, with its id (and, after a taken Publish, published), so
    // the next Save updates it and keeps the site's Arabic and Spanish published.
    if (reread) {
      const held = afterSave(form, result.id, publish && !result.publishError);
      setOpen({ form: held, saved: held });
    }
    await loadLists();
    writing.current = false;
    setBusy(false);
    setError(result.publishError ?? reread);
    return true;
  }

  function onSave(payload: SavePayload, intent: SaveIntent): Promise<boolean> {
    if (!open) return Promise.resolve(false);
    return persist(withTranslations(open.form, payload.translations), intent === "publish");
  }

  async function onUnpublish() {
    if (!open?.form.id || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<PublishResult>("/api/ops/publish", { entity: "destination", id: open.form.id, published: false });
    if (!reply.ok) setError(reply.error);
    else {
      setWarnings([]);
      setError(await openDetail(open.form.id));
      await loadLists();
    }
    setBusy(false);
  }

  async function onDelete() {
    if (!open?.form.id || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<WriteResult>(PATH, { action: "delete", id: open.form.id });
    if (reply.ok) {
      setOpen(null);
      await loadLists();
    } else setError(reply.error);
    setBusy(false);
  }

  /**
   * One order at a time: a second move waits until the list is read back. Says at once whether it took this one
   * (false while an order is on its way), so the view moves focus only for a move that was taken.
   */
  function reorder(ids: string[]): boolean {
    if (moving.current) return false;
    moving.current = true;
    void sendOrder(ids);
    return true;
  }

  /** Sends the order, reads the list back; a refusal stays on the list. */
  async function sendOrder(ids: string[]) {
    setReordering(true);
    const reply = await opsSend(PATH, { action: "reorder", ids });
    await loadLists();
    if (!reply.ok) setListError(reply.error);
    moving.current = false;
    setReordering(false);
  }

  /**
   * Connect or Remove at destination level. The item list is read first and the owner's change applied to it (a change
   * made elsewhere meanwhile is kept). A published item left with no destination is refused before any save. Then one
   * catalog save per changed item, in order; the first refusal stops the rest and the card says how many saved and which
   * item did not. The list is read again either way.
   */
  async function onConnectedChange(ids: string[]) {
    const id = open?.form.id;
    if (!id || busy || writing.current) return;
    const before = items.filter((item) => item.destination_ids.includes(id)).map((item) => item.id);
    writing.current = true;
    setBusy(true);
    setError(null);
    setConnectNote(null);
    const finish = () => {
      writing.current = false;
      setBusy(false);
    };
    const now = await opsFetch<ListReply<CatalogSummary>>("/api/ops/catalog");
    if (!now.ok) {
      setError(now.error);
      finish();
      return;
    }
    setItems(now.items);
    const want = connectedAfter(before, ids, now.items.filter((item) => item.destination_ids.includes(id)).map((item) => item.id));
    const stranded = strandedItems(now.items, id, want);
    if (stranded.length > 0) {
      setConnectNote(fillCatalogCopy(copy.lastDestination, { name: stranded.map((item) => item.name).join(", ") }));
      finish();
      return;
    }
    const outcome = await saveConnections(opsSend, connectionChanges(now.items, id, want));
    if (outcome.failed) {
      const name = now.items.find((item) => item.id === outcome.failed!.id)?.name_en ?? "";
      setConnectNote(
        fillCatalogCopy(copy.connectPartial, { saved: outcome.saved, total: outcome.total, name, reason: errorText(kit, outcome.failed.error) }),
      );
    }
    const reread = await opsFetch<ListReply<CatalogSummary>>("/api/ops/catalog");
    if (reread.ok) setItems(reread.items);
    finish();
  }

  const shown: DestinationRow[] = rows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((row) => ({ id: row.id, name: row.name_en, stayCount: row.stay_count, published: row.is_published }));

  const openId = open?.form.id ?? null;

  return (
    <DestinationsView
      rows={shown}
      onNew={onNew}
      onOpen={(id) => void onOpen(id)}
      onMove={(id, by) => reorder(movedIds(rows, id, by))}
      onDropOrder={(ids) => {
        reorder(ids);
      }}
      reordering={reordering}
      notice={
        listError ? (
          <p role="alert" className="m-0 text-label text-error">
            {errorText(kit, listError)}
          </p>
        ) : null
      }
      panel={
        open
          ? {
              form: open.form,
              saved: open.saved.text,
              onForm: (form) => {
                setError(null);
                setOpen((was) => (was ? { ...was, form } : was));
              },
              dirty: !sameForm(open.form, open.saved),
              busy,
              stays: openId
                ? stays
                    .filter((stay) => stay.destination_id === openId)
                    .sort((a, b) => a.position - b.position)
                    .map((stay) => ({ id: stay.id, name: stay.title_en, published: stay.is_published }))
                : [],
              items: items
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((item) => ({ id: item.id, label: item.name_en, meta: item.kind === "service" ? items$.kindService : items$.kindExperience })),
              connectedIds: openId ? items.filter((item) => item.destination_ids.includes(openId)).map((item) => item.id) : [],
              onConnectedChange: (ids) => void onConnectedChange(ids),
              connectNote,
              warnings,
              error,
              onSave,
              onPublish: () => persist(open.form, true),
              onUnpublish: () => void onUnpublish(),
              onDelete: () => void onDelete(),
              onClose: () => {
                if (busy) return;
                setOpen(null);
                setError(null);
                setConnectNote(null);
              },
              send,
            }
          : null
      }
    />
  );
}

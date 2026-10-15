"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CatalogDetail,
  CatalogSummary,
  DestinationSummary,
  DetailReply,
  ListReply,
  OpsError,
  PublishResult,
  PublishWarningCode,
  StayDetail,
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
  catalogItemFormOf,
  catalogItemPayload,
  emptyCatalogItemForm,
  groupAmount,
  movedIds,
  sameForm,
  withTranslations,
  type CatalogItemForm,
} from "../catalog-forms";
import { saveThenPublish } from "../persist";
import { CatalogItemsView, type CatalogRow } from "./catalog-items-view";

const PATH = "/api/ops/catalog";

type Open = { form: CatalogItemForm; saved: CatalogItemForm };

const priceRefused: OpsError = { code: "invalid", field: "price_aed", locale: null, detail: null };

/**
 * Catalog -> Experiences and services, connected (plan 03.2-06 Task 2): the list, filters, search and order, the item's
 * editor page (Save, Publish, Unpublish, Delete, automatic Arabic and Spanish through the kit) and its connections, all
 * through the kit client. The list reply has no stay list per item: when the owner picks a stay in the stay filter, that
 * stay's detail is read once (`/api/ops/stays?id=`, its experience_ids and service_ids) and kept for the session.
 * `send` is the test seam for the translate request.
 */
export function CatalogItemsScreen({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const kit = OPS_KIT_COPY[locale];
  const copy = OPS_CATALOG_COPY[locale].items;

  const [rows, setRows] = useState<CatalogSummary[]>([]);
  const [destinations, setDestinations] = useState<DestinationSummary[]>([]);
  const [stays, setStays] = useState<StaySummary[]>([]);
  // The items connected to each stay picked in the filter so far: stay id -> item ids.
  const [stayItems, setStayItems] = useState<Record<string, string[]>>({});
  const [listError, setListError] = useState<OpsError | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OpsError | null>(null);
  const [warnings, setWarnings] = useState<PublishWarningCode[]>([]);
  const [reordering, setReordering] = useState(false);
  // A second Save, Publish or move while one is on its way is not taken (the kit's busy state lands a render later).
  const writing = useRef(false);
  const moving = useRef(false);

  /** Reads the three lists; the first refusal is shown on the list and returned. */
  async function loadLists(): Promise<OpsError | null> {
    const [c, d, s] = await Promise.all([
      opsFetch<ListReply<CatalogSummary>>(PATH),
      opsFetch<ListReply<DestinationSummary>>("/api/ops/destinations"),
      opsFetch<ListReply<StaySummary>>("/api/ops/stays"),
    ]);
    if (c.ok) setRows(c.items);
    if (d.ok) setDestinations(d.items);
    if (s.ok) setStays(s.items);
    const failed = [c, d, s].find((reply) => !reply.ok);
    const refusal = failed && !failed.ok ? failed.error : null;
    setListError(refusal);
    return refusal;
  }

  useEffect(() => {
    void loadLists();
  }, []);

  /**
   * The stay filter: one read of the picked stay (its experiences and services), kept for the session. False when it
   * did not come back: the list says why and the filter stays on all stays.
   */
  async function onStayFilter(stayId: string): Promise<boolean> {
    if (stayItems[stayId]) return true;
    const reply = await opsFetch<DetailReply<StayDetail>>("/api/ops/stays", { id: stayId });
    if (!reply.ok) {
      setListError(reply.error);
      return false;
    }
    setListError(null);
    setStayItems((was) => ({ ...was, [stayId]: [...reply.item.experience_ids, ...reply.item.service_ids] }));
    return true;
  }

  /** Loads one item into the editor (its saved state is the server's); the refusal, if any, is returned. */
  async function openDetail(id: string): Promise<OpsError | null> {
    const reply = await opsFetch<DetailReply<CatalogDetail>>(PATH, { id });
    if (!reply.ok) return reply.error;
    const form = catalogItemFormOf(reply.item);
    setOpen({ form, saved: form });
    // A stay read for the filter learns this item's connections as saved now.
    const linked = new Set(reply.item.stay_ids);
    setStayItems((was) =>
      Object.fromEntries(
        Object.entries(was).map(([stay, ids]) => [stay, linked.has(stay) ? [...new Set([...ids, id])] : ids.filter((other) => other !== id)]),
      ),
    );
    return null;
  }

  async function onOpen(id: string) {
    if (busy) return;
    setError(null);
    setWarnings([]);
    setBusy(true);
    const refusal = await openDetail(id);
    setBusy(false);
    if (refusal) setListError(refusal);
  }

  function onNew() {
    const form = emptyCatalogItemForm();
    setError(null);
    setWarnings([]);
    setOpen({ form, saved: form });
  }

  /** One save, and on `publish` the publish call after it; then the editor and the lists are read again. */
  async function persist(form: CatalogItemForm, publish: boolean): Promise<boolean> {
    if (writing.current) return false;
    const payload = catalogItemPayload(form, { publish });
    if (!payload.ok) {
      setError(priceRefused);
      return false;
    }
    writing.current = true;
    setBusy(true);
    setError(null);
    const result = await saveThenPublish(opsSend, PATH, "catalog_item", payload.item, publish);
    if (!result.ok) {
      writing.current = false;
      setBusy(false);
      setError(result.error);
      return false;
    }
    if (publish && !result.publishError) setWarnings(result.warnings);
    const reread = await openDetail(result.id);
    // Saved but not read back: the editor keeps what was sent, with its id, so the next Save updates it.
    if (reread) setOpen({ form: { ...form, id: result.id }, saved: { ...form, id: result.id } });
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
    const reply = await opsSend<PublishResult>("/api/ops/publish", { entity: "catalog_item", id: open.form.id, published: false });
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

  /** One order at a time: the move buttons wait until the list is read back. A refusal stays on the list. */
  async function reorder(ids: string[]) {
    if (moving.current) return;
    moving.current = true;
    setReordering(true);
    const reply = await opsSend(PATH, { action: "reorder", ids });
    await loadLists();
    if (!reply.ok) setListError(reply.error);
    moving.current = false;
    setReordering(false);
  }

  const shown: CatalogRow[] = rows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      id: row.id,
      name: row.name_en,
      kind: row.kind,
      unit: row.unit,
      priceText: row.price_aed === null ? null : fillCatalogCopy(copy.aedAmount, { amount: groupAmount(row.price_aed) }),
      destinationIds: row.destination_ids,
      stayIds: Object.keys(stayItems).filter((stay) => stayItems[stay]!.includes(row.id)),
      stayCount: row.stay_count,
      published: row.is_published,
      position: row.position,
    }));

  const destinationOptions = destinations
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((destination) => ({ id: destination.id, label: destination.name_en }));
  const stayOptions = stays
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((stay) => ({ id: stay.id, label: stay.title_en, meta: stay.destination_name_en }));

  // Published with no price: not offered as an add-on (the server's warning, kept while the editor is open).
  const noPrice: PublishWarningCode[] = open?.saved.published && open.saved.price === "" ? ["no_price"] : [];

  return (
    <CatalogItemsView
      rows={shown}
      destinations={destinationOptions}
      stays={stayOptions}
      onNew={onNew}
      onOpen={(id) => void onOpen(id)}
      onMove={(id, by) => void reorder(movedIds(rows, id, by))}
      onDropOrder={(ids) => void reorder(ids)}
      onStayFilter={onStayFilter}
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
              destinations: destinationOptions,
              stays: stayOptions,
              warnings: [...new Set([...warnings, ...noPrice])],
              error,
              onSave,
              onPublish: () => persist(open.form, true),
              onUnpublish: () => void onUnpublish(),
              onDelete: () => void onDelete(),
              onClose: () => {
                if (busy) return;
                setOpen(null);
                setError(null);
              },
              send,
            }
          : null
      }
    />
  );
}

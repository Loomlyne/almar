"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import type {
  CatalogSummary,
  DestinationSummary,
  DetailReply,
  ListReply,
  OpsError,
  PublishResult,
  StayDetail,
  StaySummary,
} from "../../../../../components/ops/api-types";
import type { SaveIntent, SavePayload } from "../../../../../components/ops/edit-page";
import { errorText } from "../../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_STAYS_COPY } from "../../../../../lib/copy/ops-stays";
import { StayEditor } from "./stay-editor";
import { withBaseRate } from "./rates-forms";
import { emptyStayForm, stayForm, stayPayload, type StayForm } from "./stay-forms";
import {
  catalogChoices,
  destinationChoices,
  destinationItemIds,
  liveLanguages,
  liveStayFields,
  movedOrder,
  stayRows,
  stayWarnings,
} from "./stays-data";
import { StaysList } from "./stays-list";

const PATH = "/api/ops/stays";
const NEW = "new";

type Lists = { stays: StaySummary[]; details: Map<string, StayDetail>; catalog: CatalogSummary[]; destinations: DestinationSummary[] };

/**
 * Catalog -> Stays, connected: the list (search, destination filter, order) and one stay on the kit's editor page, through
 * the kit client: `/api/ops/stays` (list, `?id=`, save with connections, delete, reorder), `/api/ops/catalog` (what a stay
 * can connect, and each destination's own items), `/api/ops/destinations` and `/api/ops/publish` (entity `stay`). The
 * editor and the list are the signed screens; this file only feeds them. `send` is the test seam for the translate
 * request; the page passes nothing.
 */
export function StaysScreen({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const kit = OPS_KIT_COPY[locale];
  const copy = OPS_STAYS_COPY[locale];

  const [lists, setLists] = useState<Lists | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [destinationId, setDestinationId] = useState("");

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [stay, setStay] = useState<StayDetail | null>(null);
  const [form, setForm] = useState<StayForm>(emptyStayForm);
  const [saved, setSaved] = useState<StayForm>(emptyStayForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OpsError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const latest = useRef(0);

  /** Every list the screen shows, read again. Each stay is read once for its connected count (the list reply has none). */
  const load = useCallback(async () => {
    const ticket = (latest.current += 1);
    const [stays, catalog, destinations] = await Promise.all([
      opsFetch<ListReply<StaySummary>>(PATH),
      opsFetch<ListReply<CatalogSummary>>("/api/ops/catalog"),
      opsFetch<ListReply<DestinationSummary>>("/api/ops/destinations"),
    ]);
    if (ticket !== latest.current) return;
    const failed = [stays, catalog, destinations].find((reply) => !reply.ok);
    if (failed && !failed.ok) return setListError(errorText(kit, failed.error));
    if (!stays.ok || !catalog.ok || !destinations.ok) return;
    const replies = await Promise.all(stays.items.map((one) => opsFetch<DetailReply<StayDetail>>(PATH, { id: one.id })));
    if (ticket !== latest.current) return;
    // A stay whose read fails keeps its row with a count of 0; opening it reads it again (onOpen) and says the error there.
    const details = new Map<string, StayDetail>();
    for (const reply of replies) if (reply.ok) details.set(reply.item.id, reply.item);
    setListError(null);
    setLists({ stays: stays.items, details, catalog: catalog.items, destinations: destinations.items });
  }, [kit]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Shows `detail` on the page as saved: the form and its saved copy are the same, so nothing is unsaved. */
  function show(detail: StayDetail) {
    const start = stayForm(detail);
    setStay(detail);
    setForm(start);
    setSaved(start);
    setOpenKey(detail.id);
  }

  /** Reads one stay again; false when the read failed (the error is on the page). */
  async function readStay(id: string): Promise<boolean> {
    const reply = await opsFetch<DetailReply<StayDetail>>(PATH, { id });
    if (!reply.ok) {
      setError(reply.error);
      return false;
    }
    show(reply.item);
    return true;
  }

  /**
   * The stay as the last list read it (every write reads the list again), so the page opens at once. A stay the list
   * could not read is read now; if that fails too the page does not open, so the error is said on the list (the kit's
   * EditPage draws `error` only on an open page).
   */
  async function onOpen(id: string) {
    setError(null);
    const known = lists?.details.get(id);
    if (known) {
      setListError(null);
      return show(known);
    }
    const reply = await opsFetch<DetailReply<StayDetail>>(PATH, { id });
    if (!reply.ok) return setListError(errorText(kit, reply.error));
    setListError(null);
    show(reply.item);
  }

  function onNew() {
    const start = emptyStayForm();
    setError(null);
    setListError(null);
    setStay(null);
    setForm(start);
    setSaved(start);
    setOpenKey(NEW);
  }

  // Both also drop the list's alert, so an old one never comes back with the list (PR #19 review round 3).
  function onClose() {
    setOpenKey(null);
    setError(null);
    setListError(null);
  }

  /**
   * 03.2-15's Rates card saved the base rate: only the stay's price (so the no-rate warning) and the list change. The
   * form and its saved copy are left alone: a full re-read here threw away unsaved edits with no question (PR #23 review).
   */
  function onBaseRate(stayId: string, base: string | null) {
    setStay((was) => withBaseRate(was, stayId, base));
    void load();
  }

  const kindOf = (id: string) => lists?.catalog.find((one) => one.id === id)?.kind;

  /** One `save`; the stay's id, or null when the server refused it (the error is on the page). */
  async function persist(next: StayForm, publish: boolean): Promise<string | null> {
    const body = stayPayload(next, saved, { id: stay?.id ?? null, publish, live: liveLanguages(stay), kindOf });
    const reply = await opsSend<{ id: string; affects_site: boolean }>(PATH, body);
    if (!reply.ok) {
      setError(reply.error);
      return null;
    }
    return reply.id;
  }

  async function setPublished(id: string, published: boolean): Promise<boolean> {
    const reply = await opsSend<PublishResult>("/api/ops/publish", { entity: "stay", id, published });
    if (!reply.ok) {
      setError(reply.error);
      return false;
    }
    return true;
  }

  /**
   * The kit's Save: the English as typed and the Arabic and Spanish the kit filled. `publish` (Publish with unsaved work,
   * or on a new stay) saves every language as published and then publishes the stay.
   */
  async function onSave(payload: SavePayload, intent: SaveIntent): Promise<boolean> {
    setBusy(true);
    setError(null);
    const next = { ...form, translations: payload.translations, locked: payload.locked };
    const id = await persist(next, intent === "publish");
    if (id !== null && intent === "publish") await setPublished(id, true);
    if (id !== null) await readStay(id);
    setBusy(false);
    if (id !== null) void load();
    return id !== null;
  }

  /** Publish on a saved page: languages still in draft go live with the stay (no review step, owner 2026-10-14). */
  async function onPublish() {
    if (!stay) return;
    setBusy(true);
    setError(null);
    const draft = (["en", "ar", "es"] as const).some((code) => stay.translations[code] !== null && stay.translations[code]?.status !== "published");
    const id = draft ? await persist(form, true) : stay.id;
    if (id !== null) {
      await setPublished(id, true);
      await readStay(id);
    }
    setBusy(false);
    void load();
  }

  async function onUnpublish() {
    if (!stay) return;
    setBusy(true);
    setError(null);
    if (await setPublished(stay.id, false)) await readStay(stay.id);
    setBusy(false);
    void load();
  }

  async function onDelete() {
    if (!stay || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<{ id: string; affects_site: boolean }>(PATH, { action: "delete", id: stay.id });
    setBusy(false);
    if (!reply.ok) return setError(reply.error);
    setOpenKey(null);
    setStay(null);
    void load();
  }

  /** The whole list in a new order; on a refusal the list is read again so it shows the order that is stored. */
  async function sendOrder(ids: string[]) {
    if (!lists) return;
    const position = new Map(ids.map((id, index) => [id, index]));
    setLists({ ...lists, stays: lists.stays.map((one) => ({ ...one, position: position.get(one.id) ?? one.position })) });
    const reply = await opsSend<{ affects_site: boolean }>(PATH, { action: "reorder", ids });
    if (!reply.ok) {
      setListError(errorText(kit, reply.error));
      void load();
    }
  }

  const rows = lists ? stayRows(lists.stays, lists.details) : [];
  const destinations = lists ? destinationChoices(lists.destinations) : [];

  const staysList = lists ? (
    <StaysList
      locale={locale}
      rows={rows}
      destinations={destinations}
      search={search}
      onSearchChange={setSearch}
      destinationId={destinationId}
      onDestinationChange={setDestinationId}
      onOpen={(row) => void onOpen(row.id)}
      onNew={onNew}
      onMove={(id, by) => void sendOrder(movedOrder(rows.map((row) => row.id), id, by))}
      onDropOrder={(ids) => void sendOrder(ids)}
    />
  ) : (
    <div aria-busy="true" />
  );
  // One wrapper always, the alert inside it when there is one: the list keeps its place in the tree, so it is not
  // mounted again and keyboard focus stays where it was when the alert appears (PR #19 review round 3).
  const list = (
    <div className="flex min-w-0 flex-col gap-6">
      {listError ? (
        <p role="alert" className="m-0 text-label text-error">
          {listError}
        </p>
      ) : null}
      {staysList}
    </div>
  );

  return (
    <>
      <StayEditor
        locale={locale}
        list={list}
        openKey={openKey}
        onClose={onClose}
        stay={stay}
        onBaseRate={onBaseRate}
        form={form}
        saved={saved}
        onFormChange={(next) => {
          setError(null);
          setForm(next);
        }}
        destinations={destinations}
        catalog={lists ? catalogChoices(lists.catalog) : []}
        destinationItems={lists ? destinationItemIds(lists.catalog, form.facts.destinationId) : []}
        busy={busy}
        error={error}
        warnings={stayWarnings(stay)}
        onSave={onSave}
        onPublish={onPublish}
        onUnpublish={() => void onUnpublish()}
        onDelete={() => setConfirming(true)}
        liveTranslations={liveStayFields(stay)}
        // A stay is on the site only while published, which the kit already holds on a failed translation.
        holdOnFailure={false}
        send={send}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.deleteStay}
        description={stay?.translations.en?.title}
        confirmLabel={copy.deleteStay}
        cancelLabel={kit.cancel}
        onConfirm={() => {
          setConfirming(false);
          void onDelete();
        }}
      />
    </>
  );
}

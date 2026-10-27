"use client";

import { useEffect, useRef, useState } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import type { DetailReply, ListReply, OpsError, PageItemDetail, PageView, ReorderResult, WriteResult } from "../../../../../components/ops/api-types";
import type { SavePayload } from "../../../../../components/ops/edit-page";
import { errorText } from "../../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import type { PageKey } from "../../../../../lib/data/page-sections";
import type { PageSummary } from "../../../../../lib/ops/site-pages-handlers";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_PAGES_COPY } from "../../../../../lib/copy/ops-pages";
import { movedIds, sameForm } from "../../catalog/catalog-forms";
import {
  cardForm,
  cardPayload,
  cardWithTranslations,
  emptyCardForm,
  isHero,
  sectionForm,
  sectionPayload,
  sectionWithTranslations,
  type CardForm,
  type SectionForm,
} from "./page-forms";
import { PAGE_ORDER, PagesView, type CardRow, type PageRow, type SectionRow } from "./pages-view";

const PAGES = "/api/ops/pages";
const ITEMS = "/api/ops/page-items";

type Section = PageView["sections"][number];
type OpenSection = { form: SectionForm; saved: SectionForm };
type OpenCard = { form: CardForm; saved: CardForm };

const cardRows = (items: readonly PageItemDetail[] | undefined): CardRow[] =>
  (items ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => ({ id: item.id, title: item.translations.en?.title ?? "", shown: item.is_shown, position: item.position }));

/**
 * Content -> Pages, connected (plan 06-02 Task 4): the five pages, one page's sections (GET /api/ops/pages?page=), a
 * section's editor (POST /api/ops/pages) and About's cards (POST /api/ops/page-items), all through the kit client. A
 * section is always on the site, so the kit's bar says "Save and update site" and a failed translation saves nothing.
 * `send` is the test seam for the translate request; the page passes nothing.
 */
export function PagesScreen({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const copy = OPS_PAGES_COPY[locale];
  const kit = OPS_KIT_COPY[locale];

  const [summaries, setSummaries] = useState<PageSummary[]>([]);
  const [page, setPage] = useState<PageKey | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [listError, setListError] = useState<OpsError | null>(null);
  const [open, setOpen] = useState<OpenSection | null>(null);
  const [card, setCard] = useState<OpenCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OpsError | null>(null);
  const [reordering, setReordering] = useState(false);
  const writing = useRef(false);
  const moving = useRef(false);

  async function loadSummaries() {
    const reply = await opsFetch<ListReply<PageSummary>>(PAGES);
    if (reply.ok) setSummaries(reply.items);
    setListError(reply.ok ? null : reply.error);
  }

  /** Reads one page's sections; returns them (or null with the refusal shown). */
  async function loadPage(key: PageKey): Promise<Section[] | null> {
    const reply = await opsFetch<DetailReply<PageView>>(PAGES, { page: key });
    if (!reply.ok) {
      setListError(reply.error);
      return null;
    }
    setListError(null);
    setSections(reply.item.sections);
    return reply.item.sections;
  }

  useEffect(() => {
    void loadSummaries();
  }, []);

  async function onOpenPage(key: PageKey) {
    if (busy) return;
    setBusy(true);
    setPage(key);
    setSections([]);
    await loadPage(key);
    setBusy(false);
  }

  function onBackToPages() {
    setPage(null);
    setSections([]);
    setOpen(null);
    setCard(null);
    void loadSummaries();
  }

  function onOpenSection(id: string) {
    const found = sections.find((section) => section.id === id);
    if (!found) return;
    const form = sectionForm(found);
    setError(null);
    setOpen({ form, saved: form });
  }

  /** After a write: the page read again; the open section (and card) refreshed from it. */
  async function reread(sectionId: string, cardId?: string | null) {
    if (!page) return;
    const fresh = await loadPage(page);
    const section = fresh?.find((s) => s.id === sectionId);
    if (section) {
      const form = sectionForm(section);
      setOpen({ form, saved: form });
      if (cardId) {
        const item = section.items?.find((i) => i.id === cardId);
        if (item) {
          const next = cardForm(item);
          setCard({ form: next, saved: next });
        }
      }
    }
  }

  async function onSaveSection(payload: SavePayload): Promise<boolean> {
    if (!open || writing.current) return false;
    const form = sectionWithTranslations(open.form, payload.translations, payload.locked);
    const body = sectionPayload(form);
    if (!body.ok) {
      setError({ code: "invalid", field: body.field, locale: null, detail: null });
      return false;
    }
    writing.current = true;
    setBusy(true);
    setError(null);
    const reply = await opsSend<WriteResult>(PAGES, body.body);
    if (!reply.ok) {
      writing.current = false;
      setBusy(false);
      setError(reply.error);
      return false;
    }
    // The kit's values are kept until the read-back replaces them.
    setOpen({ form, saved: form });
    await reread(form.id);
    writing.current = false;
    setBusy(false);
    return true;
  }

  function onNewCard() {
    if (!open) return;
    const form = emptyCardForm(open.form.id);
    setError(null);
    setCard({ form, saved: form });
  }

  function onOpenCard(id: string) {
    const item = sections.find((s) => s.id === open?.form.id)?.items?.find((i) => i.id === id);
    if (!item) return;
    const form = cardForm(item);
    setError(null);
    setCard({ form, saved: form });
  }

  async function onSaveCard(payload: SavePayload): Promise<boolean> {
    if (!card || !open || writing.current) return false;
    const form = cardWithTranslations(card.form, payload.translations, payload.locked);
    const body = cardPayload(form);
    if (!body.ok) {
      setError({ code: "invalid", field: body.field, locale: null, detail: null });
      return false;
    }
    writing.current = true;
    setBusy(true);
    setError(null);
    const reply = await opsSend<WriteResult>(ITEMS, body.body);
    if (!reply.ok) {
      writing.current = false;
      setBusy(false);
      setError(reply.error);
      return false;
    }
    const id = reply.id ?? form.id;
    const held = { ...form, id, slug: form.slug || String(body.body.slug ?? "") };
    setCard({ form: held, saved: held });
    await reread(open.form.id, id);
    writing.current = false;
    setBusy(false);
    return true;
  }

  async function onDeleteCard() {
    if (!card?.form.id || !open || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<WriteResult>(ITEMS, { action: "delete", id: card.form.id });
    if (reply.ok) {
      setCard(null);
      await reread(open.form.id);
    } else setError(reply.error);
    setBusy(false);
  }

  /** One order at a time: a second move waits until the page is read back. */
  function reorderCards(ids: string[]): boolean {
    if (!open || moving.current) return false;
    moving.current = true;
    void sendOrder(open.form.id, ids);
    return true;
  }

  async function sendOrder(sectionId: string, ids: string[]) {
    setReordering(true);
    const reply = await opsSend<ReorderResult>(ITEMS, { action: "reorder", section_id: sectionId, ids });
    await reread(sectionId);
    if (!reply.ok) setError(reply.error);
    moving.current = false;
    setReordering(false);
  }

  const pageRows: PageRow[] = PAGE_ORDER.map((key) => {
    const found = summaries.find((s) => s.page === key);
    return { id: key, name: copy.pageNames[key], shown: found?.shown ?? 0, total: found?.total ?? 0 };
  });
  const sectionRows: SectionRow[] = page
    ? sections.map((s) => ({ id: s.id, section: s.section, name: copy.sections[page][s.section] ?? s.section, shown: isHero(page, s.section) || s.is_shown }))
    : [];
  const openSection = open ? sections.find((s) => s.id === open.form.id) : undefined;
  const cards = openSection?.items !== undefined ? cardRows(openSection.items) : undefined;

  return (
    <PagesView
      pages={pageRows}
      page={page}
      sections={sectionRows}
      onOpenPage={(key) => void onOpenPage(key)}
      onBackToPages={onBackToPages}
      onOpenSection={onOpenSection}
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
              saved: open.saved,
              onForm: (form) => {
                setError(null);
                setOpen((was) => (was ? { ...was, form } : was));
              },
              dirty: !sameForm(open.form, open.saved),
              busy,
              error,
              onSave: (payload) => onSaveSection(payload),
              onClose: () => {
                if (busy) return;
                setOpen(null);
                setError(null);
              },
              cards,
              onOpenCard,
              onNewCard,
              onMoveCard: (id, by) => (cards ? reorderCards(movedIds(cards, id, by)) : false),
              onDropCardOrder: (ids) => {
                reorderCards(ids);
              },
              reorderingCards: reordering,
              send,
            }
          : null
      }
      card={
        card && open
          ? {
              form: card.form,
              saved: card.saved,
              sectionName: copy.sections[open.form.page][open.form.section] ?? open.form.section,
              onForm: (form) => {
                setError(null);
                setCard((was) => (was ? { ...was, form } : was));
              },
              dirty: !sameForm(card.form, card.saved),
              busy,
              error,
              onSave: (payload) => onSaveCard(payload),
              onDelete: () => void onDeleteCard(),
              onClose: () => {
                if (busy) return;
                setCard(null);
                setError(null);
              },
              send,
            }
          : null
      }
    />
  );
}

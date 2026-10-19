"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import { EditPage, type EditSection, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { MediaField } from "../../../../../components/ops/media-field";
import { missingForPublish } from "../../../../../components/ops/publish-check";
import { missingLine } from "../../../../../components/ops/error-text";
import { StatusChip } from "../../../../../components/ops/status-chip";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import type { DetailReply, JourneyDetail, JourneySummary, ListReply, Locale3, OpsError, PublishResult } from "../../../../../components/ops/api-types";
import { errorText } from "../../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { Field } from "../../../../../components/ui/field";
import { OPS_CATALOG_COPY, fillCatalogCopy } from "../../../../../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { afterSave, liveGaps, movedIds, sameForm, withTranslations } from "../catalog-forms";
import { saveThenPublish } from "../persist";
import { focusMovedRow } from "../move-focus";
import {
  JOURNEY_TEXT_FIELDS,
  journeyForm,
  journeyPayload,
  journeyPriceGaps,
  liveJourneyFields,
  priceReading,
  type JourneyForm,
  type JourneyText,
  type JourneyTextField,
  type PriceGaps,
} from "./journey-forms";
import { OPS_TEAM_COPY, fillTeamCopy } from "../../../../../lib/copy/ops-team";

export type JourneyRow = { id: string; name: string; priceLine: string; published: boolean };

export type JourneyPanel = {
  form: JourneyForm;
  /** The text of the three languages as last saved: what the kit compares the English with, and what is live. */
  saved: Record<Locale3, JourneyText>;
  onForm: (next: JourneyForm) => void;
  dirty: boolean;
  busy: boolean;
  error: OpsError | null;
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  onPublish: () => void | Promise<unknown>;
  onUnpublish: () => void;
  onClose: () => void;
  /** After the last save: Arabic or Spanish text whose empty price line was kept as saved, or that could not be saved. */
  priceGaps?: PriceGaps | null;
  /** Test seam for the translate request (the kit's opsSend by default). */
  send?: Send;
};

/**
 * Catalog -> Packages: the three journeys of the home page (C-15; not drawn on the canvas, so pictures first). Driven
 * entirely by props. The list reorders; there is no New, no Delete and no booking. Show and hide are the kit's Publish
 * and Unpublish. The price line is the owner's own text, stored as typed; the editor only says how the site reads it.
 */
export function JourneysView({
  rows,
  onOpen,
  onMove,
  onDropOrder,
  panel,
  reordering = false,
  notice,
}: {
  rows: JourneyRow[];
  onOpen: (id: string) => void;
  /** Takes a move; false when the screen refused it (an order is already on its way). */
  onMove: (id: string, by: -1 | 1) => boolean | void;
  onDropOrder: (ids: string[]) => void;
  panel: JourneyPanel | null;
  /** An order is on its way: the list is aria-busy and focus returns to the moved row once it is read back. */
  reordering?: boolean;
  /** A line of the screen's own under the intro, such as a list that did not load. */
  notice?: ReactNode;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_TEAM_COPY[loc].journeys;
  const kit = OPS_KIT_COPY[loc];
  const listRef = useRef<HTMLDivElement>(null);
  // The row just moved: once the list is read back, focus returns to its move button (as on Catalog).
  const moved = useRef<{ name: string; by: -1 | 1 } | null>(null);
  useEffect(() => {
    if (reordering || !moved.current) return;
    focusMovedRow(listRef.current, moved.current.name, moved.current.by, { up: kit.moveUp, down: kit.moveDown });
    moved.current = null;
  }, [reordering]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<JourneyRow>[] = [
    { key: "name", label: copy.colName, phone: "title", render: (row) => row.name },
    {
      key: "price",
      label: copy.colPrice,
      phone: "meta",
      // The owner's text, as typed: an English line in any dashboard language.
      render: (row) => (
        <span lang="en" dir="ltr">
          {row.priceLine}
        </span>
      ),
    },
    { key: "shown", label: copy.colShown, phone: "meta", render: (row) => <StatusChip published={row.published} locale={loc} /> },
  ];

  const list = (
    <div ref={listRef} className="flex min-w-0 flex-col gap-6" aria-busy={reordering || undefined}>
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
      <p className="m-0 max-w-prose text-pretty text-label text-ink">{copy.intro}</p>
      {notice}
      <ListTable
        caption={copy.caption}
        columns={columns}
        rows={rows}
        onOpen={(row) => onOpen(row.id)}
        reorder={{
          onMove: (id, by) => {
            // Only a move the screen took moves focus: a refused second press leaves the first one's target.
            const name = rows.find((row) => row.id === id)?.name ?? "";
            if (onMove(id, by) !== false) moved.current = { name, by };
          },
          onDropOrder,
        }}
        empty={<p className="m-0 text-body text-ink">{copy.empty}</p>}
      />
    </div>
  );

  return <JourneyEditor panel={panel} list={list} />;
}

const englishOf = (text: JourneyText) => Object.fromEntries(JOURNEY_TEXT_FIELDS.map((field) => [field, text[field]]));

/**
 * The journey's editor page (kit EditPage): Text and Photo on the left; Price on the right with the English price line
 * and how the site reads the saved line; one column on a phone. No Delete (C-15): the kit shows none.
 */
function JourneyEditor({ panel, list }: { panel: JourneyPanel | null; list: ReactNode }) {
  const loc = useDashboardLocale();
  const copy = OPS_TEAM_COPY[loc].journeys;
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();

  const form = panel?.form ?? null;
  const title = form?.text.en.name.trim() || copy.untitled;
  const fieldLabels: Record<JourneyTextField, string> = {
    name: copy.fieldName,
    price_label: copy.fieldPrice,
    tagline: copy.fieldTagline,
    duration_label: copy.fieldDuration,
    ideal_for_label: copy.fieldIdealForLabel,
    ideal_for: copy.fieldIdealFor,
    body: copy.fieldBody,
  };

  function sections(panel: JourneyPanel, form: JourneyForm): EditSection[] {
    const { onForm } = panel;
    const english = (field: JourneyTextField, extra?: { multiline?: boolean; required?: boolean; hint?: string }) => {
      const common = {
        id: `${idBase}-en-${field}`,
        label: fieldLabels[field],
        className: "max-w-none",
        lang: "en",
        dir: "ltr",
        value: form.text.en[field],
        required: extra?.required,
        hint: extra?.hint,
        onChange: (event: { target: { value: string } }) => onForm({ ...form, text: { ...form.text, en: { ...form.text.en, [field]: event.target.value } } }),
      };
      return extra?.multiline ? <Field {...common} multiline rows={6} /> : <Field {...common} autoComplete="off" />;
    };

    return [
      {
        key: "text",
        title: kit.editor.sections.text,
        translatable: true,
        content: (
          <>
            {english("name", { required: true })}
            {english("tagline")}
            {english("duration_label")}
            {english("ideal_for_label")}
            {english("ideal_for")}
            {english("body", { multiline: true })}
          </>
        ),
      },
      {
        key: "photo",
        title: kit.editor.sections.photo,
        content: <MediaField id={`${idBase}-photo`} label={copy.fieldPhoto} required value={form.media} onChange={(media) => onForm({ ...form, media })} locale={loc} />,
      },
      {
        key: "price",
        title: kit.editor.sections.price,
        column: "side",
        content: (
          <>
            {english("price_label", { required: true, hint: copy.priceHint })}
            <div className="flex flex-col gap-1 border-s border-line ps-3">
              <p className="m-0 text-pretty text-label text-ink">{priceReading(form.price_from, form.price_estimate, copy)}</p>
              <p className="m-0 text-caption text-muted">{copy.readingSaved}</p>
            </div>
          </>
        ),
      },
      {
        key: "settings",
        title: kit.editor.sections.settings,
        column: "side",
        content: <p className="m-0 text-pretty text-label text-muted">{copy.noDelete}</p>,
      },
    ];
  }

  const missing = form ? missingForPublish("journey_tier", { translations: form.text, media_id: form.media?.id ?? null }) : [];
  const fieldLabel = (field: string) => (field in fieldLabels ? fieldLabels[field as JourneyTextField] : undefined);
  // A shown journey cannot be saved without what Publish needs (its photo, its English): the server's save does not
  // check it, so it would stay on the home page without it. The catalog's line says so, as on Destinations.
  const live = liveGaps(form?.published ?? false, missing);
  const gaps = panel?.priceGaps ?? null;
  const languages = (targets: readonly ("ar" | "es")[]) => targets.map((target) => kit.languages[target]).join(", ");
  const notes = [
    live.length > 0 ? fillCatalogCopy(OPS_CATALOG_COPY[loc].destinations.liveNeeds, { list: live.map((gap) => missingLine(kit, gap, fieldLabel)).join(", ") }) : null,
    gaps && gaps.held.length > 0 ? fillTeamCopy(copy.priceHeld, { languages: languages(gaps.held) }) : null,
    gaps && gaps.kept.length > 0 ? fillTeamCopy(copy.priceKept, { languages: languages(gaps.kept) }) : null,
  ].filter((note): note is string => note !== null);
  const liveNote =
    notes.length > 0 ? (
      <div role="status" className="flex flex-col gap-1">
        {notes.map((note) => (
          <p key={note} className="m-0 text-label text-ink">
            {note}
          </p>
        ))}
      </div>
    ) : null;

  return (
    <EditPage
      openKey={panel && form ? form.id : null}
      list={list}
      backLabel={copy.title}
      onClose={() => panel?.onClose()}
      title={title}
      isPublished={form?.published ?? false}
      dirty={panel?.dirty ?? false}
      busy={panel?.busy ?? false}
      canSave={form ? form.text.en.name.trim() !== "" && form.text.en.price_label.trim() !== "" && live.length === 0 : false}
      notice={liveNote}
      missing={missing}
      error={panel?.error ?? null}
      fieldLabel={fieldLabel}
      english={form ? englishOf(form.text.en) : {}}
      savedEnglish={panel ? englishOf(panel.saved.en) : {}}
      translations={form ? { ar: englishOf(form.text.ar), es: englishOf(form.text.es) } : { ar: {}, es: {} }}
      translationFields={JOURNEY_TEXT_FIELDS.map((field) => ({ name: field, label: fieldLabels[field], multiline: field === "body" }))}
      onTranslationChange={(target, name, value) => {
        if (!panel || !form) return;
        const text = Array.isArray(value) ? value.join(" ") : value;
        panel.onForm({ ...form, text: { ...form.text, [target]: { ...form.text[target], [name]: text } } });
      }}
      onSave={(payload, intent) => (panel ? panel.onSave(payload, intent) : Promise.resolve(false))}
      onPublish={() => panel?.onPublish()}
      onUnpublish={() => panel?.onUnpublish()}
      liveTranslations={panel && form ? liveJourneyFields(form.published, form.status, panel.saved) : {}}
      holdOnFailure={form?.published ?? false}
      send={panel?.send}
      sections={panel && form ? sections(panel, form) : []}
    />
  );
}

const PATH = "/api/ops/journeys";

type Open = { form: JourneyForm; saved: JourneyForm };

/**
 * Catalog -> Packages, connected (plan 03.2-08 Task 4): the three home journeys, their order and each one's editor
 * page (Save, Publish, Unpublish; automatic Arabic and Spanish through the kit), through the kit client (contract 5.8,
 * 5.9). No create and no delete (C-15). After a Save the editor is read again, so "How the site reads it" is the
 * server's reading of the line just saved. `send` is the test seam for the translate request; the page passes nothing.
 */
export function JourneysScreen({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const kit = OPS_KIT_COPY[locale];

  const [rows, setRows] = useState<JourneySummary[]>([]);
  const [listError, setListError] = useState<OpsError | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OpsError | null>(null);
  const [priceGaps, setPriceGaps] = useState<PriceGaps | null>(null);
  const [reordering, setReordering] = useState(false);
  // A second Save, Publish or move while one is on its way is not taken (the kit's busy state lands a render later).
  const writing = useRef(false);
  const moving = useRef(false);

  async function loadList(): Promise<OpsError | null> {
    const reply = await opsFetch<ListReply<JourneySummary>>(PATH);
    if (reply.ok) setRows(reply.items);
    const refusal = reply.ok ? null : reply.error;
    setListError(refusal);
    return refusal;
  }

  useEffect(() => {
    void loadList();
  }, []);

  /** Loads one journey into the editor (its saved state and price reading are the server's). */
  async function openDetail(id: string): Promise<OpsError | null> {
    const reply = await opsFetch<DetailReply<JourneyDetail>>(PATH, { id });
    if (!reply.ok) return reply.error;
    const form = journeyForm(reply.item);
    setOpen({ form, saved: form });
    return null;
  }

  async function onOpen(id: string) {
    if (busy) return;
    setError(null);
    setPriceGaps(null);
    setBusy(true);
    const refusal = await openDetail(id);
    setBusy(false);
    if (refusal) setListError(refusal);
  }

  /** One save, and on `publish` the publish call after it; then the editor and the list are read again. */
  async function persist(form: JourneyForm, publish: boolean): Promise<boolean> {
    if (writing.current) return false;
    writing.current = true;
    setBusy(true);
    setError(null);
    setPriceGaps(null);
    const gaps = journeyPriceGaps(form, { publish });
    const result = await saveThenPublish(opsSend, PATH, "journey_tier", journeyPayload(form, { publish }), publish);
    if (!result.ok) {
      writing.current = false;
      setBusy(false);
      setError(result.error);
      return false;
    }
    const reread = await openDetail(result.id);
    // Saved but not read back: the editor keeps what was sent (and, after a taken Publish, published); the price
    // reading stays the last one read until the next open.
    if (reread) {
      const held = afterSave(form, result.id, publish && !result.publishError);
      setOpen({ form: held, saved: held });
    }
    // A language that could not be saved keeps what was typed in the editor (unsaved), so the owner adds its price line.
    if (gaps.held.length > 0) {
      setOpen((was) => {
        if (!was) return was;
        const text = { ...was.form.text };
        for (const target of gaps.held) text[target] = form.text[target];
        return { ...was, form: { ...was.form, text } };
      });
    }
    if (gaps.kept.length > 0 || gaps.held.length > 0) setPriceGaps(gaps);
    await loadList();
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
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<PublishResult>("/api/ops/publish", { entity: "journey_tier", id: open.form.id, published: false });
    if (!reply.ok) setError(reply.error);
    else {
      setError(await openDetail(open.form.id));
      await loadList();
    }
    setBusy(false);
  }

  /** One order at a time: a second move waits until the list is read back. */
  function reorder(ids: string[]): boolean {
    if (moving.current) return false;
    moving.current = true;
    void sendOrder(ids);
    return true;
  }

  async function sendOrder(ids: string[]) {
    setReordering(true);
    const reply = await opsSend(PATH, { action: "reorder", ids });
    await loadList();
    if (!reply.ok) setListError(reply.error);
    moving.current = false;
    setReordering(false);
  }

  const shown: JourneyRow[] = rows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((row) => ({ id: row.id, name: row.name_en, priceLine: row.price_label_en, published: row.is_published }));

  return (
    <JourneysView
      rows={shown}
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
                setPriceGaps(null);
                setOpen((was) => (was ? { ...was, form } : was));
              },
              dirty: !sameForm(open.form, open.saved),
              busy,
              error,
              onSave,
              onPublish: () => persist(open.form, true),
              onUnpublish: () => void onUnpublish(),
              onClose: () => {
                if (busy) return;
                setOpen(null);
                setError(null);
                setPriceGaps(null);
              },
              priceGaps,
              send,
            }
          : null
      }
    />
  );
}

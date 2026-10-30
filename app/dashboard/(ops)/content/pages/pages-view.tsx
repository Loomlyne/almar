"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import type { Locale3, OpsError } from "../../../../../components/ops/api-types";
import { EditPage, type EditSection, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { MediaField, MediaListField } from "../../../../../components/ops/media-field";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { PlusIcon } from "../../../../../components/icons/icons";
import { Button } from "../../../../../components/ui/button";
import { Chip } from "../../../../../components/ui/chip";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { BackChevron, LINK_BUTTON, LINK_BUTTON_DANGER, RemoveMark } from "../../../../../components/ui/link";
import { Switch } from "../../../../../components/ui/switch";
import { PAGE_SECTIONS, type PageKey, type SectionTextColumn } from "../../../../../lib/data/page-sections";
import { DASHBOARD_COPY } from "../../../../../lib/copy/dashboard";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_PAGES_COPY, type OpsPagesCopy } from "../../../../../lib/copy/ops-pages";
import { focusMovedRow } from "../../catalog/move-focus";
import {
  CARD_TEXT_FIELDS,
  englishFields,
  isHero,
  liveCardFields,
  liveSectionFields,
  specOf,
  videoOk,
  type CardForm,
  type CardText,
  type SectionForm,
  type SectionText,
} from "./page-forms";

// Content -> Pages (plan 06-02, CMS-07, F-09; pictures signed 2026-10-27), driven entirely by props like TeamView: the
// wired screen (pages-screen.tsx) loads and saves; a harness scene passes data and no-ops. Three levels: the five pages,
// one page's sections in the site's order (fixed in code: no move control), and the editor of one section (kit
// EditPage). About's Our Story and Values sections hold cards, each with its own editor.

export type PageRow = { id: PageKey; name: string; shown: number; total: number };
export type SectionRow = { id: string; section: string; name: string; shown: boolean };
export type CardRow = { id: string; title: string; shown: boolean; position: number };

const fill = (line: string, values: Record<string, string | number>) => line.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));

/** Shown / Hidden as a static label (the Published chip's look; content with no publish step). */
export function ShownChip({ shown, copy }: { shown: boolean; copy: Pick<OpsPagesCopy, "shown" | "hidden"> }) {
  return (
    <Chip interactive={false} size="dense" on={shown}>
      {shown ? copy.shown : copy.hidden}
    </Chip>
  );
}

const SHORT = 300;
const LONG = 5000;
const LONG_COLUMNS: readonly SectionTextColumn[] = ["intro", "body", "statement", "paragraphs"];

/** The owner's label of a text column (paragraphs: "Paragraph {n}" per box). */
function columnLabel(copy: OpsPagesCopy, column: SectionTextColumn, n = 1): string {
  if (column === "paragraphs") return fill(copy.fields.paragraph, { n });
  return copy.fields[column];
}

export type SectionPanel = {
  form: SectionForm;
  /** The section as last saved: what the kit compares the English with, and what is live. */
  saved: SectionForm;
  onForm: (next: SectionForm) => void;
  dirty: boolean;
  busy: boolean;
  error: OpsError | null;
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  onClose: () => void;
  /** About story and values: the section's cards, in order. */
  cards?: CardRow[];
  onOpenCard?: (id: string) => void;
  onNewCard?: () => void;
  /** Takes a move; false when the screen refused it (an order is on its way). */
  onMoveCard?: (id: string, by: -1 | 1) => boolean | void;
  onDropCardOrder?: (ids: string[]) => void;
  reorderingCards?: boolean;
  send?: Send;
};

export type CardPanel = {
  form: CardForm;
  saved: CardForm;
  /** The section the card belongs to: the back link says it. */
  sectionName: string;
  onForm: (next: CardForm) => void;
  dirty: boolean;
  busy: boolean;
  error: OpsError | null;
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
  send?: Send;
};

export function PagesView({
  pages,
  page,
  sections,
  onOpenPage,
  onBackToPages,
  onOpenSection,
  panel,
  card,
  notice,
}: {
  pages: PageRow[];
  /** The page whose sections are listed, or null for the five pages. */
  page: PageKey | null;
  sections: SectionRow[];
  onOpenPage: (page: PageKey) => void;
  onBackToPages: () => void;
  onOpenSection: (id: string) => void;
  panel: SectionPanel | null;
  /** An About card open over its section (the section's editor waits behind it). */
  card: CardPanel | null;
  notice?: ReactNode;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_PAGES_COPY[loc];
  const kit = OPS_KIT_COPY[loc];
  const title = page ? copy.pageNames[page] : DASHBOARD_COPY[loc].rail.pages;

  const pageColumns: Column<PageRow>[] = [
    { key: "page", label: copy.colPage, phone: "title", render: (row) => row.name },
    { key: "shown", label: copy.colShown, phone: "meta", render: (row) => fill(copy.shownOf, { n: row.shown, m: row.total }) },
  ];
  const sectionColumns: Column<SectionRow>[] = [
    { key: "section", label: copy.colSection, phone: "title", render: (row) => row.name },
    { key: "shown", label: copy.colShown, phone: "meta", render: (row) => <ShownChip shown={row.shown} copy={copy} /> },
  ];

  const list = (
    <div className="flex min-w-0 flex-col gap-6">
      {page ? (
        <button
          type="button"
          onClick={onBackToPages}
          className={LINK_BUTTON}
        >
          <BackChevron />
          {DASHBOARD_COPY[loc].rail.pages}
        </button>
      ) : null}
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{title}</h1>
      {notice}
      {page ? (
        <>
          <p className="m-0 text-pretty text-label text-muted">{copy.orderNote}</p>
          <ListTable caption={title} columns={sectionColumns} rows={sections} onOpen={(row) => onOpenSection(row.id)} empty={null} />
        </>
      ) : (
        <ListTable caption={title} columns={pageColumns} rows={pages} onOpen={(row) => onOpenPage(row.id)} empty={null} />
      )}
    </div>
  );

  if (card) return <CardEditor panel={card} list={list} />;
  return <SectionEditor panel={panel} list={list} />;
}

/** The English text of one section, one Field per column; a paragraph list is one box per paragraph. */
function SectionText({ form, onForm, idBase, copy }: { form: SectionForm; onForm: (next: SectionForm) => void; idBase: string; copy: OpsPagesCopy }) {
  const spec = specOf(form);
  if (!spec) return null;
  const setEn = (column: SectionTextColumn, value: string | string[]) => onForm({ ...form, text: { ...form.text, en: { ...form.text.en, [column]: value } } });
  return (
    <>
      {spec.text.map((column) => {
        const value = form.text.en[column];
        const common = { className: "max-w-none", lang: "en", dir: "ltr" as const };
        if (column === "paragraphs") {
          const items = Array.isArray(value) ? value : [];
          return items.map((item, i) => (
            <Field
              key={`${column}-${i}`}
              {...common}
              id={`${idBase}-en-${column}-${i}`}
              label={columnLabel(copy, column, i + 1)}
              multiline
              rows={5}
              maxLength={LONG}
              value={item}
              onChange={(event: { target: { value: string } }) => setEn(column, items.map((was, at) => (at === i ? event.target.value : was)))}
            />
          ));
        }
        const text = typeof value === "string" ? value : "";
        const long = LONG_COLUMNS.includes(column);
        return long ? (
          <Field
            key={column}
            {...common}
            id={`${idBase}-en-${column}`}
            label={columnLabel(copy, column)}
            multiline
            rows={5}
            maxLength={LONG}
            value={text}
            onChange={(event: { target: { value: string } }) => setEn(column, event.target.value)}
          />
        ) : (
          <Field
            key={column}
            {...common}
            id={`${idBase}-en-${column}`}
            label={columnLabel(copy, column)}
            autoComplete="off"
            maxLength={SHORT}
            value={text}
            onChange={(event: { target: { value: string } }) => setEn(column, event.target.value)}
          />
        );
      })}
    </>
  );
}

function SectionEditor({ panel, list }: { panel: SectionPanel | null; list: ReactNode }) {
  const loc = useDashboardLocale();
  const copy = OPS_PAGES_COPY[loc];
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const cardsRef = useRef<HTMLDivElement>(null);
  const moved = useRef<{ name: string; by: -1 | 1 } | null>(null);
  const reordering = panel?.reorderingCards ?? false;
  useEffect(() => {
    if (reordering || !moved.current) return;
    focusMovedRow(cardsRef.current, moved.current.name, moved.current.by, { up: kit.moveUp, down: kit.moveDown });
    moved.current = null;
  }, [reordering]); // eslint-disable-line react-hooks/exhaustive-deps

  const form = panel?.form ?? null;
  const spec = form ? specOf(form) : undefined;
  const hero = form ? isHero(form.page, form.section) : false;
  const sectionName = form ? (copy.sections[form.page][form.section] ?? form.section) : "";
  const videoBad = form && spec?.video ? !videoOk(form.video) : false;

  function sections(panel: SectionPanel, form: SectionForm): EditSection[] {
    const { onForm } = panel;
    const out: EditSection[] = [];
    if (spec && spec.text.length > 0) {
      out.push({ key: "text", title: kit.editor.sections.text, translatable: true, content: <SectionText form={form} onForm={onForm} idBase={idBase} copy={copy} /> });
    }
    if (spec && spec.media.length > 0) {
      out.push({
        key: "photos",
        title: spec.media.some((slot) => slot.many) ? copy.photos : copy.photo,
        content: (
          <>
            {spec.media.map((slot) => {
              const label = copy.slots[slot.slot] ?? copy.photo;
              const value = form.media[slot.slot] ?? [];
              const setSlot = (next: typeof value) => onForm({ ...form, media: { ...form.media, [slot.slot]: next } });
              return (
                <div key={slot.slot} className="flex flex-col gap-2">
                  {slot.many ? (
                    <MediaListField id={`${idBase}-media-${slot.slot}`} label={label} value={value} onChange={setSlot} locale={loc} />
                  ) : (
                    <MediaField id={`${idBase}-media-${slot.slot}`} label={label} value={value[0] ?? null} onChange={(photo) => setSlot(photo ? [photo] : [])} locale={loc} />
                  )}
                  {slot.decorative ? <p className="m-0 text-pretty text-label text-muted">{copy.decorative}</p> : null}
                </div>
              );
            })}
          </>
        ),
      });
    }
    if (spec?.video) {
      out.push({
        key: "video",
        title: copy.videoSec,
        content: (
          <Field
            id={`${idBase}-video`}
            label={copy.video}
            className="max-w-none"
            type="url"
            inputMode="url"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            maxLength={500}
            value={form.video}
            error={videoBad ? copy.videoBad : undefined}
            onChange={(event: { target: { value: string } }) => onForm({ ...form, video: event.target.value })}
          />
        ),
      });
    }
    if (spec?.items && panel.cards) {
      const cards = panel.cards;
      const cardColumns: Column<CardRow>[] = [
        { key: "title", label: copy.fields.title, phone: "title", render: (row) => row.title },
        { key: "shown", label: copy.colShown, phone: "meta", render: (row) => <ShownChip shown={row.shown} copy={copy} /> },
      ];
      const add = (
        <Button variant="secondary" onClick={() => panel.onNewCard?.()}>
          <PlusIcon size={16} aria-hidden="true" />
          {copy.addCard}
        </Button>
      );
      out.push({
        key: "cards",
        title: copy.cards,
        content: (
          <div ref={cardsRef} className="flex min-w-0 flex-col gap-4" aria-busy={reordering || undefined}>
            <ListTable
              caption={copy.cards}
              columns={cardColumns}
              rows={cards}
              onOpen={(row) => panel.onOpenCard?.(row.id)}
              reorder={{
                onMove: (id, by) => {
                  const name = cards.find((row) => row.id === id)?.title ?? "";
                  if (panel.onMoveCard?.(id, by) !== false) moved.current = { name, by };
                },
                onDropOrder: (ids) => panel.onDropCardOrder?.(ids),
              }}
              empty={null}
            />
            <div>{add}</div>
          </div>
        ),
      });
    }
    out.push({
      key: "settings",
      title: kit.editor.sections.settings,
      column: "side",
      content: hero ? (
        <p className="m-0 text-pretty text-label text-ink">{copy.heroFixed}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <Switch label={copy.showOnSite} checked={form.shown} onCheckedChange={(shown) => onForm({ ...form, shown })} />
          {form.shown ? null : <p className="m-0 text-label text-muted">{copy.hiddenNote}</p>}
        </div>
      ),
    });
    return out;
  }

  const english = form ? englishFields(form.text.en) : {};
  const columns = spec?.text ?? [];

  return (
    <EditPage
      openKey={panel && form ? form.id : null}
      list={list}
      backLabel={form ? copy.pageNames[form.page] : ""}
      onClose={() => panel?.onClose()}
      title={sectionName}
      isPublished
      status={form ? <ShownChip shown={hero || form.shown} copy={copy} /> : undefined}
      dirty={panel?.dirty ?? false}
      busy={panel?.busy ?? false}
      canSave={!videoBad}
      missing={[]}
      error={panel?.error ?? null}
      fieldLabel={(field) =>
        field === "video_url" ? copy.video : (columns as readonly string[]).includes(field) ? columnLabel(copy, field as SectionTextColumn) : undefined
      }
      english={english}
      savedEnglish={panel ? englishFields(panel.saved.text.en) : {}}
      translations={form ? { ar: englishFields(form.text.ar), es: englishFields(form.text.es) } : { ar: {}, es: {} }}
      locked={form?.locked}
      translationFields={columns.map((column) => ({
        name: column,
        label: columnLabel(copy, column),
        multiline: LONG_COLUMNS.includes(column),
        maxLength: LONG_COLUMNS.includes(column) ? LONG : SHORT,
      }))}
      onTranslationChange={(target, name, value) => {
        if (!panel || !form) return;
        const next: SectionText = { ...form.text[target], [name]: name === "paragraphs" ? (Array.isArray(value) ? value : value.split("\n")) : Array.isArray(value) ? value.join(" ") : value };
        panel.onForm({ ...form, text: { ...form.text, [target]: next } });
      }}
      onSave={(payload, intent) => (panel ? panel.onSave(payload, intent) : Promise.resolve(false))}
      liveTranslations={panel ? liveSectionFields(panel.saved) : {}}
      holdOnFailure
      send={panel?.send}
      sections={panel && form ? sections(panel, form) : []}
    />
  );
}

const cardEnglish = (text: CardText) => Object.fromEntries(CARD_TEXT_FIELDS.map((field) => [field, text[field]]));

/** One About card (title, text, photo, Show on site, Delete card), on the kit editor. */
function CardEditor({ panel, list }: { panel: CardPanel; list: ReactNode }) {
  const loc: Locale3 = useDashboardLocale();
  const copy = OPS_PAGES_COPY[loc];
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const [asking, setAsking] = useState(false);
  const { form, onForm } = panel;
  const title = form.text.en.title.trim() || copy.addCard;
  const labels: Record<(typeof CARD_TEXT_FIELDS)[number], string> = { title: copy.fields.title, body: copy.fields.body };

  const sections: EditSection[] = [
    {
      key: "text",
      title: kit.editor.sections.text,
      translatable: true,
      content: (
        <>
          <Field
            id={`${idBase}-en-title`}
            label={labels.title}
            className="max-w-none"
            lang="en"
            dir="ltr"
            autoComplete="off"
            required
            maxLength={SHORT}
            value={form.text.en.title}
            onChange={(event: { target: { value: string } }) => onForm({ ...form, text: { ...form.text, en: { ...form.text.en, title: event.target.value } } })}
          />
          <Field
            id={`${idBase}-en-body`}
            label={labels.body}
            className="max-w-none"
            lang="en"
            dir="ltr"
            multiline
            rows={6}
            maxLength={LONG}
            value={form.text.en.body}
            onChange={(event: { target: { value: string } }) => onForm({ ...form, text: { ...form.text, en: { ...form.text.en, body: event.target.value } } })}
          />
        </>
      ),
    },
    {
      key: "photo",
      title: kit.editor.sections.photo,
      content: <MediaField id={`${idBase}-photo`} label={copy.photo} value={form.image} onChange={(image) => onForm({ ...form, image })} locale={loc} />,
    },
    {
      key: "settings",
      title: kit.editor.sections.settings,
      column: "side",
      content: (
        <div className="flex flex-col gap-4">
          <Switch label={copy.showOnSite} checked={form.shown} onCheckedChange={(shown) => onForm({ ...form, shown })} />
          {form.id ? (
            <div className="border-t border-line pt-4">
              <button type="button" className={LINK_BUTTON_DANGER} disabled={panel.busy} onClick={() => setAsking(true)}>
                <RemoveMark />
                {copy.deleteCard}
              </button>
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <EditPage
        openKey={form.id ?? "new-card"}
        list={list}
        backLabel={panel.sectionName}
        onClose={panel.onClose}
        title={title}
        isNew={form.id === null}
        isPublished
        status={<ShownChip shown={form.shown} copy={copy} />}
        dirty={panel.dirty}
        busy={panel.busy}
        canSave={form.text.en.title.trim() !== ""}
        missing={[]}
        error={panel.error}
        fieldLabel={(field) => (field in labels ? labels[field as keyof typeof labels] : undefined)}
        english={cardEnglish(form.text.en)}
        savedEnglish={cardEnglish(panel.saved.text.en)}
        translations={{ ar: cardEnglish(form.text.ar), es: cardEnglish(form.text.es) }}
        locked={form.locked}
        translationFields={CARD_TEXT_FIELDS.map((field) => ({ name: field, label: labels[field], multiline: field === "body", maxLength: field === "body" ? LONG : SHORT }))}
        onTranslationChange={(target, name, value) => {
          const text = Array.isArray(value) ? value.join(" ") : value;
          onForm({ ...form, text: { ...form.text, [target]: { ...form.text[target], [name]: text } } });
        }}
        onSave={panel.onSave}
        liveTranslations={liveCardFields(panel.saved.shown, panel.saved.text)}
        holdOnFailure={panel.saved.shown && panel.saved.id !== null}
        send={panel.send}
        sections={sections}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={copy.deleteCardTitle}
        description={copy.deleteCardText}
        confirmLabel={kit.delete}
        cancelLabel={kit.cancel}
        onConfirm={() => {
          setAsking(false);
          panel.onDelete();
        }}
      />
    </>
  );
}

/** The pages in the list's order, with their owner names (PAGE_SECTIONS's keys). */
export const PAGE_ORDER = Object.keys(PAGE_SECTIONS) as PageKey[];

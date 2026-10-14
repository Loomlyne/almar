"use client";

import { useId, type ReactNode } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import { EditPage, type EditSection, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { MediaField } from "../../../../../components/ops/media-field";
import { missingForPublish } from "../../../../../components/ops/publish-check";
import { StatusChip } from "../../../../../components/ops/status-chip";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import type { Locale3, OpsError } from "../../../../../components/ops/api-types";
import { Field } from "../../../../../components/ui/field";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_TEAM_COPY } from "../../../../../lib/copy/ops-team";
import { JOURNEY_TEXT_FIELDS, liveJourneyFields, priceReading, type JourneyForm, type JourneyText, type JourneyTextField } from "./journey-forms";

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
}: {
  rows: JourneyRow[];
  onOpen: (id: string) => void;
  onMove: (id: string, by: -1 | 1) => void;
  onDropOrder: (ids: string[]) => void;
  panel: JourneyPanel | null;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_TEAM_COPY[loc].journeys;

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
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
      <p className="m-0 max-w-prose text-pretty text-label text-ink">{copy.intro}</p>
      <ListTable
        caption={copy.caption}
        columns={columns}
        rows={rows}
        onOpen={(row) => onOpen(row.id)}
        reorder={{ onMove, onDropOrder }}
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
      canSave={form ? form.text.en.name.trim() !== "" && form.text.en.price_label.trim() !== "" : false}
      missing={missing}
      error={panel?.error ?? null}
      fieldLabel={(field) => (field in fieldLabels ? fieldLabels[field as JourneyTextField] : undefined)}
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

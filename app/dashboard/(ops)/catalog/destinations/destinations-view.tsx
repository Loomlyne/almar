"use client";

import { useId, useState, type ReactNode } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import { ConnectPicker } from "../../../../../components/ops/connect-picker";
import { EditPage, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { MediaField } from "../../../../../components/ops/media-field";
import { missingLine } from "../../../../../components/ops/error-text";
import { missingForPublish } from "../../../../../components/ops/publish-check";
import { StatusChip } from "../../../../../components/ops/status-chip";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import type { Locale3, OpsError, PublishWarningCode } from "../../../../../components/ops/api-types";
import { Button } from "../../../../../components/ui/button";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { foldText } from "../../../../../lib/data/stay-filter";
import { OPS_CATALOG_COPY, fillCatalogCopy } from "../../../../../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { DESTINATION_TEXT_FIELDS, liveFields, liveGaps, type DestinationForm, type DestinationText } from "../catalog-forms";
import { LockedAddress } from "../locked-address";

export type DestinationRow = { id: string; name: string; stayCount: number; published: boolean };
export type DestinationStay = { id: string; name: string; published: boolean };
export type ItemOption = { id: string; label: string; meta?: string };

export type DestinationPanel = {
  form: DestinationForm;
  /** The text of the three languages as last saved: what the kit compares the English with, and what is live. */
  saved: Record<Locale3, DestinationText>;
  onForm: (next: DestinationForm) => void;
  dirty: boolean;
  busy: boolean;
  /** The destination's own stays (read-only: a stay's destination is set in the stay's Details). */
  stays: DestinationStay[];
  /** Every experience and service, for the connect picker. */
  items: ItemOption[];
  /** The items connected at destination level. */
  connectedIds: string[];
  onConnectedChange: (ids: string[]) => void;
  /** The Connections card's own line: a refused removal, or a connect that stopped partway. */
  connectNote?: string | null;
  warnings: PublishWarningCode[];
  error: OpsError | null;
  /** The kit's Save: the English as typed plus the Arabic and Spanish it filled; resolves true when the server took it. */
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  onPublish: () => void | Promise<unknown>;
  onUnpublish: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** Test seam for the translate request (the kit's opsSend by default). */
  send?: Send;
};

/**
 * The Destinations list and the destination's editor page (canvas DashDestinations; kit panel B, owner 2026-10-14),
 * driven entirely by props: the wired screen (Task 2) loads the rows and the detail and passes the handlers; the harness
 * scene passes bracket data and no-ops. The search is this view's own state.
 */
export function DestinationsView({
  rows,
  onNew,
  onOpen,
  onMove,
  onDropOrder,
  panel,
  initialQuery = "",
  reordering = false,
  notice,
}: {
  rows: DestinationRow[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onMove: (id: string, by: -1 | 1) => void;
  onDropOrder: (ids: string[]) => void;
  panel: DestinationPanel | null;
  initialQuery?: string;
  /** An order is on its way: the move buttons wait until the list is read back. */
  reordering?: boolean;
  /** A line of the screen's own under the title, such as a list that did not load. */
  notice?: ReactNode;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].destinations;
  const kit = OPS_KIT_COPY[loc];
  const searchId = useId();
  const [query, setQuery] = useState(initialQuery);

  const needle = foldText(query.trim());
  const shown = needle === "" ? rows : rows.filter((row) => foldText(row.name).includes(needle));

  const columns: Column<DestinationRow>[] = [
    { key: "name", label: copy.colName, phone: "title", render: (row) => row.name },
    { key: "stays", label: copy.colStays, phone: "meta", render: (row) => row.stayCount },
    { key: "status", label: copy.colStatus, phone: "meta", render: (row) => <StatusChip published={row.published} locale={loc} /> },
  ];

  const list = (
    <div className="flex min-w-0 flex-col gap-6" aria-busy={reordering || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
        <Button onClick={onNew}>{copy.newDestination}</Button>
      </div>
      {notice}
      {rows.length > 0 ? <Field id={searchId} label={copy.search} search autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} /> : null}
      {/* While an order is on its way the list's buttons wait (a disabled fieldset; the kit's table is not changed). */}
      <fieldset disabled={reordering} className="m-0 min-w-0 border-0 p-0">
      <ListTable
        caption={copy.caption}
        columns={columns}
        rows={shown}
        onOpen={(row) => onOpen(row.id)}
        // Moving a row inside a filtered list would change an order the owner cannot see: no reorder while searching.
        reorder={needle === "" ? { onMove, onDropOrder } : undefined}
        empty={
          rows.length === 0 ? (
            <div className="flex flex-col items-start gap-2">
              <p className="m-0 text-pretty text-body text-ink">{copy.empty}</p>
              <Button onClick={onNew}>{copy.newDestination}</Button>
            </div>
          ) : (
            <p className="m-0 text-body text-ink">{kit.noResults}</p>
          )
        }
      />
      </fieldset>
    </div>
  );

  return <DestinationEditor panel={panel} list={list} />;
}

const englishOf = (text: DestinationText) => Object.fromEntries(DESTINATION_TEXT_FIELDS.map((field) => [field, text[field]]));

/**
 * The destination's editor page (kit EditPage, option B as the item editor): Text, Photo and Connections (the
 * destination-level experiences and services) on the left; Settings and its Stays on the right; one column on a phone.
 * Maria writes English only; the kit fills Arabic and Spanish on Save. Delete waits until the stays are moved; the kit
 * says "Unpublish first" on a published one. With no destination open the page shows the list.
 */
function DestinationEditor({ panel, list }: { panel: DestinationPanel | null; list: ReactNode }) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].destinations;
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const [asking, setAsking] = useState(false);

  const form = panel?.form ?? null;
  const title = form?.text.en.name || copy.newDestination;
  const slugError = panel?.error?.field === "slug" && panel.error.code !== "invalid" ? kit.errors.slug_taken : undefined;
  const staysLeft = (panel?.stays.length ?? 0) > 0;
  const fieldLabels: Record<(typeof DESTINATION_TEXT_FIELDS)[number], string> = {
    name: copy.fieldName,
    short_line: copy.fieldShortLine,
    region: copy.fieldRegion,
    summary: copy.fieldDescription,
    nights_label: copy.fieldNightsLine,
  };

  function sections(panel: DestinationPanel, form: DestinationForm) {
    const { onForm } = panel;
    const english = (field: (typeof DESTINATION_TEXT_FIELDS)[number], extra?: { multiline?: boolean; required?: boolean }) => {
      const common = {
        id: `${idBase}-en-${field}`,
        label: fieldLabels[field],
        className: "max-w-none",
        lang: "en",
        dir: "ltr",
        value: form.text.en[field],
        required: extra?.required,
        onChange: (event: { target: { value: string } }) => onForm({ ...form, text: { ...form.text, en: { ...form.text.en, [field]: event.target.value } } }),
      };
      return extra?.multiline ? <Field {...common} multiline rows={5} /> : <Field {...common} autoComplete="off" />;
    };

    const all = [
      {
        key: "text",
        title: kit.editor.sections.text,
        translatable: true,
        content: (
          <>
            {english("name", { required: true })}
            {english("short_line")}
            {english("region")}
            {english("summary", { multiline: true })}
            {english("nights_label")}
          </>
        ),
      },
      {
        key: "photo",
        title: kit.editor.sections.photo,
        content: (
          <>
            <MediaField id={`${idBase}-hero`} label={copy.fieldPhoto} required value={form.hero} onChange={(hero) => onForm({ ...form, hero })} locale={loc} />
            <MediaField id={`${idBase}-inset`} label={copy.fieldInsetPhoto} value={form.inset} onChange={(inset) => onForm({ ...form, inset })} locale={loc} />
          </>
        ),
      },
      {
        key: "connections",
        title: kit.editor.sections.connections,
        content: (
          <>
            <ConnectPicker
              title={copy.experiencesTitle}
              searchLabel={copy.experiencesSearch}
              hint={copy.experiencesHint}
              options={panel.items}
              connected={panel.connectedIds}
              onChange={panel.onConnectedChange}
            />
            {panel.connectNote ? (
              <p role="alert" className="m-0 text-label text-error">
                {panel.connectNote}
              </p>
            ) : null}
          </>
        ),
      },
      {
        key: "settings",
        title: kit.editor.sections.settings,
        column: "side" as const,
        content: (
          form.published ? (
            <LockedAddress label={copy.fieldSlug} value={form.slug} note={copy.slugLocked} />
          ) : (
            <Field
              id={`${idBase}-slug`}
              label={copy.fieldSlug}
              className="max-w-none"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              value={form.slug}
              hint={copy.slugHint}
              error={slugError}
              onChange={(event) => onForm({ ...form, slug: event.target.value })}
            />
          )
        ),
      },
      {
        key: "stays",
        title: `${copy.tabStays} (${panel.stays.length})`,
        column: "side" as const,
        content: (
          <>
            <p className="m-0 text-label text-muted">{copy.staysNote}</p>
            {panel.stays.length > 0 ? (
              <ul className="m-0 flex list-none flex-col border border-line p-0" aria-label={copy.tabStays}>
                {panel.stays.map((stay) => (
                  <li key={stay.id} className="flex items-center justify-between gap-2 border-b border-line px-2 py-2 text-label text-ink last:border-b-0">
                    <span className="min-w-0">{stay.name}</span>
                    <StatusChip published={stay.published} locale={loc} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-label text-ink">{copy.staysNone}</p>
            )}
          </>
        ),
      },
    ];
    // A new destination has no stays and no connections yet: only what it is made of.
    return form.id === null ? all.filter((section) => section.key !== "stays" && section.key !== "connections") : all;
  }

  const missing = form ? missingForPublish("destination", { translations: form.text, media_id: form.hero?.id ?? null }) : [];
  const fieldLabel = (field: string) =>
    field === "slug" ? copy.fieldSlug.toLocaleLowerCase(loc) : field in fieldLabels ? fieldLabels[field as keyof typeof fieldLabels] : undefined;
  // On a published destination, Save waits while a fact Publish needs is gone (the server's save does not check it).
  const live = liveGaps(form?.published ?? false, missing);
  const liveNote =
    live.length > 0 ? (
      <p role="status" className="m-0 text-label text-ink">
        {fillCatalogCopy(copy.liveNeeds, { list: live.map((gap) => missingLine(kit, gap, fieldLabel)).join(", ") })}
      </p>
    ) : null;

  return (
    <>
      <EditPage
        openKey={panel && form ? (form.id ?? "new") : null}
        list={list}
        backLabel={copy.title}
        onClose={() => panel?.onClose()}
        title={title}
        isNew={form?.id === null}
        isPublished={form?.published ?? false}
        dirty={panel?.dirty ?? false}
        busy={panel?.busy ?? false}
        missing={missing}
        warnings={panel?.warnings ?? []}
        error={slugError ? null : (panel?.error ?? null)}
        fieldLabel={fieldLabel}
        canSave={live.length === 0}
        notice={liveNote}
        english={form ? englishOf(form.text.en) : {}}
        savedEnglish={panel ? englishOf(panel.saved.en) : {}}
        translations={form ? { ar: englishOf(form.text.ar), es: englishOf(form.text.es) } : { ar: {}, es: {} }}
        translationFields={DESTINATION_TEXT_FIELDS.map((field) => ({ name: field, label: fieldLabels[field], multiline: field === "summary" }))}
        onTranslationChange={(target, name, value) => {
          if (!panel || !form) return;
          const text = Array.isArray(value) ? value.join(" ") : value;
          panel.onForm({ ...form, text: { ...form.text, [target]: { ...form.text[target], [name]: text } } });
        }}
        onSave={(payload, intent) => (panel ? panel.onSave(payload, intent) : Promise.resolve(false))}
        onPublish={() => panel?.onPublish()}
        onUnpublish={() => panel?.onUnpublish()}
        onDelete={() => setAsking(true)}
        deleteLabel={copy.deleteDestination}
        deleteDisabled={staysLeft}
        deleteNote={staysLeft ? copy.deleteNeedsMove : undefined}
        // A published destination is on the site in the languages it was published in; one in use is a published one.
        liveTranslations={panel && form ? liveFields(form.published, form.status, panel.saved) : {}}
        holdOnFailure={form?.published ?? false}
        send={panel?.send}
        sections={panel && form ? sections(panel, form) : []}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={fillCatalogCopy(copy.deleteTitle, { name: title })}
        confirmLabel={kit.delete}
        cancelLabel={kit.cancel}
        onConfirm={() => {
          setAsking(false);
          panel?.onDelete();
        }}
      />
    </>
  );
}

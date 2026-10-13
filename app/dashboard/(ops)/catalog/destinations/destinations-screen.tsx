"use client";

import { useId, useState } from "react";
import { ConnectPicker } from "../../../../../components/ops/connect-picker";
import { EditPanel } from "../../../../../components/ops/edit-panel";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { LocaleTabs } from "../../../../../components/ops/locale-tabs";
import { MediaField } from "../../../../../components/ops/media-field";
import { PublishBar } from "../../../../../components/ops/publish-bar";
import { missingForPublish } from "../../../../../components/ops/publish-check";
import { StatusChip } from "../../../../../components/ops/status-chip";
import { TranslateButton } from "../../../../../components/ops/translate-button";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import type { Locale3, OpsError, PublishWarningCode } from "../../../../../components/ops/api-types";
import { Button } from "../../../../../components/ui/button";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { foldText } from "../../../../../lib/data/stay-filter";
import { OPS_CATALOG_COPY, fillCatalogCopy } from "../../../../../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { DESTINATION_TEXT_FIELDS, applyDrafts, translationStates, type DestinationForm } from "../catalog-forms";

export type DestinationRow = { id: string; name: string; stayCount: number; published: boolean };
export type DestinationStay = { id: string; name: string; published: boolean };
export type ItemOption = { id: string; label: string; meta?: string };
export type DestinationTab = "details" | "stays" | "experiences";

export type DestinationPanel = {
  form: DestinationForm;
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
  warnings: PublishWarningCode[];
  error: OpsError | null;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onClose: () => void;
};

/**
 * The Destinations list and its side panel (canvas DashDestinations), driven entirely by props: the wired screen
 * (Task 2) loads the rows and the detail and passes the handlers; the harness scene passes bracket data and no-ops.
 * The tab, the chosen language and the search are this view's own state.
 */
export function DestinationsView({
  rows,
  onNew,
  onOpen,
  onMove,
  onDropOrder,
  panel,
  initialTab = "details",
  initialLocale = "en",
  initialQuery = "",
  initialConfirmDelete = false,
}: {
  rows: DestinationRow[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onMove: (id: string, by: -1 | 1) => void;
  onDropOrder: (ids: string[]) => void;
  panel: DestinationPanel | null;
  initialTab?: DestinationTab;
  initialLocale?: Locale3;
  initialQuery?: string;
  initialConfirmDelete?: boolean;
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

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
        <Button onClick={onNew}>{copy.newDestination}</Button>
      </div>
      {rows.length > 0 ? <Field id={searchId} label={copy.search} search autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} /> : null}
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
      {panel ? (
        <DestinationPanelView
          key={panel.form.id ?? "new"}
          panel={panel}
          initialTab={initialTab}
          initialLocale={initialLocale}
          initialConfirmDelete={initialConfirmDelete}
        />
      ) : null}
    </div>
  );
}

function DestinationPanelView({
  panel,
  initialTab,
  initialLocale,
  initialConfirmDelete,
}: {
  panel: DestinationPanel;
  initialTab: DestinationTab;
  initialLocale: Locale3;
  initialConfirmDelete: boolean;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].destinations;
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const { form, onForm } = panel;
  const isNew = form.id === null;
  const [tab, setTab] = useState<DestinationTab>(isNew ? "details" : initialTab);
  const [locale, setLocale] = useState<Locale3>(initialLocale);
  const [asking, setAsking] = useState(initialConfirmDelete);

  const missing = missingForPublish("destination", { translations: form.text, media_id: form.hero?.id ?? null });
  const states = translationStates(form);
  const hasExisting = DESTINATION_TEXT_FIELDS.some((f) => form.text.ar[f] !== "" || form.text.es[f] !== "");
  const deleteReason = form.published ? copy.deleteNeedsUnpublish : panel.stays.length > 0 ? copy.deleteNeedsMove : null;
  const title = form.text.en.name || copy.newDestination;
  const slugLocked = form.published;
  const slugError = panel.error?.field === "slug" && panel.error.code !== "invalid" ? kit.errors.slug_taken : undefined;

  function setText(field: (typeof DESTINATION_TEXT_FIELDS)[number], value: string) {
    onForm({ ...form, text: { ...form.text, [locale]: { ...form.text[locale], [field]: value } } });
  }

  function textField(field: (typeof DESTINATION_TEXT_FIELDS)[number], label: string, extra?: { multiline?: boolean; required?: boolean }) {
    const common = {
      id: `${idBase}-${locale}-${field}`,
      label,
      className: "max-w-none",
      value: form.text[locale][field],
      required: extra?.required,
      onChange: (event: { target: { value: string } }) => setText(field, event.target.value),
    };
    return extra?.multiline ? <Field {...common} multiline rows={5} /> : <Field {...common} />;
  }

  const details = (
    <>
      <LocaleTabs
        value={locale}
        onChange={setLocale}
        state={states}
        checked={{ ar: form.status.ar === "published", es: form.status.es === "published" }}
        onCheckedChange={(target, checked) => onForm({ ...form, status: { ...form.status, [target]: checked ? "published" : "draft" } })}
        toolbar={
          <TranslateButton
            source={Object.fromEntries(DESTINATION_TEXT_FIELDS.map((f) => [f, form.text.en[f]]))}
            hasExisting={hasExisting}
            onDrafts={(target, fields) => onForm({ ...form, ...applyDrafts(form, target, fields) })}
            locale={loc}
          />
        }
      >
        {textField("name", copy.fieldName, { required: true })}
        {textField("short_line", copy.fieldShortLine)}
        {textField("region", copy.fieldRegion)}
        {textField("summary", copy.fieldDescription, { multiline: true })}
        {textField("nights_label", copy.fieldNightsLine)}
      </LocaleTabs>
      <MediaField id={`${idBase}-hero`} label={copy.fieldPhoto} required value={form.hero} onChange={(hero) => onForm({ ...form, hero })} locale={loc} />
      <MediaField id={`${idBase}-inset`} label={copy.fieldInsetPhoto} value={form.inset} onChange={(inset) => onForm({ ...form, inset })} locale={loc} />
      <Field
        id={`${idBase}-slug`}
        label={copy.fieldSlug}
        className="max-w-none"
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        value={form.slug}
        readOnly={slugLocked}
        hint={slugLocked ? copy.slugLocked : copy.slugHint}
        error={slugError}
        onChange={(event) => onForm({ ...form, slug: event.target.value })}
      />
      {!isNew ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              disabled={panel.busy || deleteReason !== null}
              aria-describedby={deleteReason ? `${idBase}-delete-reason` : undefined}
              onClick={() => setAsking(true)}
            >
              {copy.deleteDestination}
            </Button>
            {deleteReason ? (
              <span id={`${idBase}-delete-reason`} className="text-label text-muted">
                {deleteReason}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );

  const stays = (
    <div className="flex flex-col gap-4">
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
    </div>
  );

  const experiences = (
    <ConnectPicker
      title={copy.experiencesTitle}
      searchLabel={copy.experiencesSearch}
      hint={copy.experiencesHint}
      options={panel.items}
      connected={panel.connectedIds}
      onChange={panel.onConnectedChange}
    />
  );

  const tabs = isNew
    ? [{ key: "details", label: copy.tabDetails }]
    : [
        { key: "details", label: copy.tabDetails },
        { key: "stays", label: `${copy.tabStays} (${panel.stays.length})` },
        { key: "experiences", label: copy.tabExperiences },
      ];

  return (
    <>
      <EditPanel
        open
        onOpenChange={(open) => {
          if (!open) panel.onClose();
        }}
        title={title}
        tabs={tabs}
        tab={tab}
        onTabChange={(key) => setTab(key as DestinationTab)}
        dirty={panel.dirty}
        footer={
          <PublishBar
            isNew={isNew}
            isPublished={form.published}
            dirty={panel.dirty}
            busy={panel.busy}
            missing={missing}
            warnings={panel.warnings}
            onSave={panel.onSave}
            onPublish={panel.onPublish}
            onUnpublish={panel.onUnpublish}
            error={panel.error?.field === "slug" ? null : panel.error}
            fieldLabel={(field) => (field === "slug" ? copy.fieldSlug.toLocaleLowerCase(loc) : undefined)}
          />
        }
      >
        {tab === "stays" ? stays : tab === "experiences" ? experiences : details}
      </EditPanel>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={fillCatalogCopy(copy.deleteTitle, { name: title })}
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

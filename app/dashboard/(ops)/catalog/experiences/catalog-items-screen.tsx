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
import type { CatalogKind, CatalogUnit, Locale3, OpsError, PublishWarningCode } from "../../../../../components/ops/api-types";
import { Checkbox } from "../../../../../components/ui/checkbox";
import { Button } from "../../../../../components/ui/button";
import { Chip } from "../../../../../components/ui/chip";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { Select } from "../../../../../components/ui/select";
import { OPS_CATALOG_COPY, fillCatalogCopy } from "../../../../../lib/copy/ops-catalog";
import { OPS_KIT_COPY, fillCopy } from "../../../../../lib/copy/ops-kit";
import { formatPlural } from "../../../../../lib/journey-format";
import {
  CATALOG_TEXT_FIELDS,
  NO_CATALOG_FILTER,
  applyDrafts,
  filterCatalogRows,
  translationStates,
  type CatalogFilter,
  type CatalogItemForm,
} from "../catalog-forms";

/** One row of the list. `priceText` is already formatted ("AED 1,250.00") or null for "not set". */
export type CatalogRow = {
  id: string;
  name: string;
  kind: CatalogKind;
  unit: CatalogUnit;
  priceText: string | null;
  destinationIds: string[];
  stayIds: string[];
  stayCount: number;
  published: boolean;
  position: number;
};
export type PickOption = { id: string; label: string; meta?: string };
export type CatalogTab = "details" | "connections";

export type CatalogPanel = {
  form: CatalogItemForm;
  onForm: (next: CatalogItemForm) => void;
  dirty: boolean;
  busy: boolean;
  destinations: PickOption[];
  stays: PickOption[];
  warnings: PublishWarningCode[];
  error: OpsError | null;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onClose: () => void;
};

const ALL = "all";

/**
 * The Experiences and services list and its side panel (canvas DashServices), driven entirely by props, as
 * DestinationsView. Filters, search, tab and language are this view's own state.
 */
export function CatalogItemsView({
  rows,
  destinations,
  stays,
  onNew,
  onOpen,
  onMove,
  onDropOrder,
  panel,
  initialTab = "details",
  initialLocale = "en",
  initialFilter = NO_CATALOG_FILTER,
  initialConfirmDelete = false,
}: {
  rows: CatalogRow[];
  destinations: PickOption[];
  stays: PickOption[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onMove: (id: string, by: -1 | 1) => void;
  onDropOrder: (ids: string[]) => void;
  panel: CatalogPanel | null;
  initialTab?: CatalogTab;
  initialLocale?: Locale3;
  initialFilter?: CatalogFilter;
  initialConfirmDelete?: boolean;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].items;
  const searchId = useId();
  const [filter, setFilter] = useState<CatalogFilter>(initialFilter);
  const dir = loc === "ar" ? "rtl" : "ltr";

  const shown = filterCatalogRows(rows, filter);
  const filtering = filter.kind !== "" || filter.destinationId !== "" || filter.stayId !== "" || filter.query.trim() !== "";
  const unitWords: Record<CatalogUnit, string> = { person: copy.unitPerson, night: copy.unitNight, trip: copy.unitTrip };
  const kindWords: Record<CatalogKind, string> = { experience: copy.kindExperience, service: copy.kindService };

  const columns: Column<CatalogRow>[] = [
    { key: "name", label: copy.colName, phone: "title", render: (row) => row.name },
    { key: "type", label: copy.colType, phone: "meta", render: (row) => kindWords[row.kind] },
    { key: "unit", label: copy.colUnit, phone: "meta", render: (row) => unitWords[row.unit] },
    { key: "price", label: copy.colPrice, phone: "meta", render: (row) => row.priceText ?? copy.priceNotSet },
    {
      key: "connected",
      label: copy.colConnected,
      phone: "meta",
      render: (row) =>
        [
          formatPlural(copy.destinationCount, row.destinationIds.length, loc),
          formatPlural(copy.stayCount, row.stayCount, loc),
        ].join(copy.connectedJoin),
    },
    { key: "status", label: copy.colStatus, phone: "meta", render: (row) => <StatusChip published={row.published} locale={loc} /> },
  ];

  const kinds: { value: "" | CatalogKind; label: string }[] = [
    { value: "", label: copy.filterAll },
    { value: "experience", label: copy.filterExperiences },
    { value: "service", label: copy.filterServices },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
        <Button onClick={onNew}>{copy.newItem}</Button>
      </div>
      {rows.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={copy.colType}>
            {kinds.map((kind) => (
              <Chip key={kind.value} on={filter.kind === kind.value} onClick={() => setFilter({ ...filter, kind: kind.value })}>
                {kind.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Select
              dir={dir}
              value={filter.destinationId === "" ? ALL : filter.destinationId}
              label="{name}"
              options={[{ value: ALL, label: copy.allDestinations }, ...destinations.map((d) => ({ value: d.id, label: d.label }))]}
              onChange={(next) => setFilter({ ...filter, destinationId: next === ALL ? "" : next })}
            />
            <Select
              dir={dir}
              value={filter.stayId === "" ? ALL : filter.stayId}
              label="{name}"
              options={[{ value: ALL, label: copy.allStays }, ...stays.map((s) => ({ value: s.id, label: s.label }))]}
              onChange={(next) => setFilter({ ...filter, stayId: next === ALL ? "" : next })}
            />
            <Field
              id={searchId}
              label={copy.search}
              search
              autoComplete="off"
              value={filter.query}
              onChange={(event) => setFilter({ ...filter, query: event.target.value })}
            />
          </div>
        </div>
      ) : null}
      <ListTable
        caption={copy.caption}
        columns={columns}
        rows={shown}
        onOpen={(row) => onOpen(row.id)}
        // A filtered list shows part of an order the owner cannot see: no reorder while a filter or search is on.
        reorder={filtering ? undefined : { onMove, onDropOrder }}
        empty={
          rows.length === 0 ? (
            <div className="flex flex-col items-start gap-2">
              <p className="m-0 text-pretty text-body text-ink">{copy.empty}</p>
              <Button onClick={onNew}>{copy.newItem}</Button>
            </div>
          ) : (
            <p className="m-0 text-body text-ink">{copy.emptyFiltered}</p>
          )
        }
      />
      {panel ? (
        <CatalogPanelView
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

function CatalogPanelView({
  panel,
  initialTab,
  initialLocale,
  initialConfirmDelete,
}: {
  panel: CatalogPanel;
  initialTab: CatalogTab;
  initialLocale: Locale3;
  initialConfirmDelete: boolean;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].items;
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const { form, onForm, error } = panel;
  const isNew = form.id === null;
  const [tab, setTab] = useState<CatalogTab>(isNew ? "details" : initialTab);
  const [locale, setLocale] = useState<Locale3>(initialLocale);
  const [asking, setAsking] = useState(initialConfirmDelete);
  const dir = loc === "ar" ? "rtl" : "ltr";

  const missing = missingForPublish("catalog_item", {
    translations: form.text,
    media_id: form.media?.id ?? null,
    destination_ids: form.destination_ids,
  });
  const states = translationStates(form);
  const hasExisting = CATALOG_TEXT_FIELDS.some((f) => form.text.ar[f] !== "" || form.text.es[f] !== "");
  const title = form.text.en.name || copy.newItem;
  const homePickupRefused = error?.field === "is_home_pickup";
  const priceError = error?.field === "price_aed" ? fillCopy(kit.invalidField, { field: copy.fieldPrice.toLocaleLowerCase(loc) }) : undefined;
  const slugError = error?.field === "slug" && error.code === "slug_taken" ? kit.errors.slug_taken : undefined;
  const ownField = homePickupRefused || priceError !== undefined || slugError !== undefined;

  const units: { value: CatalogUnit; label: string }[] = [
    { value: "person", label: copy.unitPerson },
    { value: "night", label: copy.unitNight },
    { value: "trip", label: copy.unitTrip },
  ];

  function setText(field: (typeof CATALOG_TEXT_FIELDS)[number], value: string) {
    onForm({ ...form, text: { ...form.text, [locale]: { ...form.text[locale], [field]: value } } });
  }

  function textField(field: (typeof CATALOG_TEXT_FIELDS)[number], label: string, extra?: { multiline?: boolean; required?: boolean }) {
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
            source={Object.fromEntries(CATALOG_TEXT_FIELDS.map((f) => [f, form.text.en[f]]))}
            hasExisting={hasExisting}
            onDrafts={(target, fields) => onForm({ ...form, ...applyDrafts(form, target, fields) })}
            locale={loc}
          />
        }
      >
        {textField("name", copy.fieldName, { required: true })}
        {textField("summary", copy.fieldDescription, { multiline: true })}
        {textField("duration_label", copy.fieldDuration)}
      </LocaleTabs>
      <div className="flex flex-col gap-2">
        <span id={`${idBase}-kind`} className="text-label text-ink">
          {copy.fieldType}
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${idBase}-kind`}>
          <Chip on={form.kind === "experience"} onClick={() => onForm({ ...form, kind: "experience" })}>
            {copy.kindExperience}
          </Chip>
          <Chip on={form.kind === "service"} onClick={() => onForm({ ...form, kind: "service" })}>
            {copy.kindService}
          </Chip>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idBase}-unit`} className="text-label text-ink">
          {copy.fieldUnit}
        </label>
        <Select
          id={`${idBase}-unit`}
          dir={dir}
          value={form.unit}
          label="{name}"
          options={units}
          onChange={(next) => onForm({ ...form, unit: next as CatalogUnit })}
        />
      </div>
      <Field
        id={`${idBase}-price`}
        label={copy.fieldPrice}
        className="max-w-none"
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        value={form.price}
        hint={copy.priceHint}
        error={priceError}
        onChange={(event) => onForm({ ...form, price: event.target.value })}
      />
      <MediaField id={`${idBase}-photo`} label={copy.fieldPhoto} required value={form.media} onChange={(media) => onForm({ ...form, media })} locale={loc} />
      <Field
        id={`${idBase}-slug`}
        label={copy.fieldSlug}
        className="max-w-none"
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        value={form.slug}
        readOnly={form.published}
        hint={form.published ? copy.slugLocked : copy.slugHint}
        error={slugError}
        onChange={(event) => onForm({ ...form, slug: event.target.value })}
      />
      <div className="flex flex-col gap-1">
        <Checkbox label={copy.isUae} checked={form.is_uae} onChange={(event) => onForm({ ...form, is_uae: event.target.checked })} />
        <Checkbox
          label={copy.isHomePickup}
          checked={form.is_home_pickup}
          aria-describedby={`${idBase}-pickup-note`}
          onChange={(event) => onForm({ ...form, is_home_pickup: event.target.checked })}
        />
        <p id={`${idBase}-pickup-note`} className="m-0 text-label text-muted">
          {copy.homePickupHint}
        </p>
        {homePickupRefused ? (
          <p role="alert" className="m-0 text-label text-error">
            {copy.homePickupRefused}
          </p>
        ) : null}
      </div>
    </>
  );

  const connections = (
    <div className="flex flex-col gap-6">
      <p className="m-0 text-label text-muted">{copy.connectionsIntro}</p>
      <ConnectPicker
        title={copy.destinationsHeading}
        searchLabel={copy.searchDestinations}
        options={panel.destinations}
        connected={form.destination_ids}
        onChange={(ids) => onForm({ ...form, destination_ids: ids })}
      />
      <ConnectPicker
        title={copy.staysHeading}
        searchLabel={copy.searchStays}
        options={panel.stays}
        connected={form.stay_ids}
        onChange={(ids) => onForm({ ...form, stay_ids: ids })}
      />
    </div>
  );

  return (
    <>
      <EditPanel
        open
        onOpenChange={(open) => {
          if (!open) panel.onClose();
        }}
        title={title}
        tabs={[
          { key: "details", label: copy.tabDetails },
          { key: "connections", label: copy.tabConnections },
        ]}
        tab={tab}
        onTabChange={(key) => setTab(key as CatalogTab)}
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
            onDelete={() => setAsking(true)}
            error={ownField ? null : error}
            fieldLabel={(field) => (field === "slug" ? copy.fieldSlug.toLocaleLowerCase(loc) : undefined)}
          />
        }
      >
        {tab === "connections" ? connections : details}
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

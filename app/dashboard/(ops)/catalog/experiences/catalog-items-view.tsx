"use client";

import { useId, useState, type ReactNode } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import { ConnectPicker } from "../../../../../components/ops/connect-picker";
import { EditPage, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { MediaField } from "../../../../../components/ops/media-field";
import { missingForPublish } from "../../../../../components/ops/publish-check";
import { StatusChip } from "../../../../../components/ops/status-chip";
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
  filterCatalogRows,
  liveFields,
  type CatalogFilter,
  type CatalogItemForm,
  type CatalogItemText,
} from "../catalog-forms";
import { LockedAddress } from "../locked-address";

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

export type CatalogPanel = {
  form: CatalogItemForm;
  /** The text of the three languages as last saved: what the kit compares the English with, and what is live. */
  saved: Record<Locale3, CatalogItemText>;
  onForm: (next: CatalogItemForm) => void;
  dirty: boolean;
  busy: boolean;
  destinations: PickOption[];
  stays: PickOption[];
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

const ALL = "all";

/**
 * The Experiences and services list and the item's editor page (canvas DashServices; kit panel B, owner 2026-10-14),
 * driven entirely by props, as DestinationsView. Filters and search are this view's own state.
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
  initialFilter = NO_CATALOG_FILTER,
  onStayFilter,
  notice,
}: {
  rows: CatalogRow[];
  destinations: PickOption[];
  stays: PickOption[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onMove: (id: string, by: -1 | 1) => void;
  onDropOrder: (ids: string[]) => void;
  panel: CatalogPanel | null;
  initialFilter?: CatalogFilter;
  /**
   * The owner picked a stay in the stay filter: the rows learn that stay's items only then. The filter changes once it
   * resolves true; false leaves it on all stays. Absent: the rows already carry their stays.
   */
  onStayFilter?: (stayId: string) => Promise<boolean>;
  /** A line of the screen's own under the title, such as a list that did not load. */
  notice?: ReactNode;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].items;
  const searchId = useId();
  const [filter, setFilter] = useState<CatalogFilter>(initialFilter);
  // A stay is being read for the filter: the list is marked busy and the stay select takes no pick until it answers.
  const [reading, setReading] = useState(false);
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

  const list = (
    <div className="flex min-w-0 flex-col gap-6" aria-busy={reading || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
        <Button onClick={onNew}>{copy.newItem}</Button>
      </div>
      {notice}
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
              onChange={async (next) => {
                // One read at a time: a pick while the last one is read is not taken.
                if (reading) return;
                const stayId = next === ALL ? "" : next;
                if (stayId === "" || !onStayFilter) {
                  setFilter((was) => ({ ...was, stayId }));
                  return;
                }
                setReading(true);
                const ok = await onStayFilter(stayId);
                setReading(false);
                if (ok) setFilter((was) => ({ ...was, stayId }));
              }}
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
    </div>
  );

  return <CatalogItemEditor panel={panel} list={list} />;
}

const englishOf = (text: CatalogItemText) => Object.fromEntries(CATALOG_TEXT_FIELDS.map((field) => [field, text[field]]));

/**
 * The item's editor page (kit EditPage, signed option B): Text, Photo and Connections on the left; Price and Settings on
 * the right; one column on a phone. Maria writes English only; the kit fills Arabic and Spanish on Save. With no item
 * open the page shows the list.
 */
function CatalogItemEditor({ panel, list }: { panel: CatalogPanel | null; list: ReactNode }) {
  const loc = useDashboardLocale();
  const copy = OPS_CATALOG_COPY[loc].items;
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const [asking, setAsking] = useState(false);
  const dir = loc === "ar" ? "rtl" : "ltr";

  const form = panel?.form ?? null;
  const error = panel?.error ?? null;
  const title = form?.text.en.name || copy.newItem;
  const homePickupRefused = error?.field === "is_home_pickup";
  const priceError = error?.field === "price_aed" ? fillCopy(kit.invalidField, { field: copy.fieldPrice.toLocaleLowerCase(loc) }) : undefined;
  const slugError = error?.field === "slug" && error.code === "slug_taken" ? kit.errors.slug_taken : undefined;
  const ownField = homePickupRefused || priceError !== undefined || slugError !== undefined;

  const units: { value: CatalogUnit; label: string }[] = [
    { value: "person", label: copy.unitPerson },
    { value: "night", label: copy.unitNight },
    { value: "trip", label: copy.unitTrip },
  ];
  const fieldLabels: Record<(typeof CATALOG_TEXT_FIELDS)[number], string> = {
    name: copy.fieldName,
    summary: copy.fieldDescription,
    duration_label: copy.fieldDuration,
  };

  function sections(panel: CatalogPanel, form: CatalogItemForm) {
    const { onForm } = panel;
    const setEnglish = (field: (typeof CATALOG_TEXT_FIELDS)[number], value: string) =>
      onForm({ ...form, text: { ...form.text, en: { ...form.text.en, [field]: value } } });
    const english = (field: (typeof CATALOG_TEXT_FIELDS)[number], extra?: { multiline?: boolean; required?: boolean }) => {
      const common = {
        id: `${idBase}-en-${field}`,
        label: fieldLabels[field],
        className: "max-w-none",
        lang: "en",
        dir: "ltr",
        value: form.text.en[field],
        required: extra?.required,
        onChange: (event: { target: { value: string } }) => setEnglish(field, event.target.value),
      };
      return extra?.multiline ? <Field {...common} multiline rows={5} /> : <Field {...common} autoComplete="off" />;
    };

    return [
      {
        key: "text",
        title: kit.editor.sections.text,
        translatable: true,
        content: (
          <>
            {english("name", { required: true })}
            {english("summary", { multiline: true })}
            {english("duration_label")}
          </>
        ),
      },
      {
        key: "photo",
        title: kit.editor.sections.photo,
        content: <MediaField id={`${idBase}-photo`} label={copy.fieldPhoto} required value={form.media} onChange={(media) => onForm({ ...form, media })} locale={loc} />,
      },
      {
        key: "connections",
        title: kit.editor.sections.connections,
        content: (
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
        ),
      },
      {
        key: "price",
        title: kit.editor.sections.price,
        column: "side" as const,
        content: (
          <>
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
          </>
        ),
      },
      {
        key: "settings",
        title: kit.editor.sections.settings,
        column: "side" as const,
        content: (
          <>
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
            {form.published ? (
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
            )}
          </>
        ),
      },
    ];
  }

  const missing = form
    ? missingForPublish("catalog_item", { translations: form.text, media_id: form.media?.id ?? null, destination_ids: form.destination_ids })
    : [];

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
        error={ownField ? null : error}
        fieldLabel={(field) => (field === "slug" ? copy.fieldSlug.toLocaleLowerCase(loc) : field in fieldLabels ? fieldLabels[field as keyof typeof fieldLabels] : undefined)}
        english={form ? englishOf(form.text.en) : {}}
        savedEnglish={panel ? englishOf(panel.saved.en) : {}}
        translations={form ? { ar: englishOf(form.text.ar), es: englishOf(form.text.es) } : { ar: {}, es: {} }}
        translationFields={CATALOG_TEXT_FIELDS.map((field) => ({ name: field, label: fieldLabels[field], multiline: field === "summary" }))}
        onTranslationChange={(target, name, value) => {
          if (!panel || !form) return;
          const text = Array.isArray(value) ? value.join(" ") : value;
          panel.onForm({ ...form, text: { ...form.text, [target]: { ...form.text[target], [name]: text } } });
        }}
        onSave={(payload, intent) => (panel ? panel.onSave(payload, intent) : Promise.resolve(false))}
        onPublish={() => panel?.onPublish()}
        onUnpublish={() => panel?.onUnpublish()}
        onDelete={() => setAsking(true)}
        // A published item is on the site in the languages it was published in; an item in use is a published one.
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

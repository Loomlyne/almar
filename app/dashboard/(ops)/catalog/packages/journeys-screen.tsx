"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LockIcon } from "../../../../../components/icons/icons";
import type { Send } from "../../../../../components/ops/auto-translate";
import { EditPage, type EditSection, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { MediaField } from "../../../../../components/ops/media-field";
import { missingForPublish } from "../../../../../components/ops/publish-check";
import { missingLine } from "../../../../../components/ops/error-text";
import { StatusChip } from "../../../../../components/ops/status-chip";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import type {
  CatalogSummary,
  DestinationSummary,
  DetailReply,
  JourneyDetailWithLegs,
  JourneySummary,
  ListReply,
  Locale3,
  OpsError,
  PublishResult,
  StaySummary,
  WriteResult,
} from "../../../../../components/ops/api-types";
import { errorText } from "../../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { Button } from "../../../../../components/ui/button";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { OPS_CATALOG_COPY, fillCatalogCopy } from "../../../../../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { afterSave, liveGaps, movedIds, sameForm } from "../catalog-forms";
import { LockedAddress } from "../locked-address";
import { saveThenPublish } from "../persist";
import { focusMovedRow } from "../move-focus";
import { JourneyAddons, type AddonOption } from "./journey-addons";
import {
  JOURNEY_TEXT_FIELDS,
  blankJourneyForm,
  journeyFields,
  journeyForm,
  journeyLocks,
  journeyPayload,
  journeyPriceGaps,
  journeySlugOk,
  journeyWithTranslations,
  legsReady,
  liveJourneyFields,
  priceReading,
  type JourneyForm,
  type JourneyLegForm,
  type JourneyText,
  type JourneyTextField,
  type PriceGaps,
} from "./journey-forms";
import { JourneyLegs, type LegOption } from "./journey-legs";
import { OPS_TEAM_COPY, fillTeamCopy } from "../../../../../lib/copy/ops-team";

export type JourneyRow = { id: string; name: string; priceLine: string; published: boolean };

export type JourneyPanel = {
  form: JourneyForm;
  /** The text of the three languages as last saved: what the kit compares the English with, and what is live. */
  saved: Record<Locale3, JourneyText>;
  /** The legs as last saved, for the same two questions on each nights line. */
  savedLegs: JourneyLegForm[];
  /** Every destination, for a leg's select. */
  destinations: LegOption[];
  /** Each destination's stays, for a leg's Suggested stay. */
  staysByDestination: Record<string, LegOption[]>;
  /** The catalog's items that are not the home pickup, for Included in this package. */
  addons: AddonOption[];
  onForm: (next: JourneyForm) => void;
  dirty: boolean;
  busy: boolean;
  error: OpsError | null;
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  onPublish: () => void | Promise<unknown>;
  onUnpublish: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** After the last save: Arabic or Spanish text whose empty price line was kept as saved, or that could not be saved. */
  priceGaps?: PriceGaps | null;
  /** Test seam for the translate request (the kit's opsSend by default). */
  send?: Send;
};

/**
 * Catalog -> Packages (plan 06-06, CMS-03, signed pictures/06-06). Driven entirely by props. The list reorders and has New
 * package; there is no booking. Show and hide are the kit's Publish and Unpublish. The price line is the owner's own text, stored
 * as typed; the editor only says how the site reads it.
 */
export function JourneysView({
  rows,
  onNew,
  onOpen,
  onMove,
  onDropOrder,
  panel,
  reordering = false,
  notice,
}: {
  rows: JourneyRow[];
  onNew: () => void;
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
          <p className="m-0 max-w-prose text-pretty text-label text-ink">{copy.intro}</p>
        </div>
        <Button onClick={onNew}>{copy.newPackage}</Button>
      </div>
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

/**
 * The package's editor page (kit EditPage), as signed: Text, Cities on this journey and Included in this package on the left; Web
 * address, Photo, Price (the English line and how the site reads the saved line) and Settings on the right; one column on a phone.
 * A new package has no add-ons yet (its first Save makes it); its web address is typed here and locks once published. Delete sits
 * under Settings: a shown package cannot be deleted, and a hidden one asks first.
 */
function JourneyEditor({ panel, list }: { panel: JourneyPanel | null; list: ReactNode }) {
  const loc = useDashboardLocale();
  const copy = OPS_TEAM_COPY[loc].journeys;
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const [asking, setAsking] = useState(false);

  const form = panel?.form ?? null;
  const isNew = form?.id === null;
  const title = form?.text.en.name.trim() || (isNew ? copy.newPackage : copy.untitled);
  const slugBad = form ? !form.published && form.slug.trim() !== "" && !journeySlugOk(form.slug) : false;
  const slugTaken = panel?.error?.field === "slug" && panel.error.code !== "invalid";
  const slugError = slugTaken ? kit.errors.slug_taken : slugBad ? kit.errors.invalid : undefined;
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
        key: "legs",
        title: copy.legs,
        content: <JourneyLegs legs={form.legs} destinations={panel.destinations} staysByDestination={panel.staysByDestination} onChange={(legs) => onForm({ ...form, legs })} idBase={idBase} />,
      },
      ...(form.id === null
        ? []
        : [
            {
              key: "addons",
              title: copy.addons,
              content: <JourneyAddons options={panel.addons} connected={form.addon_ids} onChange={(addon_ids) => onForm({ ...form, addon_ids })} />,
            },
          ]),
      {
        key: "address",
        title: copy.fieldSlug,
        column: "side",
        content: form.published ? (
          <LockedAddress label={copy.fieldSlug} value={form.slug} note={copy.slugLocked} />
        ) : (
          <Field
            id={`${idBase}-slug`}
            label={copy.fieldSlug}
            className="max-w-none"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
            required
            value={form.slug}
            hint={copy.slugHint}
            error={slugError}
            onChange={(event) => onForm({ ...form, slug: event.target.value })}
          />
        ),
      },
      {
        key: "photo",
        title: kit.editor.sections.photo,
        column: "side",
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
        content: (
          <>
            <p className="m-0 text-label text-ink">{form.published ? kit.published : kit.draft}</p>
            {form.id === null ? null : (
              <div className="flex flex-col items-start gap-2">
                <Button variant="danger" className="text-error" disabled={form.published} onClick={() => setAsking(true)}>
                  {copy.deletePkg}
                </Button>
                {form.published ? (
                  <p className="m-0 flex items-start gap-2 text-label text-muted">
                    <LockIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{copy.cannotDelete}</span>
                  </p>
                ) : null}
              </div>
            )}
          </>
        ),
      },
    ];
  }

  const missing = form ? missingForPublish("journey_tier", { translations: form.text, media_id: form.media?.id ?? null }) : [];
  const legLabels: Record<string, string> = Object.fromEntries(
    (form?.legs ?? []).map((leg, index) => [leg.key, `${fillTeamCopy(copy.city, { n: index + 1 })}: ${copy.nights}`]),
  );
  const fieldLabel = (field: string) => (field === "slug" ? copy.fieldSlug.toLocaleLowerCase(loc) : field in fieldLabels ? fieldLabels[field as JourneyTextField] : legLabels[field]);
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

  const canSave = form
    ? form.text.en.name.trim() !== "" && form.text.en.price_label.trim() !== "" && live.length === 0 && (form.published || journeySlugOk(form.slug)) && legsReady(form.legs)
    : false;

  return (
    <>
      <EditPage
        openKey={panel && form ? (form.id ?? "new") : null}
        list={list}
        backLabel={copy.title}
        onClose={() => panel?.onClose()}
        title={title}
        isNew={isNew}
        isPublished={form?.published ?? false}
        dirty={panel?.dirty ?? false}
        busy={panel?.busy ?? false}
        canSave={canSave}
        notice={liveNote}
        missing={missing}
        error={slugTaken ? null : (panel?.error ?? null)}
        fieldLabel={fieldLabel}
        english={form ? journeyFields(form, "en") : {}}
        savedEnglish={panel ? journeyFields({ text: panel.saved, legs: panel.savedLegs }, "en") : {}}
        translations={form ? { ar: journeyFields(form, "ar"), es: journeyFields(form, "es") } : { ar: {}, es: {} }}
        locked={form ? journeyLocks(form) : undefined}
        translationFields={[
          ...JOURNEY_TEXT_FIELDS.map((field) => ({ name: field, label: fieldLabels[field], multiline: field === "body" })),
          ...(form?.legs ?? []).map((leg) => ({ name: leg.key, label: legLabels[leg.key] ?? copy.nights, maxLength: 120 })),
        ]}
        onTranslationChange={(target, name, value) => {
          if (!panel || !form) return;
          const text = Array.isArray(value) ? value.join(" ") : value;
          if (form.legs.some((leg) => leg.key === name)) {
            panel.onForm({ ...form, legs: form.legs.map((leg) => (leg.key === name ? { ...leg, text: { ...leg.text, [target]: text } } : leg)) });
            return;
          }
          panel.onForm({ ...form, text: { ...form.text, [target]: { ...form.text[target], [name]: text } } });
        }}
        onSave={(payload, intent) => (panel ? panel.onSave(payload, intent) : Promise.resolve(false))}
        onPublish={() => panel?.onPublish()}
        onUnpublish={() => panel?.onUnpublish()}
        liveTranslations={panel && form ? liveJourneyFields(form.published, form.status, panel.saved, panel.savedLegs) : {}}
        holdOnFailure={form?.published ?? false}
        send={panel?.send}
        sections={panel && form ? sections(panel, form) : []}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={fillTeamCopy(copy.deleteTitle, { name: title })}
        description={copy.deleteText}
        confirmLabel={copy.deletePkg}
        cancelLabel={kit.cancel}
        onConfirm={() => {
          setAsking(false);
          panel?.onDelete();
        }}
      />
    </>
  );
}

const PATH = "/api/ops/journeys";

type Open = { form: JourneyForm; saved: JourneyForm };

/**
 * Catalog -> Packages, connected (plans 03.2-08, 06-06): the packages, their order and each one's editor page (New, Save, Publish,
 * Unpublish, Delete while hidden; automatic Arabic and Spanish through the kit, the legs' nights lines too), through the kit client
 * (contract 5.8, 5.9). After a Save the editor is read again, so "How the site reads it" is the server's reading of the line just
 * saved. The destinations, stays and catalog items are read once, for the legs' selects and the add-on picker. `send` is the test
 * seam for the translate request; the page passes nothing.
 */
export function JourneysScreen({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const kit = OPS_KIT_COPY[locale];

  const [rows, setRows] = useState<JourneySummary[]>([]);
  const [destinations, setDestinations] = useState<DestinationSummary[]>([]);
  const [stays, setStays] = useState<StaySummary[]>([]);
  const [items, setItems] = useState<CatalogSummary[]>([]);
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

  /** What the legs' selects and the add-on picker offer. A refusal stays on the list; the editor then offers what did load. */
  async function loadOptions() {
    const [d, s, c] = await Promise.all([
      opsFetch<ListReply<DestinationSummary>>("/api/ops/destinations"),
      opsFetch<ListReply<StaySummary>>("/api/ops/stays"),
      opsFetch<ListReply<CatalogSummary>>("/api/ops/catalog"),
    ]);
    if (d.ok) setDestinations(d.items);
    if (s.ok) setStays(s.items);
    if (c.ok) setItems(c.items);
    const failed = [d, s, c].find((reply) => !reply.ok);
    if (failed && !failed.ok) setListError(failed.error);
  }

  useEffect(() => {
    void loadList();
    void loadOptions();
  }, []);

  /**
   * Loads one journey into the editor (its saved state and price reading are the server's). `legKeys`: the keys of the legs just
   * saved, in order, so the kit's locks stay on their legs after a read-back (a save gives every leg a new id).
   */
  async function openDetail(id: string, legKeys: readonly string[] = []): Promise<OpsError | null> {
    const reply = await opsFetch<DetailReply<JourneyDetailWithLegs>>(PATH, { id });
    if (!reply.ok) return reply.error;
    const form = journeyForm(reply.item, legKeys);
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

  function onNew() {
    if (busy) return;
    const form = blankJourneyForm();
    setError(null);
    setPriceGaps(null);
    setOpen({ form, saved: form });
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
    const reread = await openDetail(result.id, form.legs.map((leg) => leg.key));
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
    return persist(journeyWithTranslations(open.form, payload.translations, payload.locked), intent === "publish");
  }

  async function onUnpublish() {
    const id = open?.form.id;
    if (!open || !id || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<PublishResult>("/api/ops/publish", { entity: "journey_tier", id, published: false });
    if (!reply.ok) setError(reply.error);
    else {
      setError(await openDetail(id, open.saved.legs.map((leg) => leg.key)));
      await loadList();
    }
    setBusy(false);
  }

  /** Only a hidden package: the database refuses a shown one. */
  async function onDelete() {
    const id = open?.form.id;
    if (!id || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<WriteResult>(PATH, { action: "delete", id });
    if (reply.ok) {
      setOpen(null);
      await loadList();
    } else setError(reply.error);
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

  const sortedOptions = <T extends { position: number }>(list: readonly T[]) => list.slice().sort((a, b) => a.position - b.position);
  const nameOf = (row: DestinationSummary) => (locale === "ar" ? row.name_ar : locale === "es" ? row.name_es : null) ?? row.name_en;
  const legDestinations: LegOption[] = sortedOptions(destinations).map((row) => ({ id: row.id, name: nameOf(row) }));
  const staysByDestination: Record<string, LegOption[]> = {};
  for (const stay of sortedOptions(stays)) (staysByDestination[stay.destination_id] ??= []).push({ id: stay.id, name: stay.title_en });
  const addons: AddonOption[] = sortedOptions(items)
    .filter((item) => !item.is_home_pickup)
    .map((item) => ({ id: item.id, label: item.name_en }));

  return (
    <JourneysView
      rows={shown}
      onNew={onNew}
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
              savedLegs: open.saved.legs,
              destinations: legDestinations,
              staysByDestination,
              addons,
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
              onDelete: () => void onDelete(),
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

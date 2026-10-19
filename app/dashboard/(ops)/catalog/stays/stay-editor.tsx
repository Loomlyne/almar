"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { Fields, LiveFields, Send, Target } from "../../../../../components/ops/auto-translate";
import type { Locale3, OpsError, PetsRule, PublishWarningCode, StayDetail } from "../../../../../components/ops/api-types";
import { ConnectPicker } from "../../../../../components/ops/connect-picker";
import { EditPage, type EditSection, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { MediaField, MediaListField } from "../../../../../components/ops/media-field";
import { missingForPublish } from "../../../../../components/ops/publish-check";
import { Field } from "../../../../../components/ui/field";
import { Select } from "../../../../../components/ui/select";
import { DASHBOARD_COPY } from "../../../../../lib/copy/dashboard";
import { fillCopy } from "../../../../../lib/copy/ops-kit";
import { OPS_STAYS_COPY, type OpsStaysCopy } from "../../../../../lib/copy/ops-stays";
import { stayTabSections, type StaySectionKey } from "./stay-tab-sections";
import {
  STAY_LINES,
  STAY_LISTS,
  amenityCounts,
  groupByKind,
  keepHidden,
  linesOf,
  lockedLength,
  validateStayFacts,
  type FactKey,
  type FactProblem,
  type StayFacts,
  type StayForm,
  type StayLine,
  type StayList,
} from "./stay-forms";

export type DestinationChoice = { id: string; name: string; published: boolean };
/** An experience or a service the stay can connect. */
export type CatalogChoice = { id: string; name: string; kind: "experience" | "service" };

const LINE_LABEL: Record<StayLine, keyof OpsStaysCopy> = {
  title: "title",
  tagline: "tagline",
  neighborhood: "neighborhood",
  guests_label: "guestsLine",
  bathrooms_label: "bathroomsLine",
  beds_label: "bedsLine",
  price_label: "priceLine",
  price_note: "priceNote",
};
const LIST_LABEL: Record<StayList, keyof OpsStaysCopy> = {
  description: "description",
  amenities: "amenities",
  inclusions: "inclusions",
  policy_headings: "policyHeadings",
};
const FACT_LABEL: Partial<Record<FactKey, keyof OpsStaysCopy>> = {
  maxGuests: "maxGuests",
  minGuests: "minGuests",
  bedrooms: "bedrooms",
  bathrooms: "bathrooms",
  minNights: "minNights",
  petsFee: "petFee",
  slug: "slug",
};
const PROBLEM: Record<FactProblem, keyof OpsStaysCopy> = {
  whole: "problemWhole",
  tooLarge: "problemTooLarge",
  atLeastOne: "problemAtLeastOne",
  guestsOrder: "problemGuestsOrder",
  fee: "problemFee",
  feeNeeded: "problemFeeNeeded",
  slug: "problemSlug",
  slugNeeded: "problemSlugNeeded",
  destinationNeeded: "problemDestinationNeeded",
};
/** Said under the bar (something to do); the others are said on their field (something typed wrong). */
const NEEDS: ReadonlySet<FactProblem> = new Set(["feeNeeded", "slugNeeded", "destinationNeeded"]);

const text = (copy: OpsStaysCopy, key: keyof OpsStaysCopy) => copy[key] as string;

/** English with each list's blank lines dropped: what Save sends and what the kit translates. */
function cleanEnglish(english: Fields): Fields {
  const out: Fields = { ...english };
  for (const name of STAY_LISTS) {
    const value = english[name];
    out[name] = Array.isArray(value) ? linesOf(value.join("\n")) : [];
  }
  return out;
}

const sameList = (a: Fields[string] | undefined, b: Fields[string] | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Catalog -> Stays: one stay on the kit's editor page (kit panel B). Left column: Text (English only; Arabic and Spanish
 * come on Save), Photos, Experiences and services. Right column: Place, Capacity, Stay rules (the settings). No price
 * field: the nightly rate lives in Rates (03.2-15), one place for money. Presentational: the screen holds the form and
 * the requests.
 *
 * 03.2-15: its Rates, Availability and Access cards follow Stay rules, only once the stay has an id: one spread at the
 * end of `sections` (stay-tab-sections.tsx) and each card's dirty flag ORed into `dirty`.
 */
export function StayEditor({
  locale,
  list,
  openKey,
  onClose,
  stay,
  reload,
  form,
  saved,
  onFormChange,
  destinations,
  catalog,
  destinationItems,
  busy = false,
  error,
  warnings = [],
  onSave,
  onPublish,
  onUnpublish,
  onDelete,
  liveTranslations,
  holdOnFailure = false,
  send,
}: {
  locale: Locale3;
  list: ReactNode;
  /** The open stay's id, "new" for a new one, null for the list. */
  openKey: string | null;
  onClose: () => void;
  /** The stay as last read; null for a new stay. */
  stay: StayDetail | null;
  reload: () => Promise<void>;
  form: StayForm;
  saved: StayForm;
  onFormChange: (next: StayForm) => void;
  destinations: DestinationChoice[];
  catalog: CatalogChoice[];
  /** Ids connected to the chosen destination: shown read-only, not offered. */
  destinationItems: string[];
  busy?: boolean;
  error: OpsError | null;
  warnings?: PublishWarningCode[];
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  onPublish?: () => void | Promise<unknown>;
  onUnpublish?: () => void;
  onDelete?: () => void;
  liveTranslations?: LiveFields;
  holdOnFailure?: boolean;
  send?: Send;
}) {
  const copy = OPS_STAYS_COPY[locale];
  const dashboard = DASHBOARD_COPY[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isNew = stay === null;
  const isPublished = stay?.is_published ?? false;
  // 03.2-15's cards report their own unsaved typing; any of them makes the page ask "Discard changes?".
  const [cardsDirty, setCardsDirty] = useState<Record<StaySectionKey, boolean>>({ rates: false, availability: false, access: false });
  const onCardDirty = useCallback((key: StaySectionKey, value: boolean) => {
    setCardsDirty((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const facts = form.facts;
  const problems = validateStayFacts(facts);
  const english = cleanEnglish(form.english);
  const savedEnglish = cleanEnglish(saved.english);
  const typed: Record<Target, boolean> = {
    ar: !sameList(form.translations.ar.amenities, saved.translations.ar.amenities),
    es: !sameList(form.translations.es.amenities, saved.translations.es.amenities),
  };
  const mismatch = lockedLength(english, form.translations, typed);
  const counts = amenityCounts(english, form.translations);

  const needs = (Object.entries(problems) as [FactKey, FactProblem][]).filter(([, problem]) => NEEDS.has(problem));
  const fieldError = (key: FactKey) => {
    const problem = problems[key];
    if (!problem || NEEDS.has(problem)) return undefined;
    const label = FACT_LABEL[key];
    return fillCopy(text(copy, PROBLEM[problem]), { field: label ? text(copy, label) : "" });
  };

  const destination = destinations.find((one) => one.id === facts.destinationId);
  const missing = missingForPublish("stay", {
    translations: { en: english, ar: form.translations.ar, es: form.translations.es },
    media_id: form.hero?.id ?? null,
    destination_published: destination?.published ?? false,
  });

  const setFacts = (patch: Partial<StayFacts>) => onFormChange({ ...form, facts: { ...facts, ...patch } });
  const setEnglish = (name: string, value: string | string[]) => onFormChange({ ...form, english: { ...form.english, [name]: value } });

  const numberField = (key: "maxGuests" | "minGuests" | "bedrooms" | "bathrooms" | "minNights", hint?: string) => (
    <Field
      id={`stay-${key}`}
      label={text(copy, FACT_LABEL[key]!)}
      inputMode="numeric"
      autoComplete="off"
      className="max-w-none"
      hint={hint}
      error={fieldError(key)}
      value={facts[key]}
      onChange={(event) => setFacts({ [key]: event.target.value })}
    />
  );

  const labelled = (id: string, label: string, control: ReactNode) => (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={id} className="text-label text-ink">
        {label}
      </span>
      {control}
    </div>
  );

  const textCard = (
    <div className="flex min-w-0 flex-col gap-4">
      {STAY_LINES.map((name) => (
        <Field
          key={name}
          id={`stay-${name}`}
          label={text(copy, LINE_LABEL[name])}
          required={name === "title"}
          className="max-w-none"
          autoComplete="off"
          value={String(form.english[name] ?? "")}
          onChange={(event) => setEnglish(name, event.target.value)}
        />
      ))}
      {STAY_LISTS.map((name) => {
        const value = form.english[name];
        return (
          <Field
            key={name}
            id={`stay-${name}`}
            label={text(copy, LIST_LABEL[name])}
            hint={name === "description" ? copy.paragraphsHint : copy.linesHint}
            multiline
            rows={name === "description" ? 6 : 5}
            className="max-w-none"
            value={Array.isArray(value) ? value.join("\n") : ""}
            onChange={(event) => setEnglish(name, event.target.value.split("\n"))}
          />
        );
      })}
    </div>
  );

  const photosCard = (
    <div className="flex min-w-0 flex-col gap-6">
      <MediaField id="stay-hero" label={copy.hero} required value={form.hero} onChange={(hero) => onFormChange({ ...form, hero })} locale={locale} />
      <MediaListField id="stay-gallery" label={copy.gallery} value={form.gallery} onChange={(gallery) => onFormChange({ ...form, gallery })} locale={locale} />
    </div>
  );

  const fromDestination = new Set(destinationItems);
  const kindWord = (kind: CatalogChoice["kind"]) => (kind === "experience" ? copy.kindExperience : copy.kindService);
  const options = catalog.map((item) => ({ id: item.id, label: item.name, meta: kindWord(item.kind) }));
  // The destination's items are shown, not offered: the kit's read-only group names only what is in `options` and has no
  // kind label, so this card draws them itself, name and kind like the Connected rows.
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const destinationRows = destinationItems.map((id) => byId.get(id)).filter((item): item is CatalogChoice => item !== undefined);
  const kindOf = (id: string) => byId.get(id)?.kind;
  const connectionsCard = (
    <div className="flex min-w-0 flex-col gap-4">
      <ConnectPicker
        title={copy.pickerTitle}
        searchLabel={copy.searchConnections}
        hint={copy.connectionsHint}
        options={options.filter((option) => !fromDestination.has(option.id))}
        connected={groupByKind(
          form.connected.filter((id) => !fromDestination.has(id)),
          kindOf,
        )}
        // The destination's own items are not in the picker; a direct link to one keeps its place (keepHidden).
        onChange={(connected) => onFormChange({ ...form, connected: keepHidden(form.connected, connected, fromDestination, kindOf) })}
        // Move up / Move down (owner 2026-10-17), within a kind: the save keeps one order per kind.
        reorder={{ canSwap: (above, below) => kindOf(above) === kindOf(below) }}
      />
      {destinationRows.length > 0 ? (
        <div className="flex flex-col gap-2" data-stay-from-destination="">
          <h4 className="m-0 text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
            {copy.fromDestination}
          </h4>
          <ul className="m-0 flex list-none flex-col border border-line p-0">
            {destinationRows.map((item) => (
              <li key={item.id} className="flex min-w-0 flex-wrap items-baseline gap-x-2 border-b border-line px-2 py-2 text-label text-ink last:border-b-0">
                <span>{item.name}</span>
                <span className="text-caption text-muted">{kindWord(item.kind)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  const placeCard = (
    <div className="flex min-w-0 flex-col gap-4">
      {labelled(
        "stay-destination-label",
        copy.destination,
        <Select
          id="stay-destination"
          label={`${copy.destination}: {name}`}
          placeholder={copy.chooseDestination}
          value={facts.destinationId === "" ? null : facts.destinationId}
          options={destinations.map((one) => ({ value: one.id, label: one.name }))}
          onChange={(destinationId) => setFacts({ destinationId })}
          dir={dir}
        />,
      )}
      <Field
        id="stay-slug"
        label={copy.slug}
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        className="max-w-none"
        hint={copy.slugHint}
        readOnly={isPublished}
        error={fieldError("slug")}
        value={facts.slug}
        onChange={(event) => setFacts({ slug: event.target.value })}
      />
    </div>
  );

  const capacityCard = (
    <div className="grid min-w-0 grid-cols-2 gap-4">
      {numberField("maxGuests")}
      {numberField("minGuests")}
      {numberField("bedrooms")}
      {numberField("bathrooms")}
    </div>
  );

  const petsOptions: { value: PetsRule | "unset"; label: string }[] = [
    { value: "unset", label: copy.petsNotSet },
    { value: "allowed", label: copy.petsAllowed },
    { value: "not_allowed", label: copy.petsNotAllowed },
    { value: "fee", label: copy.petsFee },
  ];
  const infantOptions = [
    { value: "unset", label: copy.infantsNotSet },
    { value: "yes", label: copy.yes },
    { value: "no", label: copy.no },
  ];
  const rulesCard = (
    <div className="flex min-w-0 flex-col gap-4">
      {numberField("minNights", copy.minNightsHint)}
      {labelled(
        "stay-pets-label",
        copy.pets,
        <Select
          id="stay-pets"
          label={`${copy.pets}: {name}`}
          value={facts.petsRule === "" ? "unset" : facts.petsRule}
          options={petsOptions}
          onChange={(next) => setFacts({ petsRule: next === "unset" ? "" : (next as PetsRule), petsFee: next === "fee" ? facts.petsFee : "" })}
          dir={dir}
        />,
      )}
      {facts.petsRule === "fee" ? (
        <Field
          id="stay-petsFee"
          label={copy.petFee}
          required
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          className="max-w-none"
          error={fieldError("petsFee")}
          value={facts.petsFee}
          onChange={(event) => setFacts({ petsFee: event.target.value })}
        />
      ) : null}
      {labelled(
        "stay-infants-label",
        copy.infants,
        <Select
          id="stay-infants"
          label={`${copy.infants}: {name}`}
          value={facts.infants === "" ? "unset" : facts.infants}
          options={infantOptions}
          onChange={(next) => setFacts({ infants: next === "unset" ? "" : (next as "yes" | "no") })}
          dir={dir}
        />,
      )}
    </div>
  );

  // Every card of the page, in one place. Left: Text, Photos, Experiences and services. Right: the settings.
  const sections: EditSection[] = [
    { key: "text", title: copy.sectionText, column: "main", translatable: true, content: textCard },
    { key: "photos", title: copy.sectionPhotos, column: "main", content: photosCard },
    { key: "connections", title: copy.columnConnected, column: "main", content: connectionsCard },
    { key: "place", title: copy.sectionPlace, column: "side", content: placeCard },
    { key: "capacity", title: copy.sectionCapacity, column: "side", content: capacityCard },
    { key: "rules", title: copy.sectionRules, column: "side", content: rulesCard },
    ...stayTabSections({ stayId: stay?.id ?? null, locale, onDirtyChange: onCardDirty, onBaseSaved: () => void reload() }),
  ];

  // Unsaved work, by part: the page asks "Discard changes?" when any is true.
  const textDirty = JSON.stringify([form.english, form.translations]) !== JSON.stringify([saved.english, saved.translations]);
  const factsDirty = JSON.stringify(form.facts) !== JSON.stringify(saved.facts);
  const photosDirty = JSON.stringify([form.hero, form.gallery]) !== JSON.stringify([saved.hero, saved.gallery]);
  const connectionsDirty = JSON.stringify(form.connected) !== JSON.stringify(saved.connected);
  const dirty = textDirty || factsDirty || photosDirty || connectionsDirty || Object.values(cardsDirty).some(Boolean);

  const notes = [
    ...needs.map(([, problem]) => text(copy, PROBLEM[problem])),
    ...(mismatch.length > 0 ? [fillCopy(copy.amenitiesMismatch, counts)] : []),
  ];
  const fieldLabel = (field: string): string | undefined => {
    if (field === "hero_media_id") return copy.hero;
    if (field in LINE_LABEL) return text(copy, LINE_LABEL[field as StayLine]);
    if (field in LIST_LABEL) return text(copy, LIST_LABEL[field as StayList]);
    return undefined;
  };

  const translationFields = [
    ...STAY_LINES.map((name) => ({ name, label: text(copy, LINE_LABEL[name]) })),
    ...STAY_LISTS.map((name) => ({ name, label: text(copy, LIST_LABEL[name]), multiline: true })),
  ];

  return (
    <EditPage
      openKey={openKey}
      list={list}
      backLabel={dashboard.rail.stays}
      onClose={onClose}
      title={String(english.title ?? "").trim() || (isNew ? dashboard.newStay : "")}
      isNew={isNew}
      isPublished={isPublished}
      dirty={dirty}
      busy={busy}
      canSave={String(english.title ?? "").trim() !== "" && notes.length === 0 && Object.keys(problems).length === 0}
      missing={missing}
      warnings={warnings}
      error={error}
      fieldLabel={fieldLabel}
      english={english}
      savedEnglish={savedEnglish}
      translations={form.translations}
      translationFields={translationFields}
      onTranslationChange={(target, name, value) =>
        onFormChange({ ...form, translations: { ...form.translations, [target]: { ...form.translations[target], [name]: value } } })
      }
      onSave={onSave}
      onPublish={onPublish}
      onUnpublish={onUnpublish}
      onDelete={onDelete}
      deleteLabel={copy.deleteStay}
      liveTranslations={liveTranslations}
      holdOnFailure={holdOnFailure}
      send={send}
      notice={
        notes.length > 0 ? (
          <ul role="status" className="m-0 flex list-none flex-col gap-1 border-s border-gold p-0 ps-2 text-label text-ink">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null
      }
      sections={sections}
    />
  );
}

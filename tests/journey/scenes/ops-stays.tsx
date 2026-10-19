"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees (job 02: the layout picks a mode, the shell itself is a client component). The scene
// frames every state in the preview shell so the rail and the density match.
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { StaysList, type StayRow } from "../../../app/dashboard/(ops)/catalog/stays/stays-list";
import { StayEditor, type CatalogChoice, type DestinationChoice } from "../../../app/dashboard/(ops)/catalog/stays/stay-editor";
import { emptyStayForm, type StayForm } from "../../../app/dashboard/(ops)/catalog/stays/stay-forms";
import type { Fields, Send, Target } from "../../../components/ops/auto-translate";
import type { Locale3, MediaRef, PublishWarningCode, StayDetail } from "../../../components/ops/api-types";
import { mediaUrl } from "../../../lib/data/media";
import type { SceneContext, Scenes } from "../scene-types";

/**
 * The states of Catalog -> Stays, bracket data only: the list, and one stay on the kit's editor page (kit panel B).
 * No rate, fee or address value anywhere: the pet fee box is drawn empty. Test-only: nothing here sends a request.
 */
type Text = {
  destination: (n: number) => string;
  stay: (n: number) => string;
  /** A search that matches nothing. */
  search: string;
};

const TEXT: Record<Locale3, Text> = {
  en: { destination: (n) => `[Destination ${n}]`, stay: (n) => `[Stay ${n}]`, search: "[Search text]" },
  ar: { destination: (n) => `[الوجهة ${n}]`, stay: (n) => `[الإقامة ${n}]`, search: "[نص البحث]" },
  es: { destination: (n) => `[Destino ${n}]`, stay: (n) => `[Estancia ${n}]`, search: "[Texto de búsqueda]" },
};

/** The kit reads the almar-locale cookie and the shell does too; the harness picks the language from ?l=, so set it first. */
function Frame({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

/** Hidden record of every handler the list called, so a test can prove each control reaches its prop. */
function LogOutput({ entries }: { entries: string[] }) {
  return (
    <output data-testid="ops-stays-log" className="sr-only">
      {entries.join(" | ")}
    </output>
  );
}

function rowsOf(t: Text): StayRow[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `s${n}`,
    name: t.stay(n),
    destinationId: `d${((n - 1) % 3) + 1}`,
    destinationName: t.destination(((n - 1) % 3) + 1),
    connected: n % 4,
    published: n % 3 !== 0,
  }));
}

function ListScene({ ctx, empty, search: startSearch }: { ctx: SceneContext; empty?: boolean; search?: boolean }) {
  const t = TEXT[ctx.locale];
  const [rows, setRows] = useState<StayRow[]>(() => (empty ? [] : rowsOf(t)));
  const [search, setSearch] = useState(startSearch ? t.search : "");
  const [destinationId, setDestinationId] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const note = (entry: string) => setLog((previous) => [...previous, entry]);

  function move(id: string, by: -1 | 1) {
    note(`move:${id}:${by}`);
    setRows((previous) => {
      const at = previous.findIndex((row) => row.id === id);
      const to = at + by;
      if (at < 0 || to < 0 || to >= previous.length) return previous;
      const next = [...previous];
      const [taken] = next.splice(at, 1);
      next.splice(to, 0, taken);
      return next;
    });
  }

  function dropOrder(ids: string[]) {
    note(`drop:${ids.join(",")}`);
    setRows((previous) => ids.map((id) => previous.find((row) => row.id === id)).filter((row): row is StayRow => Boolean(row)));
  }

  return (
    <Frame locale={ctx.locale}>
      <StaysList
        locale={ctx.locale}
        rows={rows}
        destinations={[1, 2, 3].map((n) => ({ id: `d${n}`, name: t.destination(n) }))}
        search={search}
        onSearchChange={(next) => {
          note(`search:${next}`);
          setSearch(next);
        }}
        destinationId={destinationId}
        onDestinationChange={(next) => {
          note(`destination:${next}`);
          setDestinationId(next);
        }}
        onOpen={(row) => note(`open:${row.id}`)}
        onNew={() => note("new")}
        onMove={move}
        onDropOrder={dropOrder}
      />
      <LogOutput entries={log} />
    </Frame>
  );
}

// ---- the stay editor ---------------------------------------------------------------------------------------------

const PHOTO_KEYS = ["destinations/cartagena/hero.webp", "destinations/cartagena/inset.webp", "home/gallery/01.webp", "destinations/page/hero-2.webp"];
const photo = (key: string, n: number): MediaRef => ({ id: `m${n}`, key, url: mediaUrl(key), width: 1920, height: 1280, alt_en: `[Alt text ${n}]` });

/** The English the owner types (always English, whatever the dashboard language), and the Arabic and Spanish on Save. */
const WORDS: Record<"en" | Target, { line: (name: string) => string; item: (name: string, n: number) => string }> = {
  en: { line: (name) => `[${name}]`, item: (name, n) => `[${name} ${n}]` },
  ar: { line: (name) => `[${name} · ع]`, item: (name, n) => `[${name} ${n} · ع]` },
  es: { line: (name) => `[${name} · es]`, item: (name, n) => `[${name} ${n} · es]` },
};
const LINE_WORDS: Record<string, string> = {
  title: "Stay title",
  tagline: "Tagline",
  neighborhood: "Neighbourhood",
  guests_label: "Guests line",
  bathrooms_label: "Bathrooms line",
  beds_label: "Beds line",
  price_label: "Price line",
  price_note: "Price note",
};
const LIST_WORDS: Record<string, [string, number]> = {
  description: ["Paragraph", 2],
  amenities: ["Amenity", 4],
  inclusions: ["Inclusion", 3],
  policy_headings: ["Policy heading", 2],
};

function textOf(locale: "en" | Target): Fields {
  const w = WORDS[locale];
  const out: Fields = {};
  for (const [name, word] of Object.entries(LINE_WORDS)) out[name] = w.line(word);
  for (const [name, [word, n]] of Object.entries(LIST_WORDS)) out[name] = Array.from({ length: n }, (_, at) => w.item(word, at + 1));
  return out;
}

const DESTINATIONS: Record<Locale3, DestinationChoice[]> = Object.fromEntries(
  (["en", "ar", "es"] as const).map((locale) => [locale, [1, 2, 3].map((n) => ({ id: `d${n}`, name: TEXT[locale].destination(n), published: n !== 3 }))]),
) as Record<Locale3, DestinationChoice[]>;

const CATALOG: CatalogChoice[] = [
  { id: "e1", name: "[Experience 1]", kind: "experience" },
  { id: "e2", name: "[Experience 2]", kind: "experience" },
  { id: "e3", name: "[Experience 3]", kind: "experience" },
  { id: "e4", name: "[Experience 4]", kind: "experience" },
  { id: "v1", name: "[Service 1]", kind: "service" },
  { id: "v2", name: "[Service 2]", kind: "service" },
  { id: "v3", name: "[Service 3]", kind: "service" },
];

type EditorState = "new" | "draft" | "pets-fee" | "translations" | "published";

function formOf(state: EditorState): StayForm {
  if (state === "new") return emptyStayForm();
  const translated = state === "translations" || state === "published";
  return {
    facts: {
      destinationId: "d1",
      slug: "stay-one",
      maxGuests: "6",
      minGuests: "1",
      bedrooms: "3",
      bathrooms: "2",
      minNights: "2",
      petsRule: state === "pets-fee" ? "fee" : "allowed",
      petsFee: "",
      infants: "no",
    },
    english: textOf("en"),
    translations: translated ? { ar: textOf("ar"), es: textOf("es") } : { ar: emptyStayForm().translations.ar, es: emptyStayForm().translations.es },
    hero: photo(PHOTO_KEYS[0]!, 1),
    gallery: PHOTO_KEYS.slice(1).map((key, at) => photo(key, at + 2)),
    connected: ["e1", "e2", "v1"],
  };
}

function detailOf(form: StayForm, published: boolean): StayDetail {
  const record = (locale: "en" | Target) => {
    const fields = locale === "en" ? form.english : form.translations[locale];
    return { ...(fields as unknown as Record<string, unknown>), status: published ? "published" : "draft" } as never;
  };
  return {
    id: "s1",
    slug: form.facts.slug,
    destination_id: form.facts.destinationId,
    is_published: published,
    position: 1,
    max_guests: 6,
    min_guests: 1,
    bedrooms: 3,
    bathrooms: 2,
    min_nights: 2,
    pets_rule: "allowed",
    pets_fee_aed: null,
    infants_count: false,
    base_nightly_rate_aed: null,
    hero_media_id: form.hero?.id ?? null,
    hero: form.hero,
    gallery: form.gallery,
    experience_ids: ["e1", "e2"],
    service_ids: ["v1"],
    has_access: false,
    translations: { en: record("en"), ar: published ? record("ar") : null, es: published ? record("es") : null },
    translation_state: { en: published ? "published" : "draft", ar: published ? "published" : "missing", es: published ? "published" : "missing" } as never,
    updated_at: "2026-10-15T00:00:00Z",
  };
}

/** The scene's own answer to the translate request: bracket words, never a model. */
const okSend: Send = async (_path, body) => {
  const { target, fields } = body as { target: Target; fields: Record<string, string | string[]> };
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(fields)) out[name] = Array.isArray(value) ? value.map((_, at) => WORDS[target].item(name, at + 1)) : WORDS[target].line(name);
  return { ok: true, target, fields: out };
};

function EditorScene({ ctx, state }: { ctx: SceneContext; state: EditorState }) {
  const published = state === "published" || state === "translations";
  // Edit translations: the page opens clean, and the spec types in the Arabic amenities as the owner would (a page that
  // was dirty before her first click could meet the kit's Back guard on a reload and ask "Discard changes?").
  const start = formOf(state);
  const [form, setForm] = useState<StayForm>(start);
  const [saved, setSaved] = useState<StayForm>(start);
  const [log, setLog] = useState<string[]>([]);
  const note = (entry: string) => setLog((previous) => [...previous, entry]);
  const stay = state === "new" ? null : detailOf(start, published);
  const warnings: PublishWarningCode[] = state === "published" ? ["no_base_rate"] : [];
  const live = published ? { ar: Object.keys(LINE_WORDS).concat(Object.keys(LIST_WORDS)), es: Object.keys(LINE_WORDS).concat(Object.keys(LIST_WORDS)) } : {};

  return (
    <Frame locale={ctx.locale}>
      <StayEditor
        locale={ctx.locale}
        list={<p>[List]</p>}
        openKey={stay ? stay.id : "new"}
        onClose={() => note("close")}
        stay={stay}
        reload={async () => note("reload")}
        form={form}
        saved={saved}
        onFormChange={setForm}
        destinations={DESTINATIONS[ctx.locale]}
        catalog={CATALOG}
        destinationItems={form.facts.destinationId === "d1" ? ["e3", "v2"] : []}
        error={null}
        warnings={warnings}
        onSave={async (payload, intent) => {
          note(`save:${intent}`);
          const next = { ...form, translations: { ar: { ...form.translations.ar, ...payload.translations.ar }, es: { ...form.translations.es, ...payload.translations.es } } };
          setForm(next);
          setSaved(next);
          return true;
        }}
        onPublish={() => note("publish")}
        onUnpublish={() => note("unpublish")}
        onDelete={() => note("delete")}
        liveTranslations={live}
        send={okSend}
      />
      <LogOutput entries={log} />
    </Frame>
  );
}

export const scenes: Scenes = {
  list: (ctx) => <ListScene ctx={ctx} />,
  "list-empty": (ctx) => <ListScene ctx={ctx} empty />,
  "list-no-match": (ctx) => <ListScene ctx={ctx} search />,
  "editor-new": (ctx) => <EditorScene ctx={ctx} state="new" />,
  "editor-draft": (ctx) => <EditorScene ctx={ctx} state="draft" />,
  "editor-pets-fee": (ctx) => <EditorScene ctx={ctx} state="pets-fee" />,
  "editor-translations": (ctx) => <EditorScene ctx={ctx} state="translations" />,
  "editor-published": (ctx) => <EditorScene ctx={ctx} state="published" />,
};

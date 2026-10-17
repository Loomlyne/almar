"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees (job 02: the layout picks a mode, the shell itself is a client component). The scene
// frames every state in the preview shell so the rail and the density match.
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { ConnectPicker } from "../../../components/ops/connect-picker";
import { DateRangeField } from "../../../components/ops/date-range-field";
import { EditPage, type SaveIntent, type SavePayload } from "../../../components/ops/edit-page";
import { ListTable, type Column } from "../../../components/ops/list-table";
import { missingForPublish } from "../../../components/ops/publish-check";
import { StatusChip } from "../../../components/ops/status-chip";
import type { Fields, Target } from "../../../components/ops/auto-translate";
import type { Locale3, OpsError, PublishWarningCode } from "../../../components/ops/api-types";
import { Button } from "../../../components/ui/button";
import { Field } from "../../../components/ui/field";
import { DASHBOARD_COPY } from "../../../lib/copy/dashboard";
import { OPS_KIT_COPY } from "../../../lib/copy/ops-kit";
import type { SceneContext, Scenes } from "../scene-types";

/**
 * Every state of the dashboard editor kit, bracket data only. Chrome words are the canvas strings (boards
 * DashDestinations, DashServices) and the kit's own copy; the placeholders show where a real value goes. The editor
 * page (kit panel B) calls the real translate route through opsSend: the spec answers it with page.route fixtures.
 * Test-only.
 */
type Text = {
  stays: string;
  name: string;
  shortLine: string;
  description: string;
  status: string;
  connectedTo: string;
  dates: string;
  searchStays: string;
  connectSeveral: string;
  fromDestination: string;
  webAddress: string;
  nameValue: string;
  shortValue: string;
  descriptionValue: string;
  addressValue: string;
  destinationValue: string;
  rowName: (n: number) => string;
  stayName: (n: number) => string;
};

const TEXT: Record<Locale3, Text> = {
  en: {
    stays: "Stays",
    name: "Name",
    shortLine: "Short line",
    description: "Description",
    status: "Status",
    connectedTo: "Connected to",
    dates: "Dates",
    searchStays: "Search stays to connect",
    connectSeveral: "Connect several stays",
    fromDestination: "From the destination",
    webAddress: "Web address",
    nameValue: "[Name]",
    shortValue: "[Short line]",
    descriptionValue: "[Description]",
    addressValue: "[web-address]",
    destinationValue: "[Destination]",
    rowName: (n) => `[Name ${n}]`,
    stayName: (n) => `[Stay ${n}]`,
  },
  ar: {
    stays: "الإقامات",
    name: "الاسم",
    shortLine: "سطر قصير",
    description: "الوصف",
    status: "الحالة",
    connectedTo: "مرتبط بـ",
    dates: "التواريخ",
    searchStays: "ابحث عن إقامات للربط",
    connectSeveral: "ربط عدة إقامات",
    fromDestination: "من الوجهة",
    webAddress: "عنوان الويب",
    nameValue: "[الاسم]",
    shortValue: "[سطر قصير]",
    descriptionValue: "[الوصف]",
    addressValue: "[web-address]",
    destinationValue: "[الوجهة]",
    rowName: (n) => `[الاسم ${n}]`,
    stayName: (n) => `[الإقامة ${n}]`,
  },
  es: {
    stays: "Estancias",
    name: "Nombre",
    shortLine: "Línea breve",
    description: "Descripción",
    status: "Estado",
    connectedTo: "Conectado a",
    dates: "Fechas",
    searchStays: "Buscar estancias para conectar",
    connectSeveral: "Conectar varias estancias",
    fromDestination: "Del destino",
    webAddress: "Dirección web",
    nameValue: "[Nombre]",
    shortValue: "[Línea breve]",
    descriptionValue: "[Descripción]",
    addressValue: "[web-address]",
    destinationValue: "[Destino]",
    rowName: (n) => `[Nombre ${n}]`,
    stayName: (n) => `[Estancia ${n}]`,
  },
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

/** Hidden record of every handler the kit called, so a test can prove each control reaches its prop. */
function LogOutput({ entries }: { entries: string[] }) {
  return (
    <output data-testid="ops-kit-log" className="sr-only">
      {entries.join(" | ")}
    </output>
  );
}

type Row = { id: string; name: string; published: boolean; destination: string };

function rowsOf(t: Text): Row[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `r${n}`,
    name: t.rowName(n),
    published: n % 3 !== 0,
    destination: t.destinationValue,
  }));
}

function columnsOf(t: Text, locale: Locale3): Column<Row>[] {
  return [
    { key: "name", label: t.name, phone: "title", render: (row) => row.name },
    { key: "status", label: t.status, phone: "meta", render: (row) => <StatusChip published={row.published} locale={locale} /> },
    { key: "connected", label: t.connectedTo, phone: "meta", render: (row) => row.destination },
  ];
}

type PageVariant = "new" | "draft" | "dirty" | "published" | "error" | "warning";

/** The three translated fields, by the names the translate route and the missing list use. */
const NAMES = ["name", "short_line", "summary"] as const;
type Name = (typeof NAMES)[number];
type Values = Record<Locale3, Record<Name, string>>;

function initialValues(variant: PageVariant, t: Text): Values {
  const blank = { name: "", short_line: "", summary: "" };
  const full = { name: t.nameValue, short_line: t.shortValue, summary: t.descriptionValue };
  if (variant === "new") return { en: { ...blank, name: t.nameValue }, ar: blank, es: blank };
  return { en: full, ar: full, es: full };
}

const SERVER_MISSING: OpsError = {
  code: "publish_incomplete",
  field: null,
  locale: null,
  detail: {
    missing: [
      { locale: "ar", field: "summary" },
      { locale: "es", field: "short_line" },
      { locale: null, field: "hero_media_id" },
    ],
  },
};

const fieldsOf = (values: Record<Name, string>): Fields => ({ ...values });
const textOf = (value: unknown) => (typeof value === "string" ? value : Array.isArray(value) ? value.join("\n") : "");

function PageScene({ ctx, variant }: { ctx: SceneContext; variant: PageVariant }) {
  const t = TEXT[ctx.locale];
  const copy = DASHBOARD_COPY[ctx.locale];
  const kit = OPS_KIT_COPY[ctx.locale];
  const [openKey, setOpenKey] = useState<string | null>(variant === "new" ? "new" : "r1");
  const [published, setPublished] = useState(variant === "published" || variant === "warning");
  // "dirty" opens with an English word not yet saved: the Back guard is up from the first render (follow-up 2).
  const [values, setValues] = useState<Values>(() => {
    const start = initialValues(variant, t);
    return variant === "dirty" ? { ...start, en: { ...start.en, name: "[Unsaved]" } } : start;
  });
  const [saved, setSaved] = useState<Values>(() => initialValues(variant, t));
  const [isNew, setIsNew] = useState(variant === "new");
  const [error, setError] = useState<OpsError | null>(variant === "error" ? SERVER_MISSING : null);
  const [log, setLog] = useState<string[]>([]);
  const note = (entry: string) => setLog((previous) => [...previous, entry]);

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const hasPhoto = variant !== "new";
  // The client check, from the same function the screens use; the server list replaces it on a 409.
  const missing = missingForPublish("destination", {
    translations: { en: values.en, ar: values.ar, es: values.es },
    media_id: hasPhoto ? "m1" : null,
  });
  const warnings: PublishWarningCode[] = variant === "warning" ? ["no_base_rate", "no_price"] : [];

  function editEnglish(name: Name, next: string) {
    setValues((previous) => ({ ...previous, en: { ...previous.en, [name]: next } }));
    setError(null);
  }

  function onSave(payload: SavePayload, intent: SaveIntent): Promise<boolean> {
    note(`save:${intent}:${payload.complete ? "complete" : "incomplete"}`);
    const next: Values = {
      en: values.en,
      ar: { name: textOf(payload.translations.ar.name), short_line: textOf(payload.translations.ar.short_line), summary: textOf(payload.translations.ar.summary) },
      es: { name: textOf(payload.translations.es.name), short_line: textOf(payload.translations.es.short_line), summary: textOf(payload.translations.es.summary) },
    };
    setValues(next);
    setSaved(next);
    setIsNew(false);
    if (intent === "publish") setPublished(true);
    return Promise.resolve(true);
  }

  const list = (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.rail.destinations}</h1>
      <ListTable
        caption={copy.rail.destinations}
        columns={columnsOf(t, ctx.locale)}
        rows={rowsOf(t).slice(0, 3)}
        onOpen={(row) => {
          note(`open:${row.id}`);
          setOpenKey(row.id);
        }}
        empty={null}
      />
    </div>
  );

  return (
    <Frame locale={ctx.locale}>
      <LogOutput entries={log} />
      <EditPage
        openKey={openKey}
        list={list}
        backLabel={copy.rail.destinations}
        onClose={() => {
          note("close");
          setValues(saved);
          setOpenKey(null);
        }}
        title={isNew ? copy.newDestination : values.en.name || t.nameValue}
        isNew={isNew}
        isPublished={published}
        dirty={dirty}
        missing={missing}
        warnings={warnings}
        error={error}
        fieldLabel={(field) => (field === "summary" ? t.description.toLowerCase() : undefined)}
        english={fieldsOf(values.en)}
        savedEnglish={fieldsOf(saved.en)}
        translations={{ ar: fieldsOf(values.ar), es: fieldsOf(values.es) }}
        translationFields={[
          { name: "name", label: t.name },
          { name: "short_line", label: t.shortLine },
          { name: "summary", label: t.description, multiline: true },
        ]}
        onTranslationChange={(target: Target, name, value) => {
          note(`translation:${target}:${name}`);
          setValues((previous) => ({ ...previous, [target]: { ...previous[target], [name]: textOf(value) } }));
        }}
        onSave={onSave}
        onPublish={() => {
          note("publish");
          setPublished(true);
        }}
        onUnpublish={() => {
          note("unpublish");
          setPublished(false);
        }}
        onDelete={() => note("delete")}
        sections={[
          {
            key: "text",
            title: kit.editor.sections.text,
            translatable: true,
            content: (
              <>
                <Field id="kit-name" label={t.name} className="max-w-none" lang="en" dir="ltr" value={values.en.name} onChange={(event) => editEnglish("name", event.target.value)} />
                <Field id="kit-short" label={t.shortLine} className="max-w-none" lang="en" dir="ltr" value={values.en.short_line} onChange={(event) => editEnglish("short_line", event.target.value)} />
                <Field
                  id="kit-description"
                  label={t.description}
                  className="max-w-none"
                  multiline
                  lang="en"
                  dir="ltr"
                  value={values.en.summary}
                  onChange={(event) => editEnglish("summary", event.target.value)}
                />
              </>
            ),
          },
          {
            key: "settings",
            title: kit.editor.sections.settings,
            column: "side",
            content: <Field id="kit-address" label={t.webAddress} className="max-w-none" dir="ltr" value={t.addressValue} readOnly />,
          },
        ]}
      />
    </Frame>
  );
}

function ListScene({ ctx, empty }: { ctx: SceneContext; empty?: boolean }) {
  const t = TEXT[ctx.locale];
  const copy = DASHBOARD_COPY[ctx.locale];
  const [rows, setRows] = useState<Row[]>(() => (empty ? [] : rowsOf(t)));
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
    setRows((previous) => ids.map((id) => previous.find((row) => row.id === id)).filter((row): row is Row => Boolean(row)));
  }

  return (
    <Frame locale={ctx.locale}>
      <div className="flex min-w-0 flex-col gap-6">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.rail.destinations}</h1>
        <ListTable
          caption={copy.rail.destinations}
          columns={columnsOf(t, ctx.locale)}
          rows={rows}
          onOpen={(row) => note(`open:${row.id}`)}
          reorder={{ onMove: move, onDropOrder: dropOrder }}
          empty={
            <div className="flex flex-col items-start gap-2">
              <p className="m-0 text-pretty text-body text-ink">{copy.noDestinationsYet}</p>
              <Button onClick={() => note("new")}>{copy.newDestination}</Button>
            </div>
          }
        />
        <LogOutput entries={log} />
      </div>
    </Frame>
  );
}

/** Today in Dubai plus `days`, as YYYY-MM-DD, so the two ranges are always in the future and in the month shown. */
function dayFromToday(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function DateRangeScene({ ctx }: { ctx: SceneContext }) {
  const t = TEXT[ctx.locale];
  const [oneDay, setOneDay] = useState({ first: dayFromToday(3) as string | null, last: dayFromToday(3) as string | null });
  const [range, setRange] = useState({ first: dayFromToday(7) as string | null, last: dayFromToday(12) as string | null });
  const [log, setLog] = useState<string[]>([]);
  const note = (entry: string) => setLog((previous) => [...previous, entry]);
  return (
    <Frame locale={ctx.locale}>
      <div className="flex min-w-0 flex-col gap-6">
        <DateRangeField
          id="kit-one-day"
          label={t.dates}
          value={oneDay}
          onChange={(next) => {
            note(`one-day:${next.first}:${next.last}`);
            setOneDay(next);
          }}
        />
        <DateRangeField
          id="kit-range"
          label={t.dates}
          value={range}
          onChange={(next) => {
            note(`range:${next.first}:${next.last}`);
            setRange(next);
          }}
        />
        <LogOutput entries={log} />
      </div>
    </Frame>
  );
}

function ConnectScene({ ctx }: { ctx: SceneContext }) {
  const t = TEXT[ctx.locale];
  const options = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `s${n}`, label: t.stayName(n), meta: t.destinationValue }));
  const [connected, setConnected] = useState<string[]>(["s1", "s2"]);
  const [log, setLog] = useState<string[]>([]);
  return (
    <Frame locale={ctx.locale}>
      <div className="flex min-w-0 flex-col gap-6">
        <ConnectPicker
          title={t.stays}
          searchLabel={t.searchStays}
          hint={t.connectSeveral}
          options={options}
          connected={connected}
          groups={[{ label: t.fromDestination, ids: ["s7"] }]}
          onChange={(ids) => {
            setLog((previous) => [...previous, `connected:${ids.join(",")}`]);
            setConnected(ids);
          }}
        />
        <LogOutput entries={log} />
      </div>
    </Frame>
  );
}

export const scenes: Scenes = {
  "page-new": (ctx) => <PageScene ctx={ctx} variant="new" />,
  "page-draft": (ctx) => <PageScene ctx={ctx} variant="draft" />,
  "page-dirty": (ctx) => <PageScene ctx={ctx} variant="dirty" />,
  "page-published": (ctx) => <PageScene ctx={ctx} variant="published" />,
  "page-error": (ctx) => <PageScene ctx={ctx} variant="error" />,
  "page-warning": (ctx) => <PageScene ctx={ctx} variant="warning" />,
  list: (ctx) => <ListScene ctx={ctx} />,
  "list-empty": (ctx) => <ListScene ctx={ctx} empty />,
  "date-range": (ctx) => <DateRangeScene ctx={ctx} />,
  connect: (ctx) => <ConnectScene ctx={ctx} />,
};

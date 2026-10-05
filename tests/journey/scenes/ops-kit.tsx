"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell as it is on this branch (the layout). When job 02 lands, its OpsShell replaces this file's frame:
// swap `OpsLayout` for `<OpsShell mode="preview">` in Frame below and nothing else changes.
import OpsLayout from "../../../app/dashboard/(ops)/layout";
import { ConnectPicker } from "../../../components/ops/connect-picker";
import { DateRangeField } from "../../../components/ops/date-range-field";
import { EditPanel } from "../../../components/ops/edit-panel";
import { LocaleTabs } from "../../../components/ops/locale-tabs";
import { ListTable, type Column } from "../../../components/ops/list-table";
import { PublishBar } from "../../../components/ops/publish-bar";
import { missingForPublish } from "../../../components/ops/publish-check";
import { StatusChip } from "../../../components/ops/status-chip";
import type { Locale3, OpsError, PublishWarningCode, TranslationState } from "../../../components/ops/api-types";
import { Button } from "../../../components/ui/button";
import { Field } from "../../../components/ui/field";
import { DASHBOARD_COPY } from "../../../lib/copy/dashboard";
import type { SceneContext, Scenes } from "../scene-types";

/**
 * Every state of the dashboard editor kit, bracket data only. Chrome words are the canvas strings (boards
 * DashDestinations, DashServices); the placeholders show where a real value goes. Test-only.
 */
type Text = {
  details: string;
  stays: string;
  services: string;
  name: string;
  shortLine: string;
  description: string;
  status: string;
  connectedTo: string;
  dates: string;
  searchStays: string;
  connectSeveral: string;
  fromDestination: string;
  translateSlot: string;
  nameValue: string;
  shortValue: string;
  descriptionValue: string;
  tabNote: string;
  destinationValue: string;
  rowName: (n: number) => string;
  stayName: (n: number) => string;
};

const TEXT: Record<Locale3, Text> = {
  en: {
    details: "Details",
    stays: "Stays",
    services: "Experiences and services",
    name: "Name",
    shortLine: "Short line",
    description: "Description",
    status: "Status",
    connectedTo: "Connected to",
    dates: "Dates",
    searchStays: "Search stays to connect",
    connectSeveral: "Connect several stays",
    fromDestination: "From the destination",
    translateSlot: "[Translate button]",
    nameValue: "[Name]",
    shortValue: "[Short line]",
    descriptionValue: "[Description]",
    tabNote: "[Content of this tab]",
    destinationValue: "[Destination]",
    rowName: (n) => `[Name ${n}]`,
    stayName: (n) => `[Stay ${n}]`,
  },
  ar: {
    details: "التفاصيل",
    stays: "الإقامات",
    services: "التجارب والخدمات",
    name: "الاسم",
    shortLine: "سطر قصير",
    description: "الوصف",
    status: "الحالة",
    connectedTo: "مرتبط بـ",
    dates: "التواريخ",
    searchStays: "ابحث عن إقامات للربط",
    connectSeveral: "ربط عدة إقامات",
    fromDestination: "من الوجهة",
    translateSlot: "[زر الترجمة]",
    nameValue: "[الاسم]",
    shortValue: "[سطر قصير]",
    descriptionValue: "[الوصف]",
    tabNote: "[محتوى هذا التبويب]",
    destinationValue: "[الوجهة]",
    rowName: (n) => `[الاسم ${n}]`,
    stayName: (n) => `[الإقامة ${n}]`,
  },
  es: {
    details: "Detalles",
    stays: "Estancias",
    services: "Experiencias y servicios",
    name: "Nombre",
    shortLine: "Línea breve",
    description: "Descripción",
    status: "Estado",
    connectedTo: "Conectado a",
    dates: "Fechas",
    searchStays: "Buscar estancias para conectar",
    connectSeveral: "Conectar varias estancias",
    fromDestination: "Del destino",
    translateSlot: "[Botón Traducir]",
    nameValue: "[Nombre]",
    shortValue: "[Línea breve]",
    descriptionValue: "[Descripción]",
    tabNote: "[Contenido de esta pestaña]",
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
  return ready ? <OpsLayout>{children}</OpsLayout> : null;
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

/** The list behind a panel: the same table, nothing reordered. */
function Behind({ ctx }: { ctx: SceneContext }) {
  const t = TEXT[ctx.locale];
  const copy = DASHBOARD_COPY[ctx.locale];
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.rail.destinations}</h1>
      <ListTable caption={copy.rail.destinations} columns={columnsOf(t, ctx.locale)} rows={rowsOf(t).slice(0, 3)} onOpen={() => undefined} empty={null} />
    </div>
  );
}

type PanelVariant = "new" | "draft-ar" | "published" | "error" | "warning" | "discard";

type Values = Record<Locale3, { name: string; short: string; description: string }>;

function initialValues(variant: PanelVariant, t: Text): Values {
  const blank = { name: "", short: "", description: "" };
  const full = { name: t.nameValue, short: t.shortValue, description: t.descriptionValue };
  if (variant === "new") return { en: { ...blank, name: t.nameValue }, ar: blank, es: blank };
  if (variant === "draft-ar") return { en: full, ar: full, es: blank };
  return { en: full, ar: full, es: full };
}

const SERVER_MISSING: OpsError = {
  code: "publish_incomplete",
  field: null,
  locale: null,
  detail: {
    missing: [
      { locale: "ar", field: "description" },
      { locale: "es", field: "short_line" },
      { locale: null, field: "hero_media_id" },
    ],
  },
};

function PanelScene({ ctx, variant }: { ctx: SceneContext; variant: PanelVariant }) {
  const t = TEXT[ctx.locale];
  const copy = DASHBOARD_COPY[ctx.locale];
  const published = variant === "published" || variant === "warning";
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState("details");
  const [lang, setLang] = useState<Locale3>(variant === "draft-ar" ? "ar" : "en");
  const [values, setValues] = useState<Values>(() => initialValues(variant, t));
  const [checked, setChecked] = useState({ ar: published, es: published });
  const [dirty, setDirty] = useState(variant !== "new");
  const [error, setError] = useState<OpsError | null>(variant === "error" ? SERVER_MISSING : null);
  const [log, setLog] = useState<string[]>([]);
  const note = (entry: string) => setLog((previous) => [...previous, entry]);

  const hasPhoto = variant !== "new";
  const record = (locale: Locale3) => ({
    name: values[locale].name,
    short_line: values[locale].short,
    summary: values[locale].description,
  });
  // The client check, from the same function the screens use; the server list replaces it on a 409.
  const missing = missingForPublish("destination", {
    translations: { en: record("en"), ar: record("ar"), es: record("es") },
    media_id: hasPhoto ? "m1" : null,
  });
  const state = (locale: Locale3): TranslationState => {
    if (values[locale].name.trim() === "") return "missing";
    if (locale === "en") return "published";
    return checked[locale] ? "published" : "draft";
  };
  const warnings: PublishWarningCode[] = variant === "warning" ? ["no_base_rate", "no_price"] : [];

  function edit(field: "name" | "short" | "description", next: string) {
    setValues((previous) => ({ ...previous, [lang]: { ...previous[lang], [field]: next } }));
    setDirty(true);
    setError(null);
  }

  return (
    <Frame locale={ctx.locale}>
      <Behind ctx={ctx} />
      <LogOutput entries={log} />
      <EditPanel
        open={open}
        onOpenChange={(next) => {
          note(next ? "open" : "close");
          setOpen(next);
        }}
        title={variant === "new" ? copy.newDestination : t.nameValue}
        tabs={[
          { key: "details", label: t.details },
          { key: "stays", label: t.stays },
          { key: "services", label: t.services },
        ]}
        tab={tab}
        onTabChange={setTab}
        dirty={dirty}
        footer={
          <PublishBar
            isNew={variant === "new"}
            isPublished={published}
            dirty={dirty}
            busy={false}
            missing={missing}
            warnings={warnings}
            error={error}
            fieldLabel={(field) => (field === "summary" ? t.description : undefined)}
            onSave={() => {
              note("save");
              setDirty(false);
            }}
            onPublish={() => note("publish")}
            onUnpublish={() => note("unpublish")}
            onDelete={() => note("delete")}
          />
        }
      >
        {tab === "details" ? (
          <LocaleTabs
            value={lang}
            onChange={setLang}
            state={{ en: state("en"), ar: state("ar"), es: state("es") }}
            checked={checked}
            onCheckedChange={(locale, next) => {
              note(`checked:${locale}:${next}`);
              setChecked((previous) => ({ ...previous, [locale]: next }));
              setDirty(true);
            }}
            toolbar={
              <span className="inline-flex min-h-control items-center border border-dashed border-line px-4 text-label text-muted">
                {t.translateSlot}
              </span>
            }
          >
            <Field id="kit-name" label={t.name} className="max-w-none" value={values[lang].name} onChange={(event) => edit("name", event.target.value)} />
            <Field id="kit-short" label={t.shortLine} className="max-w-none" value={values[lang].short} onChange={(event) => edit("short", event.target.value)} />
            <Field
              id="kit-description"
              label={t.description}
              className="max-w-none"
              multiline
              value={values[lang].description}
              onChange={(event) => edit("description", event.target.value)}
            />
          </LocaleTabs>
        ) : (
          <p className="m-0 text-label text-muted">{t.tabNote}</p>
        )}
      </EditPanel>
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
  "panel-new": (ctx) => <PanelScene ctx={ctx} variant="new" />,
  "panel-draft-ar": (ctx) => <PanelScene ctx={ctx} variant="draft-ar" />,
  "panel-published": (ctx) => <PanelScene ctx={ctx} variant="published" />,
  "panel-error": (ctx) => <PanelScene ctx={ctx} variant="error" />,
  "panel-warning": (ctx) => <PanelScene ctx={ctx} variant="warning" />,
  list: (ctx) => <ListScene ctx={ctx} />,
  "list-empty": (ctx) => <ListScene ctx={ctx} empty />,
  "date-range": (ctx) => <DateRangeScene ctx={ctx} />,
  connect: (ctx) => <ConnectScene ctx={ctx} />,
  discard: (ctx) => <PanelScene ctx={ctx} variant="discard" />,
};

"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import type { Locale3, NavArea, OpsError } from "../../../../../components/ops/api-types";
import { EditPage, type EditSection, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { LockIcon, PlusIcon } from "../../../../../components/icons/icons";
import { SITE_CONTACT } from "../../../../../components/site/public-frame";
import { Button } from "../../../../../components/ui/button";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { LINK_BUTTON_DANGER, RemoveMark } from "../../../../../components/ui/link";
import { Select } from "../../../../../components/ui/select";
import { Switch } from "../../../../../components/ui/switch";
import { ToggleCard } from "../../../../../components/ui/toggle-card";
import { HOME_COPY } from "../../../../../lib/copy/home";
import { OPS_CONTENT_COPY } from "../../../../../lib/copy/ops-content";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_NAV_COPY } from "../../../../../lib/copy/ops-nav";
import { OPS_PAGES_COPY } from "../../../../../lib/copy/ops-pages";
import type { NavTargetOption } from "../../../../../lib/ops/site-pages-handlers";
import { focusMovedRow } from "../../catalog/move-focus";
import { ShownChip } from "../pages/pages-view";
import { MAX_AREA_LINKS, MAX_LABEL, MAX_URL, linkProblem, liveLinkFields, targetName, targetOnSite, webOk, type LinkForm } from "./nav-forms";

// Content -> Navigation and footer (plan 06-02, CMS-09, F-15, SITE-01, SITE-13; pictures signed 2026-10-27), driven by
// props like TeamView. Two blocks, Header and Footer: each a list of links (label, where it goes, Shown or Hidden, Move up
// and Move down) plus Add link. Under Header the fixed rows Currency, Language and Login (always last); under Footer the
// fixed contact details from SITE_CONTACT. Fixed rows are text, never controls.

export type LinkRow = { id: string; label: string; to: string; external: boolean; shown: boolean };

export type LinkPanel = {
  area: NavArea;
  form: LinkForm;
  saved: LinkForm | null;
  onForm: (next: LinkForm) => void;
  dirty: boolean;
  busy: boolean;
  error: OpsError | null;
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
  send?: Send;
};

function FixedLine({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-start gap-2 text-label text-muted">
      <LockIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="text-pretty">{children}</span>
    </span>
  );
}

function FixedRows({ rows }: { rows: { name: string; value: ReactNode }[] }) {
  return (
    <dl className="m-0 grid border-t border-line">
      {rows.map((row) => (
        <div key={row.name} className="grid gap-1 border-b border-line py-3 md:grid-cols-[12rem_1fr] md:gap-4">
          <dt className="text-label text-ink">{row.name}</dt>
          <dd className="m-0">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AreaBlock({
  area,
  rows,
  onOpen,
  onNew,
  onMove,
  onDropOrder,
  reordering,
  children,
}: {
  area: NavArea;
  rows: LinkRow[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onMove: (id: string, by: -1 | 1) => boolean | void;
  onDropOrder: (ids: string[]) => void;
  reordering: boolean;
  children: ReactNode;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_NAV_COPY[loc];
  const pages = OPS_PAGES_COPY[loc];
  const kit = OPS_KIT_COPY[loc];
  const ref = useRef<HTMLDivElement>(null);
  const moved = useRef<{ name: string; by: -1 | 1 } | null>(null);
  useEffect(() => {
    if (reordering || !moved.current) return;
    focusMovedRow(ref.current, moved.current.name, moved.current.by, { up: kit.moveUp, down: kit.moveDown });
    moved.current = null;
  }, [reordering]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = area === "header" ? copy.header : copy.footer;
  const columns: Column<LinkRow>[] = [
    { key: "label", label: copy.colLabel, phone: "title", render: (row) => row.label },
    {
      key: "to",
      label: copy.colTo,
      phone: "meta",
      render: (row) => (
        <span dir={row.external ? "ltr" : undefined} className={row.external ? "break-all" : undefined}>
          {row.to}
        </span>
      ),
    },
    { key: "shown", label: copy.colShown, phone: "meta", render: (row) => <ShownChip shown={row.shown} copy={pages} /> },
  ];
  const full = rows.length >= MAX_AREA_LINKS;
  return (
    <section aria-labelledby={`nav-${area}`} className="flex min-w-0 flex-col gap-4 border border-line bg-surface p-4 md:p-6">
      <h2 id={`nav-${area}`} className="m-0 font-display text-title font-normal text-teal">
        {title}
      </h2>
      <div ref={ref} aria-busy={reordering || undefined}>
        <ListTable
          caption={title}
          columns={columns}
          rows={rows}
          onOpen={(row) => onOpen(row.id)}
          reorder={{
            onMove: (id, by) => {
              const name = rows.find((row) => row.id === id)?.label ?? "";
              if (onMove(id, by) !== false) moved.current = { name, by };
            },
            onDropOrder,
          }}
          empty={null}
        />
      </div>
      <div>
        <Button variant="secondary" disabled={full} onClick={onNew}>
          <PlusIcon size={16} aria-hidden="true" />
          {copy.addLink}
        </Button>
      </div>
      {children}
    </section>
  );
}

export function NavigationView({
  header,
  footer,
  onOpen,
  onNew,
  onMove,
  onDropOrder,
  reordering = null,
  panel,
  targets,
  notice,
}: {
  header: LinkRow[];
  footer: LinkRow[];
  onOpen: (area: NavArea, id: string) => void;
  onNew: (area: NavArea) => void;
  onMove: (area: NavArea, id: string, by: -1 | 1) => boolean | void;
  onDropOrder: (area: NavArea, ids: string[]) => void;
  /** The area whose order is on its way. */
  reordering?: NavArea | null;
  panel: LinkPanel | null;
  targets: NavTargetOption[];
  notice?: ReactNode;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_NAV_COPY[loc];
  const words = HOME_COPY[loc].nav;
  const title = OPS_CONTENT_TITLE[loc];

  const list = (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{title}</h1>
      {notice}
      <AreaBlock
        area="header"
        rows={header}
        onOpen={(id) => onOpen("header", id)}
        onNew={() => onNew("header")}
        onMove={(id, by) => onMove("header", id, by)}
        onDropOrder={(ids) => onDropOrder("header", ids)}
        reordering={reordering === "header"}
      >
        <FixedRows
          rows={[
            { name: words.currency, value: <FixedLine>{copy.toolsFixed}</FixedLine> },
            { name: words.language, value: <FixedLine>{copy.toolsFixed}</FixedLine> },
            { name: words.login, value: <FixedLine>{copy.loginFixed}</FixedLine> },
          ]}
        />
      </AreaBlock>
      <AreaBlock
        area="footer"
        rows={footer}
        onOpen={(id) => onOpen("footer", id)}
        onNew={() => onNew("footer")}
        onMove={(id, by) => onMove("footer", id, by)}
        onDropOrder={(ids) => onDropOrder("footer", ids)}
        reordering={reordering === "footer"}
      >
        <FixedLine>{copy.contactFixed}</FixedLine>
        <FixedRows
          rows={[
            { name: copy.email, value: <span dir="ltr" className="text-body text-ink md:text-label">{SITE_CONTACT.email}</span> },
            { name: copy.phone, value: <span dir="ltr" className="text-body text-ink tabular-nums md:text-label">{SITE_CONTACT.phone}</span> },
          ]}
        />
      </AreaBlock>
    </div>
  );

  return <LinkEditor panel={panel} list={list} targets={targets} backLabel={title} />;
}

/** The rail's name for this screen ("Navigation and footer"), in the dashboard's language. */
const OPS_CONTENT_TITLE: Record<Locale3, string> = {
  en: OPS_CONTENT_COPY.en.rail.navigation,
  ar: OPS_CONTENT_COPY.ar.rail.navigation,
  es: OPS_CONTENT_COPY.es.rail.navigation,
};

/** One link (kit EditPage): Label (English; the kit fills Arabic and Spanish), Link to, Show on site, Delete link. */
function LinkEditor({ panel, list, targets, backLabel }: { panel: LinkPanel | null; list: ReactNode; targets: NavTargetOption[]; backLabel: string }) {
  const loc = useDashboardLocale();
  const copy = OPS_NAV_COPY[loc];
  const pages = OPS_PAGES_COPY[loc];
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const [asking, setAsking] = useState(false);
  const form = panel?.form ?? null;
  const dir = loc === "ar" ? "rtl" : "ltr";
  const problem = form ? linkProblem(form) : null;
  const urlBad = form?.kind === "external" && form.url.trim() !== "" && !webOk(form.url);
  const offSite = form?.kind === "internal" && form.target !== "" && !targetOnSite(form.target, targets);

  function sections(panel: LinkPanel, form: LinkForm): EditSection[] {
    const { onForm } = panel;
    return [
      {
        key: "text",
        title: kit.editor.sections.text,
        translatable: true,
        content: (
          <Field
            id={`${idBase}-en-label`}
            label={copy.label}
            className="max-w-none"
            lang="en"
            dir="ltr"
            autoComplete="off"
            required
            maxLength={MAX_LABEL}
            value={form.text.en.label}
            onChange={(event: { target: { value: string } }) => onForm({ ...form, text: { ...form.text, en: { label: event.target.value } } })}
          />
        ),
      },
      {
        key: "to",
        title: copy.linkTo,
        content: (
          <>
            <div role="group" aria-label={copy.linkTo} className="grid gap-3 md:grid-cols-2">
              <ToggleCard pressed={form.kind === "internal"} onPress={() => onForm({ ...form, kind: "internal" })} title={copy.onSite} detail={copy.onSiteHint} />
              <ToggleCard pressed={form.kind === "external"} onPress={() => onForm({ ...form, kind: "external" })} title={copy.web} detail={copy.webHint} />
            </div>
            {form.kind === "internal" ? (
              <div className="flex flex-col gap-2">
                <span className="text-label text-ink" id={`${idBase}-page`}>
                  {copy.page}
                </span>
                <Select
                  value={form.target === "" ? null : form.target}
                  options={targets.map((option) => ({
                    value: option.key,
                    label: option.available ? targetName(copy, option.key, targets) : `${targetName(copy, option.key, targets)} ${copy.notYet}`,
                  }))}
                  onChange={(next) => onForm({ ...form, target: next })}
                  label={`${copy.page}: {name}`}
                  placeholder={copy.page}
                  dir={dir}
                  className="w-full"
                />
                {offSite ? <p className="m-0 border-s border-gold ps-2 text-pretty text-label text-ink">{copy.notYetLine}</p> : null}
              </div>
            ) : (
              <Field
                id={`${idBase}-url`}
                label={copy.webField}
                className="max-w-none"
                type="url"
                inputMode="url"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                maxLength={MAX_URL}
                value={form.url}
                error={urlBad ? copy.webBad : undefined}
                onChange={(event: { target: { value: string } }) => onForm({ ...form, url: event.target.value })}
              />
            )}
          </>
        ),
      },
      {
        key: "settings",
        title: kit.editor.sections.settings,
        column: "side",
        content: (
          <div className="flex flex-col gap-4">
            <Switch label={copy.showOnSite} checked={form.shown} onCheckedChange={(shown) => onForm({ ...form, shown })} />
            {form.id ? (
              <div className="border-t border-line pt-4">
                <button type="button" className={LINK_BUTTON_DANGER} disabled={panel.busy} onClick={() => setAsking(true)}>
                  <RemoveMark />
                  {copy.deleteLink}
                </button>
              </div>
            ) : null}
          </div>
        ),
      },
    ];
  }

  const title = form ? form.text.en.label.trim() || copy.newLink : "";

  return (
    <>
      <EditPage
        openKey={panel && form ? `${panel.area}:${form.key}` : null}
        list={list}
        backLabel={backLabel}
        onClose={() => panel?.onClose()}
        title={title}
        isNew={form?.id === null}
        isPublished
        status={form ? <ShownChip shown={form.shown} copy={pages} /> : undefined}
        dirty={panel?.dirty ?? false}
        busy={panel?.busy ?? false}
        canSave={problem === null}
        missing={[]}
        error={panel?.error ?? null}
        fieldLabel={(field) => (field === "label" ? copy.label : field === "target" ? copy.linkTo : undefined)}
        english={form ? { label: form.text.en.label } : {}}
        savedEnglish={panel?.saved ? { label: panel.saved.text.en.label } : {}}
        translations={form ? { ar: { label: form.text.ar.label }, es: { label: form.text.es.label } } : { ar: {}, es: {} }}
        locked={form?.locked}
        translationFields={[{ name: "label", label: copy.label, maxLength: MAX_LABEL }]}
        onTranslationChange={(target, _name, value) => {
          if (!panel || !form) return;
          panel.onForm({ ...form, text: { ...form.text, [target]: { label: Array.isArray(value) ? value.join(" ") : value } } });
        }}
        onSave={(payload, intent) => (panel ? panel.onSave(payload, intent) : Promise.resolve(false))}
        liveTranslations={liveLinkFields(panel?.saved ?? null)}
        holdOnFailure={panel?.saved?.shown === true}
        send={panel?.send}
        sections={panel && form ? sections(panel, form) : []}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={copy.deleteTitle}
        description={copy.deleteText}
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

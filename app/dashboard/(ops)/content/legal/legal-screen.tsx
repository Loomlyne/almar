"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import type { DetailReply, LegalDetail, LegalKind, LegalSummary, ListReply, OpsError, PublishResult, WriteResult } from "../../../../../components/ops/api-types";
import { EditPage, type EditSection, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { errorText } from "../../../../../components/ops/error-text";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { TextBlocksField } from "../../../../../components/ops/text-blocks-field";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { LockIcon } from "../../../../../components/icons/icons";
import { Chip } from "../../../../../components/ui/chip";
import { Field } from "../../../../../components/ui/field";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_LEGAL_COPY, type OpsLegalCopy, type OpsLegalStatus } from "../../../../../lib/copy/ops-legal";
import { chunkedSend } from "../../../../../lib/ops/translate-chunks";
import { LEGAL_CAPS } from "../../../../../lib/ops/validate-legal";
import { sameForm } from "../../catalog/catalog-forms";
import {
  LEGAL_KIND_ORDER,
  keepHeldText,
  legalBlockKinds,
  legalFields,
  legalForm,
  legalLocks,
  legalPayload,
  legalStatus,
  legalTranslationFields,
  legalWithTranslations,
  liveLegalFields,
  missingForLegal,
  sentBlockKeys,
  type LegalForm,
  type LegalTextField,
} from "./legal-forms";

// Content -> Legal (plan 06-04, F-07, F-05; pictures signed 2026-10-30). LegalView is driven entirely by props (the BlogView
// pattern); LegalScreen loads, saves, publishes and unpublishes through the kit client. Six fixed rows: nothing is created or
// deleted here, and every field starts empty: no legal or cookie wording is written by us.

/** ops_list('legal_page') also answers the English title: the list's "Not written" reads it. */
type LegalRow = LegalSummary & { title_en?: string | null };

export type LegalListRow = { kind: LegalKind; status: OpsLegalStatus };

function StatusLabel({ status, copy }: { status: OpsLegalStatus; copy: OpsLegalCopy }) {
  return (
    <Chip interactive={false} size="dense" on={status === "published"}>
      {copy.status[status]}
    </Chip>
  );
}

export type LegalPanel = {
  form: LegalForm;
  saved: LegalForm;
  onForm: (next: LegalForm) => void;
  dirty: boolean;
  busy: boolean;
  error: OpsError | null;
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  onPublish: () => void | Promise<unknown>;
  onUnpublish: () => void;
  onClose: () => void;
  send?: Send;
};

export function LegalView({ rows, onOpen, panel, notice }: { rows: LegalListRow[]; onOpen: (kind: LegalKind) => void; panel: LegalPanel | null; notice?: ReactNode }) {
  const loc = useDashboardLocale();
  const copy = OPS_LEGAL_COPY[loc];
  const columns: Column<LegalListRow>[] = [
    { key: "page", label: copy.colTitle, phone: "title", render: (row) => copy.kinds[row.kind] },
    { key: "status", label: copy.colStatus, phone: "meta", render: (row) => <StatusLabel status={row.status} copy={copy} /> },
  ];
  const list = (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
      {notice}
      <ListTable caption={copy.title} columns={columns} rows={rows.map((row) => ({ ...row, id: row.kind }))} onOpen={(row) => onOpen(row.kind)} empty={null} />
    </div>
  );
  return <LegalEditor panel={panel} list={list} copy={copy} />;
}

function LegalEditor({ panel, list, copy }: { panel: LegalPanel | null; list: ReactNode; copy: OpsLegalCopy }) {
  const loc = useDashboardLocale();
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const form = panel?.form ?? null;
  const fields = form ? legalTranslationFields(form, copy) : [];
  const labels: Record<string, string> = Object.fromEntries(fields.map((field) => [field.name, field.label]));

  function fieldLabel(field: string): string | undefined {
    // A server path ends in the block's `text` ("blocks.3.translations.en.text"), and "blocks" is the whole list.
    if (field === "blocks" || field === "text") return copy.f.blocks;
    return labels[field];
  }

  function text(p: LegalPanel, f: LegalForm, field: LegalTextField, label: string, opts: { multiline?: boolean; required?: boolean; max: number }) {
    const common = {
      id: `${idBase}-en-${field}`,
      label,
      className: "max-w-none",
      lang: "en",
      dir: "ltr" as const,
      required: opts.required,
      maxLength: opts.max,
      value: f.text.en[field],
      onChange: (event: { target: { value: string } }) => p.onForm({ ...f, text: { ...f.text, en: { ...f.text.en, [field]: event.target.value } } }),
    };
    return opts.multiline ? <Field {...common} multiline rows={4} /> : <Field {...common} autoComplete="off" />;
  }

  function sections(p: LegalPanel, f: LegalForm): EditSection[] {
    const kinds = legalBlockKinds(f.kind);
    const out: EditSection[] = [{ key: "text", title: copy.text, translatable: true, content: text(p, f, "title", copy.f.title, { required: true, max: LEGAL_CAPS.title }) }];
    if (kinds.length > 0) {
      out.push({
        key: "blocks",
        title: copy.f.blocks,
        content: (
          <>
            {f.kind === "booking_terms" ? (
              <p className="m-0 flex items-start gap-2 border-s border-gold ps-3 text-label text-muted">
                <LockIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{copy.bookingNote}</span>
              </p>
            ) : null}
            <TextBlocksField
              blocks={f.blocks}
              onChange={(blocks) => p.onForm({ ...f, blocks })}
              kinds={kinds}
              copy={{
                list: copy.f.blocks,
                kinds: copy.bk,
                add: { heading: copy.f.addHeading, paragraph: copy.f.addParagraph, quote: copy.f.addQuote },
                remove: copy.f.remove,
                empty: copy.empty,
              }}
              kit={kit}
              maxLength={LEGAL_CAPS.block}
            />
          </>
        ),
      });
    }
    if (f.kind === "cookie_banner") {
      out.push({
        key: "banner",
        title: copy.cookieSettings,
        content: (
          <>
            {text(p, f, "necessary_label", copy.f.necLabel, { max: LEGAL_CAPS.label })}
            {text(p, f, "necessary_body", copy.f.necText, { multiline: true, max: LEGAL_CAPS.body })}
            {text(p, f, "analytics_label", copy.f.anLabel, { max: LEGAL_CAPS.label })}
            {text(p, f, "analytics_body", copy.f.anText, { multiline: true, max: LEGAL_CAPS.body })}
          </>
        ),
      });
    } else {
      out.push({
        key: "seo",
        title: `${copy.seo} (${copy.optional})`,
        column: "side",
        content: (
          <>
            {text(p, f, "seo_title", copy.f.seoTitle, { max: LEGAL_CAPS.seo_title })}
            {text(p, f, "seo_description", copy.f.seoDescription, { multiline: true, max: LEGAL_CAPS.seo_description })}
          </>
        ),
      });
    }
    return out;
  }

  return (
    <EditPage
      openKey={panel && form ? form.id : null}
      list={list}
      backLabel={copy.title}
      onClose={() => panel?.onClose()}
      title={form ? copy.kinds[form.kind] : ""}
      isPublished={form?.published ?? false}
      status={panel ? <StatusLabel status={legalStatus({ title_en: panel.saved.text.en.title, is_published: panel.saved.published })} copy={copy} /> : undefined}
      dirty={panel?.dirty ?? false}
      busy={panel?.busy ?? false}
      canSave={form ? form.text.en.title.trim() !== "" : false}
      missing={form ? missingForLegal(form) : []}
      error={panel?.error ?? null}
      fieldLabel={fieldLabel}
      english={form ? legalFields(form, "en") : {}}
      savedEnglish={panel ? legalFields(panel.saved, "en") : {}}
      translations={form ? { ar: legalFields(form, "ar"), es: legalFields(form, "es") } : { ar: {}, es: {} }}
      locked={form ? legalLocks(form) : undefined}
      translationFields={fields}
      onTranslationChange={(target, name, value) => {
        if (!panel || !form) return;
        const next = Array.isArray(value) ? value.join(" ") : value;
        const block = form.blocks.find((b) => b.key === name);
        if (block) panel.onForm({ ...form, blocks: form.blocks.map((b) => (b.key === name ? { ...b, text: { ...b.text, [target]: next } } : b)) });
        else panel.onForm({ ...form, text: { ...form.text, [target]: { ...form.text[target], [name]: next } } });
      }}
      onSave={(payload, intent) => (panel ? panel.onSave(payload, intent) : Promise.resolve(false))}
      onPublish={() => panel?.onPublish()}
      onUnpublish={() => panel?.onUnpublish()}
      liveTranslations={panel ? liveLegalFields(panel.saved) : {}}
      holdOnFailure={form?.published ?? false}
      send={panel?.send}
      sections={panel && form ? sections(panel, form) : []}
    />
  );
}

const PATH = "/api/ops/legal";

type Open = { form: LegalForm; saved: LegalForm };

/**
 * Content -> Legal, connected: the six kinds (GET /api/ops/legal), one page (?kind=), Save (POST), Publish and Unpublish
 * (/api/ops/publish, entity legal_page). The kit's translate calls go through chunkedSend, so a long page stays within the
 * route's limits. `send` is the test seam; the page passes nothing.
 */
export function LegalScreen({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const kit = OPS_KIT_COPY[locale];

  const [rows, setRows] = useState<LegalRow[]>([]);
  const [listError, setListError] = useState<OpsError | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OpsError | null>(null);
  const writing = useRef(false);
  const translate = useRef<Send>(chunkedSend(send ?? (opsSend as unknown as Send)));

  async function loadList(): Promise<void> {
    const reply = await opsFetch<ListReply<LegalRow>>(PATH);
    if (reply.ok) setRows(reply.items);
    setListError(reply.ok ? null : reply.error);
  }

  useEffect(() => {
    void loadList();
  }, []);

  /** Loads one page into the editor; `sent` is the form just saved: its block keys and any held text stay. */
  async function openDetail(kind: LegalKind, sent?: LegalForm): Promise<OpsError | null> {
    const reply = await opsFetch<DetailReply<LegalDetail>>(PATH, { kind });
    if (!reply.ok) return reply.error;
    const read = legalForm(reply.item, sent ? sentBlockKeys(sent) : []);
    const form = sent ? keepHeldText(read, sent) : read;
    setOpen({ form, saved: form });
    return null;
  }

  async function onOpen(kind: LegalKind) {
    if (busy) return;
    setError(null);
    setBusy(true);
    const refusal = await openDetail(kind);
    setBusy(false);
    if (refusal) setListError(refusal);
  }

  /** One save; on `publish`, the publish call after it; then the page and the list are read again. */
  async function persist(form: LegalForm, publish: boolean): Promise<boolean> {
    if (writing.current) return false;
    const payload = legalPayload(form, { publish });
    if (!payload.ok) {
      setError({ code: "invalid", field: payload.field, locale: null, detail: null });
      return false;
    }
    writing.current = true;
    setBusy(true);
    setError(null);
    const saved = await opsSend<WriteResult>(PATH, payload.body);
    if (!saved.ok) {
      writing.current = false;
      setBusy(false);
      setError(saved.error);
      return false;
    }
    let publishError: OpsError | null = null;
    if (publish) {
      const published = await opsSend<PublishResult>("/api/ops/publish", { entity: "legal_page", id: saved.id, published: true });
      if (!published.ok) publishError = published.error;
    }
    const reread = await openDetail(form.kind, form);
    if (reread) {
      const held = { ...form, published: form.published || (publish && !publishError) };
      setOpen({ form: held, saved: held });
    }
    await loadList();
    writing.current = false;
    setBusy(false);
    setError(publishError ?? reread);
    return true;
  }

  function onSave(payload: SavePayload, intent: SaveIntent): Promise<boolean> {
    if (!open) return Promise.resolve(false);
    return persist(legalWithTranslations(open.form, payload.translations, payload.locked), intent === "publish");
  }

  async function onUnpublish() {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<PublishResult>("/api/ops/publish", { entity: "legal_page", id: open.form.id, published: false });
    if (!reply.ok) setError(reply.error);
    else {
      // The stored blocks are the last saved ones (the kit asks before Unpublish drops unsaved typing).
      setError(await openDetail(open.form.kind, open.saved));
      await loadList();
    }
    setBusy(false);
  }

  const shown: LegalListRow[] = LEGAL_KIND_ORDER.flatMap((kind) => {
    const row = rows.find((one) => one.kind === kind);
    return row ? [{ kind, status: legalStatus({ title_en: row.title_en, is_published: row.is_published }) }] : [];
  });

  return (
    <LegalView
      rows={shown}
      onOpen={(kind) => void onOpen(kind)}
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
              saved: open.saved,
              onForm: (form) => {
                setError(null);
                setOpen((was) => (was ? { ...was, form } : was));
              },
              dirty: !sameForm(open.form, open.saved),
              busy,
              error,
              onSave,
              onPublish: () => persist(open.form, true),
              onUnpublish: () => void onUnpublish(),
              onClose: () => {
                if (busy) return;
                setOpen(null);
                setError(null);
              },
              send: translate.current,
            }
          : null
      }
    />
  );
}

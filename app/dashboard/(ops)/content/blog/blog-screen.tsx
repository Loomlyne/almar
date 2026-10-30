"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import type {
  CatalogSummary,
  DestinationSummary,
  DetailReply,
  ListReply,
  Locale3,
  OpsError,
  PostDetail,
  PostSummary,
  PublishResult,
  StaySummary,
  WriteResult,
} from "../../../../../components/ops/api-types";
import { EditPage, type EditSection, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { errorText } from "../../../../../components/ops/error-text";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { MediaField } from "../../../../../components/ops/media-field";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { StatusChip } from "../../../../../components/ops/status-chip";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { PlusIcon } from "../../../../../components/icons/icons";
import { Button } from "../../../../../components/ui/button";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { Select } from "../../../../../components/ui/select";
import { DASHBOARD_COPY } from "../../../../../lib/copy/dashboard";
import { OPS_BLOG_COPY } from "../../../../../lib/copy/ops-blog";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { chunkedSend } from "../../../../../lib/ops/translate-chunks";
import { dubaiToday } from "../../../../../lib/ops/validate-posts";
import { LockedAddress } from "../../catalog/locked-address";
import { sameForm } from "../../catalog/catalog-forms";
import { PostBlocksField } from "./post-blocks-field";
import {
  POST_CAPS,
  blockFieldName,
  blockName,
  blockTranslationFields,
  emptyPostForm,
  futureDate,
  livePostFields,
  matchesPostSearch,
  missingBlockField,
  missingForPost,
  postFields,
  postForm,
  postLocks,
  postPayload,
  postWithTranslations,
  sentBlockKeys,
  slugOk,
  type PostForm,
} from "./post-forms";

// Content -> Blog (plan 06-03, SITE-10, F-08; pictures signed 2026-10-27). BlogView is driven entirely by props (the
// TeamView pattern); BlogScreen loads, saves, publishes and deletes through the kit client. Show and hide on the site
// are Publish and Unpublish. The address is typed by the owner and locked once the post has been published.

export type PostRow = { id: string; title: string; published: boolean; date: string };
export type LinkOption = { id: string; name: string };

/** "None" is a real option (sentinel, never ""), so the trigger always names the choice (memory "select empty value"). */
const NONE = "none";

const DATE_TAGS: Record<Locale3, string> = { en: "en-GB", ar: "ar-AE-u-nu-latn", es: "es" };
const dateIn = (iso: string, locale: Locale3) =>
  iso ? new Intl.DateTimeFormat(DATE_TAGS[locale], { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Dubai" }).format(new Date(iso)) : "";

const fill = (line: string, values: Record<string, string | number>) => line.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));

export type PostPanel = {
  form: PostForm;
  saved: PostForm;
  onForm: (next: PostForm) => void;
  dirty: boolean;
  busy: boolean;
  error: OpsError | null;
  /** Today in Dubai (YYYY-MM-DD): a later date cannot be saved. */
  today: string;
  destinations: LinkOption[];
  stays: LinkOption[];
  experiences: LinkOption[];
  onSave: (payload: SavePayload, intent: SaveIntent) => Promise<boolean>;
  onPublish: () => void | Promise<unknown>;
  onUnpublish: () => void;
  onDelete: () => void;
  onClose: () => void;
  send?: Send;
};

export function BlogView({
  rows,
  query,
  onQuery,
  onNew,
  onOpen,
  panel,
  notice,
}: {
  rows: PostRow[];
  query: string;
  onQuery: (next: string) => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  panel: PostPanel | null;
  notice?: ReactNode;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_BLOG_COPY[loc];
  const title = DASHBOARD_COPY[loc].rail.blog;
  const searchId = useId();
  const shown = rows.filter((row) => matchesPostSearch({ title_en: row.title }, query));

  const columns: Column<PostRow>[] = [
    { key: "title", label: copy.colTitle, phone: "title", render: (row) => row.title },
    { key: "status", label: copy.colStatus, phone: "meta", render: (row) => <StatusChip published={row.published} locale={loc} /> },
    { key: "date", label: copy.colDate, phone: "meta", render: (row) => dateIn(row.date, loc) },
  ];
  const newButton = (
    <Button onClick={onNew}>
      <PlusIcon size={16} aria-hidden="true" />
      {copy.newPost}
    </Button>
  );

  const list = (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{title}</h1>
        {rows.length > 0 ? newButton : null}
      </div>
      {notice}
      {rows.length > 0 ? (
        <Field id={searchId} label={copy.search} type="search" autoComplete="off" className="max-w-md" value={query} onChange={(event: { target: { value: string } }) => onQuery(event.target.value)} />
      ) : null}
      {rows.length > 0 && shown.length === 0 ? (
        <p className="m-0 text-body text-ink">{fill(copy.noMatch, { q: query.trim() })}</p>
      ) : (
        <ListTable
          caption={title}
          columns={columns}
          rows={shown}
          onOpen={(row) => onOpen(row.id)}
          empty={
            <div className="flex flex-col items-start gap-4 border border-line bg-surface p-6">
              <p className="m-0 text-pretty text-body text-ink">{copy.empty}</p>
              {newButton}
            </div>
          }
        />
      )}
    </div>
  );

  return <PostEditor panel={panel} list={list} backLabel={title} />;
}

function PostEditor({ panel, list, backLabel }: { panel: PostPanel | null; list: ReactNode; backLabel: string }) {
  const loc = useDashboardLocale();
  const copy = OPS_BLOG_COPY[loc];
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const [asking, setAsking] = useState(false);
  const form = panel?.form ?? null;
  const dir = loc === "ar" ? "rtl" : "ltr";
  const slugBad = form ? !form.published && form.slug.trim() !== "" && !slugOk(form.slug) : false;
  const dateBad = form && panel ? futureDate(form.date, panel.today) : false;
  const fields = form ? blockTranslationFields(form.blocks, copy) : [];
  const labels: Record<string, string> = Object.fromEntries(fields.map((field) => [field.name, field.label]));

  function fieldLabel(field: string): string | undefined {
    if (!form) return undefined;
    if (field === "cover" || field === "cover_media_id") return copy.f.cover;
    if (field === "slug") return copy.f.address;
    if (field === "published_at") return copy.f.date;
    const at = form.blocks.findIndex((block) => field === missingBlockField("ar", block) || field === missingBlockField("es", block));
    if (at >= 0) {
      const block = form.blocks[at]!;
      return fill(field === missingBlockField("ar", block) ? copy.missingAr : copy.missingEs, { n: at + 1 });
    }
    const photo = form.blocks.findIndex((block) => block.kind === "photo" && blockFieldName(block) === field);
    if (photo >= 0) return blockName(copy, form.blocks[photo]!, photo);
    return labels[field];
  }

  function text(panel: PostPanel, form: PostForm, field: "title" | "excerpt" | "seo_title" | "seo_description", label: string, opts: { multiline?: boolean; required?: boolean; max: number }) {
    const common = {
      id: `${idBase}-en-${field}`,
      label,
      className: "max-w-none",
      lang: "en",
      dir: "ltr" as const,
      required: opts.required,
      maxLength: opts.max,
      value: form.text.en[field],
      onChange: (event: { target: { value: string } }) => panel.onForm({ ...form, text: { ...form.text, en: { ...form.text.en, [field]: event.target.value } } }),
    };
    return opts.multiline ? <Field {...common} multiline rows={4} /> : <Field {...common} autoComplete="off" />;
  }

  function linkSelect(form: PostForm, panel: PostPanel, key: "destinationId" | "stayId" | "experienceId", label: string, options: LinkOption[]) {
    const labelId = `${idBase}-${key}`;
    return (
      <div className="flex flex-col gap-2">
        <span id={labelId} className="text-label text-ink">
          {label}
        </span>
        <Select
          value={form[key] || NONE}
          options={[{ value: NONE, label: copy.f.none }, ...options.map((o) => ({ value: o.id, label: o.name }))]}
          onChange={(next) => panel.onForm({ ...form, [key]: next === NONE ? "" : next })}
          label={`${label}: {name}`}
          dir={dir}
          className="w-full"
        />
      </div>
    );
  }

  function sections(panel: PostPanel, form: PostForm): EditSection[] {
    const optional = (label: string) => `${label} (${copy.optional})`;
    return [
      {
        key: "basics",
        title: copy.sec.basics,
        translatable: true,
        content: (
          <>
            {text(panel, form, "title", copy.f.title, { required: true, max: POST_CAPS.title })}
            {form.published ? (
              <LockedAddress label={copy.f.address} value={form.slug} note={copy.f.addressLocked} />
            ) : (
              <Field
                id={`${idBase}-slug`}
                label={copy.f.address}
                className="max-w-none"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                maxLength={POST_CAPS.slug}
                value={form.slug}
                error={slugBad ? kit.errors.invalid : undefined}
                onChange={(event: { target: { value: string } }) => panel.onForm({ ...form, slug: event.target.value })}
              />
            )}
            <Field
              id={`${idBase}-date`}
              label={copy.f.date}
              className="max-w-xs"
              type="date"
              max={panel.today}
              value={form.date}
              error={dateBad ? copy.futureDate : undefined}
              onChange={(event: { target: { value: string } }) => panel.onForm({ ...form, date: event.target.value })}
            />
            {text(panel, form, "excerpt", copy.f.excerpt, { required: true, multiline: true, max: POST_CAPS.excerpt })}
          </>
        ),
      },
      {
        key: "cover",
        title: copy.sec.cover,
        content: <MediaField id={`${idBase}-cover`} label={copy.f.cover} value={form.cover} onChange={(cover) => panel.onForm({ ...form, cover })} required locale={loc} />,
      },
      {
        key: "body",
        title: copy.sec.body,
        content: <PostBlocksField blocks={form.blocks} onChange={(blocks) => panel.onForm({ ...form, blocks })} copy={copy} kit={kit} mediaLocale={loc} />,
      },
      {
        key: "linked",
        title: copy.sec.linked,
        column: "side",
        content: (
          <>
            {linkSelect(form, panel, "destinationId", copy.f.destination, panel.destinations)}
            {linkSelect(form, panel, "stayId", copy.f.stay, panel.stays)}
            {linkSelect(form, panel, "experienceId", copy.f.experience, panel.experiences)}
          </>
        ),
      },
      {
        key: "seo",
        title: copy.sec.seo,
        column: "side",
        content: (
          <>
            {text(panel, form, "seo_title", optional(copy.f.seoTitle), { max: POST_CAPS.seo_title })}
            {text(panel, form, "seo_description", optional(copy.f.seoDescription), { multiline: true, max: POST_CAPS.seo_description })}
          </>
        ),
      },
    ];
  }

  const title = form?.text.en.title.trim() || copy.newPost;
  const canSave = form ? form.text.en.title.trim() !== "" && form.text.en.excerpt.trim() !== "" && (form.published || slugOk(form.slug)) && !dateBad : false;

  return (
    <>
      <EditPage
        openKey={panel && form ? (form.id ?? "new") : null}
        list={list}
        backLabel={backLabel}
        onClose={() => panel?.onClose()}
        title={title}
        isNew={form?.id === null}
        isPublished={form?.published ?? false}
        dirty={panel?.dirty ?? false}
        busy={panel?.busy ?? false}
        canSave={canSave}
        missing={form ? missingForPost(form) : []}
        error={panel?.error ?? null}
        fieldLabel={fieldLabel}
        english={form ? postFields(form, "en") : {}}
        savedEnglish={panel ? postFields(panel.saved, "en") : {}}
        translations={form ? { ar: postFields(form, "ar"), es: postFields(form, "es") } : { ar: {}, es: {} }}
        locked={form ? postLocks(form) : undefined}
        translationFields={fields}
        onTranslationChange={(target, name, value) => {
          if (!panel || !form) return;
          const next = Array.isArray(value) ? value.join(" ") : value;
          const block = form.blocks.find((b) => blockFieldName(b) === name);
          if (block) {
            panel.onForm({ ...form, blocks: form.blocks.map((b) => (b.key === block.key ? { ...b, text: { ...b.text, [target]: next } } : b)) });
          } else {
            panel.onForm({ ...form, text: { ...form.text, [target]: { ...form.text[target], [name]: next } } });
          }
        }}
        onSave={(payload, intent) => (panel ? panel.onSave(payload, intent) : Promise.resolve(false))}
        onPublish={() => panel?.onPublish()}
        onUnpublish={() => panel?.onUnpublish()}
        onDelete={form?.id ? () => setAsking(true) : undefined}
        liveTranslations={panel ? livePostFields(panel.saved) : {}}
        holdOnFailure={form?.published ?? false}
        send={panel?.send}
        sections={panel && form ? sections(panel, form) : []}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        // No delete sentence was drawn for a post (signed 06-03 pictures): the dialog names the post and asks with the
        // kit's own Delete and Cancel, nothing invented.
        title={title}
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

const PATH = "/api/ops/posts";

type Open = { form: PostForm; saved: PostForm };

/**
 * Content -> Blog, connected (plan 06-03 Task 4): the list (GET /api/ops/posts), the post (?id=), Save (POST, flat
 * `save` body), Publish and Unpublish (/api/ops/publish, entity post: show and hide on the site), Delete (unpublished
 * only). The kit's translate calls go through chunkedSend, so a long post stays within the route's limits.
 * `send` is the test seam; the page passes nothing.
 */
export function BlogScreen({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const kit = OPS_KIT_COPY[locale];

  const [rows, setRows] = useState<PostSummary[]>([]);
  const [query, setQuery] = useState("");
  const [listError, setListError] = useState<OpsError | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OpsError | null>(null);
  const [links, setLinks] = useState<{ destinations: LinkOption[]; stays: LinkOption[]; experiences: LinkOption[] }>({ destinations: [], stays: [], experiences: [] });
  const writing = useRef(false);
  const translate = useRef<Send>(chunkedSend(send ?? (opsSend as unknown as Send)));

  async function loadList(): Promise<OpsError | null> {
    const reply = await opsFetch<ListReply<PostSummary>>(PATH);
    if (reply.ok) setRows(reply.items);
    const refusal = reply.ok ? null : reply.error;
    setListError(refusal);
    return refusal;
  }

  useEffect(() => {
    void loadList();
    // The Linked to choices: every destination, stay and experience, published or not, by English name.
    void (async () => {
      const [destinations, stays, catalog] = await Promise.all([
        opsFetch<ListReply<DestinationSummary>>("/api/ops/destinations"),
        opsFetch<ListReply<StaySummary>>("/api/ops/stays"),
        opsFetch<ListReply<CatalogSummary>>("/api/ops/catalog"),
      ]);
      setLinks({
        destinations: destinations.ok ? destinations.items.map((d) => ({ id: d.id, name: d.name_en })) : [],
        stays: stays.ok ? stays.items.map((s) => ({ id: s.id, name: s.title_en })) : [],
        experiences: catalog.ok ? catalog.items.filter((c) => c.kind === "experience").map((c) => ({ id: c.id, name: c.name_en })) : [],
      });
    })();
  }, []);

  /** Loads one post into the editor; `keys` keeps the block field names of the blocks just saved. */
  async function openDetail(id: string, keys: readonly string[] = []): Promise<OpsError | null> {
    const reply = await opsFetch<DetailReply<PostDetail>>(PATH, { id });
    if (!reply.ok) return reply.error;
    const form = postForm(reply.item, keys);
    setOpen({ form, saved: form });
    return null;
  }

  async function onOpen(id: string) {
    if (busy) return;
    setError(null);
    setBusy(true);
    const refusal = await openDetail(id);
    setBusy(false);
    if (refusal) setListError(refusal);
  }

  /** One save; on `publish`, the publish call after it; then the post and the list are read again. */
  async function persist(form: PostForm, publish: boolean): Promise<boolean> {
    if (writing.current) return false;
    const payload = postPayload(form, { publish, today: dubaiToday() });
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
      const published = await opsSend<PublishResult>("/api/ops/publish", { entity: "post", id: saved.id, published: true });
      if (!published.ok) publishError = published.error;
    }
    const reread = await openDetail(saved.id, sentBlockKeys(form));
    if (reread) {
      const held = { ...form, id: saved.id, published: form.published || (publish && !publishError) };
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
    return persist(postWithTranslations(open.form, payload.translations, payload.locked), intent === "publish");
  }

  async function onUnpublish() {
    if (!open?.form.id || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<PublishResult>("/api/ops/publish", { entity: "post", id: open.form.id, published: false });
    if (!reply.ok) setError(reply.error);
    else {
      // The stored blocks are the last saved ones (the kit asks before Unpublish drops unsaved typing): their keys, in
      // the order they were sent, so a lock lands on its own block (Sonnet review 06-03).
      setError(await openDetail(open.form.id, sentBlockKeys(open.saved)));
      await loadList();
    }
    setBusy(false);
  }

  async function onDelete() {
    if (!open?.form.id || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<WriteResult>(PATH, { action: "delete", id: open.form.id });
    if (reply.ok) {
      setOpen(null);
      await loadList();
    } else setError(reply.error);
    setBusy(false);
  }

  const shown: PostRow[] = rows
    .slice()
    .sort((a, b) => (b.published_at ?? b.updated_at).localeCompare(a.published_at ?? a.updated_at))
    .map((row) => ({ id: row.id, title: row.title_en, published: row.is_published, date: row.published_at ?? "" }));

  return (
    <BlogView
      rows={shown}
      query={query}
      onQuery={setQuery}
      onNew={() => {
        const form = emptyPostForm();
        setError(null);
        setOpen({ form, saved: form });
      }}
      onOpen={(id) => void onOpen(id)}
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
              today: dubaiToday(),
              ...links,
              onSave,
              onPublish: () => persist(open.form, true),
              onUnpublish: () => void onUnpublish(),
              onDelete: () => void onDelete(),
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

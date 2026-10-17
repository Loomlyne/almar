"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import { EditPage, type EditSection, type SaveIntent, type SavePayload } from "../../../../../components/ops/edit-page";
import { ListTable, type Column } from "../../../../../components/ops/list-table";
import { MediaField } from "../../../../../components/ops/media-field";
import { missingForPublish } from "../../../../../components/ops/publish-check";
import { StatusChip } from "../../../../../components/ops/status-chip";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import type {
  DetailReply,
  ListReply,
  Locale3,
  OpsError,
  PublishResult,
  TeamDetail,
  TeamSummary,
  WriteResult,
} from "../../../../../components/ops/api-types";
import { errorText } from "../../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { PlusIcon } from "../../../../../components/icons/icons";
import { Button } from "../../../../../components/ui/button";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Field } from "../../../../../components/ui/field";
import { Select } from "../../../../../components/ui/select";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_TEAM_COPY, fillTeamCopy } from "../../../../../lib/copy/ops-team";
import { LockedAddress } from "../../catalog/locked-address";
import { focusMovedRow } from "../../catalog/move-focus";
import { afterSave, movedIds, sameForm, withTranslations } from "../../catalog/catalog-forms";
import { saveThenPublish } from "../../catalog/persist";
import {
  LINK_PLATFORMS,
  MAX_LINKS,
  MAX_LINK_URL,
  TEAM_TEXT_FIELDS,
  emailOk,
  emptyTeamForm,
  slugProblem,
  teamForm,
  teamPayload,
  linkKey,
  liveTeamFields,
  validateLinks,
  type LinkPlatform,
  type TeamForm,
  type TeamText,
  type TeamTextField,
} from "./team-forms";

export type TeamRow = { id: string; name: string; role: string; published: boolean };

export type TeamPanel = {
  form: TeamForm;
  /** The text of the three languages as last saved: what the kit compares the English with, and what is live. */
  saved: Record<Locale3, TeamText>;
  onForm: (next: TeamForm) => void;
  dirty: boolean;
  busy: boolean;
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

/**
 * Content -> Team (canvas DashTeamLegal, Team half; kit panel B, owner 2026-10-14), driven entirely by props: the wired
 * screen loads the rows and the member and passes the handlers; the harness scene passes bracket data and no-ops. Team
 * starts empty: no member exists until the owner adds one (D-57). A member's email is never on the public site.
 */
export function TeamView({
  rows,
  onNew,
  onOpen,
  onMove,
  onDropOrder,
  panel,
  reordering = false,
  notice,
}: {
  rows: TeamRow[];
  onNew: () => void;
  onOpen: (id: string) => void;
  /** Takes a move; false when the screen refused it (an order is already on its way). */
  onMove: (id: string, by: -1 | 1) => boolean | void;
  onDropOrder: (ids: string[]) => void;
  panel: TeamPanel | null;
  /** An order is on its way: the list is aria-busy and focus returns to the moved row once it is read back. */
  reordering?: boolean;
  /** A line of the screen's own under the title, such as a list that did not load. */
  notice?: ReactNode;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_TEAM_COPY[loc].team;
  const kit = OPS_KIT_COPY[loc];
  const listRef = useRef<HTMLDivElement>(null);
  // The row just moved: once the list is read back, focus returns to its move button (as on Catalog).
  const moved = useRef<{ name: string; by: -1 | 1 } | null>(null);
  useEffect(() => {
    if (reordering || !moved.current) return;
    focusMovedRow(listRef.current, moved.current.name, moved.current.by, { up: kit.moveUp, down: kit.moveDown });
    moved.current = null;
  }, [reordering]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<TeamRow>[] = [
    { key: "name", label: copy.colName, phone: "title", render: (row) => row.name },
    { key: "role", label: copy.colRole, phone: "meta", render: (row) => row.role },
    { key: "shown", label: copy.colShown, phone: "meta", render: (row) => <StatusChip published={row.published} locale={loc} /> },
  ];

  const newButton = (
    <Button onClick={onNew}>
      <PlusIcon size={16} aria-hidden="true" />
      {copy.newMember}
    </Button>
  );

  const list = (
    <div ref={listRef} className="flex min-w-0 flex-col gap-6" aria-busy={reordering || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.title}</h1>
        {rows.length > 0 ? newButton : null}
      </div>
      {notice}
      <div className="flex flex-col gap-1">
        <p className="m-0 text-pretty text-label text-ink">{copy.publicNote}</p>
        {rows.length > 1 ? <p className="m-0 text-pretty text-label text-muted">{copy.orderNote}</p> : null}
      </div>
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
        empty={
          <div className="flex flex-col items-start gap-4 border border-line bg-surface p-6">
            <p className="m-0 text-pretty text-body text-ink">{copy.empty}</p>
            {newButton}
          </div>
        }
      />
    </div>
  );

  return <TeamEditor panel={panel} list={list} />;
}

const englishOf = (text: TeamText) => Object.fromEntries(TEAM_TEXT_FIELDS.map((field) => [field, text[field]]));

/**
 * The member's editor page (kit EditPage): Text (name, role, bio), Photo and Social media on the left; Settings (the web
 * address, typed by the owner, locked once published) and Email on the right; one column on a phone. Maria writes
 * English only; the kit fills Arabic and Spanish on Save. Delete is a link, off while the member is published
 * ("Unpublish first").
 */
function TeamEditor({ panel, list }: { panel: TeamPanel | null; list: ReactNode }) {
  const loc = useDashboardLocale();
  const copy = OPS_TEAM_COPY[loc].team;
  const kit = OPS_KIT_COPY[loc];
  const idBase = useId();
  const [asking, setAsking] = useState(false);

  const form = panel?.form ?? null;
  const title = form?.text.en.name.trim() || copy.newMember;
  const fieldLabels: Record<TeamTextField, string> = { name: copy.fieldName, role: copy.fieldRole, bio: copy.fieldBio };
  const linkCheck = form ? validateLinks(form.links) : null;
  const emailBad = form ? !emailOk(form.email) : false;
  // The web address, as on stays: typed by the owner, needed before the first Save, locked once published.
  const slugIssue = form ? slugProblem(form) : null;
  const slugTaken = panel?.error?.field === "slug" && panel.error.code !== "invalid";
  const slugError = slugTaken ? kit.errors.slug_taken : slugIssue === "pattern" ? fillTeamCopy(copy.problemSlug, { field: copy.fieldSlug }) : undefined;
  const dir = loc === "ar" ? "rtl" : "ltr";

  function sections(panel: TeamPanel, form: TeamForm): EditSection[] {
    const { onForm } = panel;
    const english = (field: TeamTextField, extra?: { multiline?: boolean; required?: boolean }) => {
      const common = {
        id: `${idBase}-en-${field}`,
        label: fieldLabels[field],
        className: "max-w-none",
        lang: "en",
        dir: "ltr",
        value: form.text.en[field],
        required: extra?.required,
        onChange: (event: { target: { value: string } }) => onForm({ ...form, text: { ...form.text, en: { ...form.text.en, [field]: event.target.value } } }),
      };
      return extra?.multiline ? <Field {...common} multiline rows={6} /> : <Field {...common} autoComplete="off" />;
    };
    const setLink = (key: string, change: Partial<{ label: LinkPlatform; url: string }>) =>
      onForm({ ...form, links: form.links.map((row) => (row.key === key ? { ...row, ...change } : row)) });
    const full = form.links.length >= MAX_LINKS;

    return [
      {
        key: "text",
        title: kit.editor.sections.text,
        translatable: true,
        content: (
          <>
            {english("name", { required: true })}
            {english("role")}
            {english("bio", { multiline: true })}
          </>
        ),
      },
      {
        key: "photo",
        title: kit.editor.sections.photo,
        content: <MediaField id={`${idBase}-photo`} label={copy.fieldPhoto} value={form.photo} onChange={(photo) => onForm({ ...form, photo })} locale={loc} />,
      },
      {
        key: "links",
        title: copy.links,
        content: (
          <>
            <p className="m-0 text-pretty text-label text-muted">{copy.linksNote}</p>
            {form.links.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-4 p-0" aria-label={copy.links}>
                {form.links.map((row) => {
                  const problem = linkCheck?.problems[row.key];
                  const error = problem === "too_long" ? copy.linkTooLong : problem ? copy.linkNeedsHttps : undefined;
                  return (
                    <li key={row.key} className="flex flex-col gap-2 border-b border-line pb-4 last:border-b-0 last:pb-0 md:flex-row md:items-start md:gap-3">
                      <div className="flex shrink-0 flex-col gap-2">
                        <span className="text-label text-ink" id={`${idBase}-${row.key}-platform`}>
                          {copy.linkPlatform}
                        </span>
                        <Select
                          value={row.label}
                          options={LINK_PLATFORMS.map((platform) => ({ value: platform, label: platform }))}
                          onChange={(next) => {
                            const platform = LINK_PLATFORMS.find((p) => p === next);
                            if (platform) setLink(row.key, { label: platform });
                          }}
                          label={`${copy.linkPlatform}: {name}`}
                          dir={dir}
                          className="w-full md:w-40"
                        />
                      </div>
                      <Field
                        id={`${idBase}-${row.key}-url`}
                        label={copy.linkAddress}
                        className="min-w-0 max-w-none flex-1"
                        type="url"
                        inputMode="url"
                        dir="ltr"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={MAX_LINK_URL + 50}
                        value={row.url}
                        error={error}
                        onChange={(event) => setLink(row.key, { url: event.target.value })}
                      />
                      <div className="grid gap-2">
                        {/* An empty label line from 768, so Remove sits level with the two controls beside it. */}
                        <span aria-hidden="true" className="invisible hidden text-label md:block">
                          {copy.linkAddress}
                        </span>
                        <Button
                          variant="ghost"
                          aria-label={fillTeamCopy(copy.removeLink, { platform: row.label })}
                          onClick={() => onForm({ ...form, links: form.links.filter((other) => other.key !== row.key) })}
                        >
                          {copy.remove}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                disabled={full}
                onClick={() => onForm({ ...form, links: [...form.links, { key: linkKey(), label: LINK_PLATFORMS[0], url: "" }] })}
              >
                <PlusIcon size={16} aria-hidden="true" />
                {copy.addLink}
              </Button>
              {full ? <p className="m-0 text-label text-muted">{copy.linksFull}</p> : null}
            </div>
          </>
        ),
      },
      {
        key: "settings",
        title: kit.editor.sections.settings,
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
            value={form.slug}
            hint={copy.slugHint}
            error={slugError}
            onChange={(event) => onForm({ ...form, slug: event.target.value })}
          />
        ),
      },
      {
        key: "email",
        title: copy.emailSection,
        column: "side",
        content: (
          <Field
            id={`${idBase}-email`}
            label={copy.fieldEmail}
            className="max-w-none"
            type="email"
            inputMode="email"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            value={form.email}
            hint={copy.emailNote}
            error={emailBad ? copy.emailInvalid : undefined}
            onChange={(event) => onForm({ ...form, email: event.target.value })}
          />
        ),
      },
    ];
  }

  const missing = form ? missingForPublish("team_member", { translations: form.text, media_id: form.photo?.id ?? null }) : [];

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
        canSave={form ? form.text.en.name.trim() !== "" && slugIssue === null && (linkCheck?.ok ?? true) && !emailBad : false}
        notice={
          slugIssue === "needed" ? (
            <ul role="status" className="m-0 flex list-none flex-col gap-1 border-s border-gold p-0 ps-2 text-label text-ink">
              <li>{copy.problemSlugNeeded}</li>
            </ul>
          ) : null
        }
        missing={missing}
        error={slugTaken ? null : (panel?.error ?? null)}
        fieldLabel={(field) =>
          field === "slug" ? copy.fieldSlug.toLocaleLowerCase(loc) : field in fieldLabels ? fieldLabels[field as TeamTextField] : undefined
        }
        english={form ? englishOf(form.text.en) : {}}
        savedEnglish={panel ? englishOf(panel.saved.en) : {}}
        translations={form ? { ar: englishOf(form.text.ar), es: englishOf(form.text.es) } : { ar: {}, es: {} }}
        translationFields={TEAM_TEXT_FIELDS.map((field) => ({ name: field, label: fieldLabels[field], multiline: field === "bio" }))}
        onTranslationChange={(target, name, value) => {
          if (!panel || !form) return;
          const text = Array.isArray(value) ? value.join(" ") : value;
          panel.onForm({ ...form, text: { ...form.text, [target]: { ...form.text[target], [name]: text } } });
        }}
        onSave={(payload, intent) => (panel ? panel.onSave(payload, intent) : Promise.resolve(false))}
        onPublish={() => panel?.onPublish()}
        onUnpublish={() => panel?.onUnpublish()}
        onDelete={form?.id ? () => setAsking(true) : undefined}
        deleteLabel={copy.deleteMember}
        liveTranslations={panel && form ? liveTeamFields(form.published, form.status, panel.saved) : {}}
        holdOnFailure={form?.published ?? false}
        send={panel?.send}
        sections={panel && form ? sections(panel, form) : []}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={fillTeamCopy(copy.deleteTitle, { name: title })}
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

const PATH = "/api/ops/team";

type Open = { form: TeamForm; saved: TeamForm };

/**
 * Content -> Team, connected (plan 03.2-08 Task 3): the list and its order, the member's editor page (Save, Publish,
 * Unpublish, Delete, automatic Arabic and Spanish through the kit), all through the kit client (contract 5.7, 5.9).
 * Team starts empty. `send` is the test seam for the translate request; the page passes nothing.
 */
export function TeamScreen({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const kit = OPS_KIT_COPY[locale];

  const [rows, setRows] = useState<TeamSummary[]>([]);
  const [listError, setListError] = useState<OpsError | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OpsError | null>(null);
  const [reordering, setReordering] = useState(false);
  // A second Save, Publish or move while one is on its way is not taken (the kit's busy state lands a render later).
  const writing = useRef(false);
  const moving = useRef(false);

  async function loadList(): Promise<OpsError | null> {
    const reply = await opsFetch<ListReply<TeamSummary>>(PATH);
    if (reply.ok) setRows(reply.items);
    const refusal = reply.ok ? null : reply.error;
    setListError(refusal);
    return refusal;
  }

  useEffect(() => {
    void loadList();
  }, []);

  /** Loads one member into the editor (its saved state is the server's); the refusal, if any, is returned. */
  async function openDetail(id: string): Promise<OpsError | null> {
    const reply = await opsFetch<DetailReply<TeamDetail>>(PATH, { id });
    if (!reply.ok) return reply.error;
    const form = teamForm(reply.item);
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

  function onNew() {
    const form = emptyTeamForm();
    setError(null);
    setOpen({ form, saved: form });
  }

  /** One save, and on `publish` the publish call after it; then the editor and the list are read again. */
  async function persist(form: TeamForm, publish: boolean): Promise<boolean> {
    if (writing.current) return false;
    const payload = teamPayload(form, { publish });
    if (!payload.ok) {
      // The screen holds Save on these already; this is the last guard before a request.
      setError({ code: "invalid", field: payload.field, locale: null, detail: null });
      return false;
    }
    writing.current = true;
    setBusy(true);
    setError(null);
    const result = await saveThenPublish(opsSend, PATH, "team_member", payload.item, publish);
    if (!result.ok) {
      writing.current = false;
      setBusy(false);
      setError(result.error);
      return false;
    }
    const reread = await openDetail(result.id);
    // Saved but not read back: the editor keeps what was sent, with its id (and, after a taken Publish, published).
    if (reread) {
      const held = afterSave(form, result.id, publish && !result.publishError);
      setOpen({ form: held, saved: held });
    }
    await loadList();
    writing.current = false;
    setBusy(false);
    setError(result.publishError ?? reread);
    return true;
  }

  function onSave(payload: SavePayload, intent: SaveIntent): Promise<boolean> {
    if (!open) return Promise.resolve(false);
    return persist(withTranslations(open.form, payload.translations), intent === "publish");
  }

  async function onUnpublish() {
    if (!open?.form.id || busy) return;
    setBusy(true);
    setError(null);
    const reply = await opsSend<PublishResult>("/api/ops/publish", { entity: "team_member", id: open.form.id, published: false });
    if (!reply.ok) setError(reply.error);
    else {
      setError(await openDetail(open.form.id));
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

  const shown: TeamRow[] = rows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((row) => ({ id: row.id, name: row.name_en, role: row.role_en ?? "", published: row.is_published }));

  return (
    <TeamView
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
              onDelete: () => void onDelete(),
              onClose: () => {
                if (busy) return;
                setOpen(null);
                setError(null);
              },
              send,
            }
          : null
      }
    />
  );
}

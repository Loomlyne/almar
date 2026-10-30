"use client";

import { useEffect, useRef, useState } from "react";
import type { Send } from "../../../../../components/ops/auto-translate";
import type { NavArea, NavLinkDetail, OpsError } from "../../../../../components/ops/api-types";
import type { SavePayload } from "../../../../../components/ops/edit-page";
import { errorText } from "../../../../../components/ops/error-text";
import { opsFetch, opsSend } from "../../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_NAV_COPY } from "../../../../../lib/copy/ops-nav";
import type { NavTargetOption } from "../../../../../lib/ops/site-pages-handlers";
import { sameForm } from "../../catalog/catalog-forms";
import { areaBody, areaForms, emptyLinkForm, linkWithTranslations, movedLinks, orderedLinks, targetName, withLink, type LinkForm } from "./nav-forms";
import { NavigationView, type LinkRow } from "./navigation-view";

const PATH = "/api/ops/nav";

type NavRead = { header: NavLinkDetail[]; footer: NavLinkDetail[]; targets: NavTargetOption[] };
type SaveNavReply = { area: NavArea; ids: string[]; affects_site: boolean };
type Open = { area: NavArea; form: LinkForm; saved: LinkForm | null };

/**
 * Content -> Navigation and footer, connected (plan 06-02 Task 4): GET /api/ops/nav reads both areas and the page
 * targets; every change (a link saved, added, shown or hidden, moved, deleted) saves its whole area with
 * POST /api/ops/nav, in order, and the screen reads both areas back. `send` is the test seam for the translate request.
 */
export function NavigationScreen({ send }: { send?: Send } = {}) {
  const locale = useDashboardLocale();
  const kit = OPS_KIT_COPY[locale];
  const copy = OPS_NAV_COPY[locale];

  const [links, setLinks] = useState<Record<NavArea, LinkForm[]>>({ header: [], footer: [] });
  const [targets, setTargets] = useState<NavTargetOption[]>([]);
  const [listError, setListError] = useState<OpsError | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OpsError | null>(null);
  const [reordering, setReordering] = useState<NavArea | null>(null);
  const writing = useRef(false);

  async function load(): Promise<Record<NavArea, LinkForm[]> | null> {
    const reply = await opsFetch<NavRead>(PATH);
    if (!reply.ok) {
      setListError(reply.error);
      return null;
    }
    const next = { header: areaForms(reply.header), footer: areaForms(reply.footer) };
    setLinks(next);
    setTargets(reply.targets);
    setListError(null);
    return next;
  }

  useEffect(() => {
    void load();
  }, []);

  /** Saves one area whole; the refusal, if any, is returned. On success both areas are read again. */
  async function saveArea(area: NavArea, next: LinkForm[]): Promise<{ ok: true; ids: string[]; fresh: Record<NavArea, LinkForm[]> | null } | { ok: false; error: OpsError }> {
    const body = areaBody(area, next);
    if (!body.ok) {
      const field = body.problem === "too_many" ? "links" : body.problem === "url" ? "target" : body.problem;
      return { ok: false, error: { code: "invalid", field, locale: null, detail: null } };
    }
    const reply = await opsSend<SaveNavReply>(PATH, body.body);
    if (!reply.ok) return { ok: false, error: reply.error };
    const fresh = await load();
    return { ok: true, ids: reply.ids, fresh };
  }

  async function onSave(payload: SavePayload): Promise<boolean> {
    if (!open || writing.current) return false;
    writing.current = true;
    setBusy(true);
    setError(null);
    const form = linkWithTranslations(open.form, payload.translations, payload.locked);
    const next = withLink(links[open.area], form);
    const result = await saveArea(open.area, next);
    if (!result.ok) {
      writing.current = false;
      setBusy(false);
      setError(result.error);
      return false;
    }
    // The saved link, by its place in the area (a new link has its id only in the answer).
    const at = next.findIndex((l) => l.key === form.key);
    const id = result.ids[at] ?? form.id;
    const reread = result.fresh?.[open.area].find((l) => l.id === id);
    const held = reread ?? { ...form, id, key: id ?? form.key };
    setOpen({ area: open.area, form: held, saved: held });
    writing.current = false;
    setBusy(false);
    return true;
  }

  async function onDelete() {
    if (!open?.form.id || busy) return;
    setBusy(true);
    setError(null);
    const result = await saveArea(
      open.area,
      links[open.area].filter((l) => l.key !== open.form.key),
    );
    if (result.ok) setOpen(null);
    else setError(result.error);
    setBusy(false);
  }

  /** One order at a time per screen: a second move waits until the areas are read back. */
  function reorder(area: NavArea, next: LinkForm[]): boolean {
    if (writing.current || reordering) return false;
    writing.current = true;
    void (async () => {
      setReordering(area);
      const result = await saveArea(area, next);
      if (!result.ok) setListError(result.error);
      writing.current = false;
      setReordering(null);
    })();
    return true;
  }

  const rows = (area: NavArea): LinkRow[] =>
    links[area].map((l) => ({
      id: l.key,
      label: l.text.en.label,
      to: l.kind === "external" ? l.url : targetName(copy, l.target, targets),
      external: l.kind === "external",
      shown: l.shown,
    }));

  return (
    <NavigationView
      header={rows("header")}
      footer={rows("footer")}
      targets={targets}
      onOpen={(area, key) => {
        const form = links[area].find((l) => l.key === key);
        if (!form) return;
        setError(null);
        setOpen({ area, form, saved: form });
      }}
      onNew={(area) => {
        setError(null);
        setOpen({ area, form: emptyLinkForm(), saved: null });
      }}
      onMove={(area, key, by) => reorder(area, movedLinks(links[area], key, by))}
      onDropOrder={(area, keys) => {
        reorder(area, orderedLinks(links[area], keys));
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
              area: open.area,
              form: open.form,
              saved: open.saved,
              onForm: (form) => {
                setError(null);
                setOpen((was) => (was ? { ...was, form } : was));
              },
              dirty: open.saved === null || !sameForm(open.form, open.saved),
              busy,
              error,
              onSave: (payload) => onSave(payload),
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

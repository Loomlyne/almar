"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees, in preview mode, so the rail and the density match the real screen (as ops-kit.tsx).
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { TeamView, type TeamPanel, type TeamRow } from "../../../app/dashboard/(ops)/content/team/team-screen";
import { emptyTeamForm, linkKey, type TeamForm, type TeamText } from "../../../app/dashboard/(ops)/content/team/team-forms";
import type { Locale3 } from "../../../components/ops/api-types";
import type { SceneContext, Scenes } from "../scene-types";
import { numberedTeam, teamWords } from "./_ops-team-words";

/**
 * Every state of Content -> Team (plan 03.2-08), bracket data only, props-only: no request is made. No real person and
 * no photo of a person: the photo field stays empty. The editor states are the kit editor page (option B); the handlers
 * are no-ops (Save resolves false: nothing is sent). Test-only.
 */
type Variant = "list" | "list-empty" | "new" | "links-error" | "published";

/** The kit reads the almar-locale cookie and the shell does too; the harness picks the language from ?l=, so set it first. */
function Frame({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

/** The list shows the English name and role (name_en, role_en), whatever the dashboard language. */
const ROWS: TeamRow[] = [
  { id: "t1", name: numberedTeam("en", "member", 1), role: teamWords("en").role, published: true },
  { id: "t2", name: numberedTeam("en", "member", 2), role: teamWords("en").role, published: true },
  { id: "t3", name: numberedTeam("en", "member", 3), role: teamWords("en").role, published: false },
];

function textOf(locale: Locale3): TeamText {
  const w = teamWords(locale);
  return { name: w.name, role: w.role, bio: w.bio };
}

function formOf(variant: Variant): TeamForm {
  const blank = emptyTeamForm();
  if (variant === "new") return { ...blank, text: { ...blank.text, en: { ...blank.text.en, name: teamWords("en").name } } };
  const published = variant === "published";
  return {
    id: "t1",
    slug: "web-address",
    published,
    photo: null,
    email: "name@example.com",
    links:
      variant === "links-error"
        ? [
            { key: linkKey(), label: "Instagram", url: "https://www.instagram.com/[account]" },
            { key: linkKey(), label: "LinkedIn", url: "http://www.linkedin.com/in/[account]" },
          ]
        : [{ key: linkKey(), label: "Instagram", url: "https://www.instagram.com/[account]" }],
    text: { en: textOf("en"), ar: textOf("ar"), es: textOf("es") },
    status: { en: "published", ar: published ? "published" : "draft", es: published ? "published" : "draft" },
  };
}

/**
 * True one tick after mount when `on`. Next dev mounts every effect twice (React Strict Mode): the kit's Back guard,
 * mounted dirty, takes its history entry away with history.back() on the first cleanup, and the second mount then reads
 * that popstate as the owner pressing Back ("Discard changes?"). Becoming dirty after mount is also what happens when the
 * owner types, so the guard mounts once.
 */
function useDirtyAfterMount(on: boolean): boolean {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = window.setTimeout(() => setDirty(true), 0);
    return () => window.clearTimeout(timer);
  }, [on]);
  return dirty;
}

function TeamScene({ ctx, variant }: { ctx: SceneContext; variant: Variant }) {
  const locale = ctx.locale as Locale3;
  const [form, setForm] = useState<TeamForm>(() => formOf(variant));
  const dirty = useDirtyAfterMount(variant === "new" || variant === "links-error");
  const noop = () => undefined;
  const hasPanel = variant !== "list" && variant !== "list-empty";

  const panel: TeamPanel | null = hasPanel
    ? {
        form,
        saved: variant === "new" ? emptyTeamForm().text : { en: textOf("en"), ar: textOf("ar"), es: textOf("es") },
        onForm: setForm,
        dirty,
        busy: false,
        error: null,
        onSave: () => Promise.resolve(false),
        onPublish: noop,
        onUnpublish: noop,
        onDelete: noop,
        onClose: noop,
      }
    : null;

  return (
    <Frame locale={locale}>
      <TeamView rows={variant === "list-empty" ? [] : ROWS} onNew={noop} onOpen={noop} onMove={noop} onDropOrder={noop} panel={panel} />
    </Frame>
  );
}

export const scenes: Scenes = {
  "team-list": (ctx) => <TeamScene ctx={ctx} variant="list" />,
  "team-list-empty": (ctx) => <TeamScene ctx={ctx} variant="list-empty" />,
  "team-editor-new": (ctx) => <TeamScene ctx={ctx} variant="new" />,
  "team-editor-links-error": (ctx) => <TeamScene ctx={ctx} variant="links-error" />,
  "team-editor-published": (ctx) => <TeamScene ctx={ctx} variant="published" />,
};

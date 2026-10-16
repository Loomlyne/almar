"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees, in preview mode, so the rail and the density match the real screen (as ops-kit.tsx).
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { DestinationsView, type DestinationPanel, type DestinationRow, type ItemOption } from "../../../app/dashboard/(ops)/catalog/destinations/destinations-view";
import { emptyDestinationForm, type DestinationForm } from "../../../app/dashboard/(ops)/catalog/catalog-forms";
import type { Locale3 } from "../../../components/ops/api-types";
import { OPS_CATALOG_COPY } from "../../../lib/copy/ops-catalog";
import type { SceneContext, Scenes } from "../scene-types";
import { SCENE_PHOTO, numbered, words } from "./_ops-catalog-words";

/**
 * Every state of Catalog -> Destinations (plan 03.2-06), bracket data only, props-only: no request is made. The view
 * is the one the wired screen uses; the handlers are no-ops (Save resolves false: nothing is sent). The editor states are
 * the kit editor page (option B). Test-only.
 */
type Variant = "list" | "list-empty" | "new" | "published" | "delete-blocked";

/** The kit reads the almar-locale cookie and the shell does too; the harness picks the language from ?l=, so set it first. */
function Frame({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

function rowsOf(locale: Locale3): DestinationRow[] {
  return [
    { id: "d1", name: numbered(locale, "destination", 1), stayCount: 3, published: true },
    { id: "d2", name: numbered(locale, "destination", 2), stayCount: 2, published: true },
    { id: "d3", name: numbered(locale, "destination", 3), stayCount: 0, published: false },
    { id: "d4", name: numbered(locale, "destination", 4), stayCount: 5, published: false },
  ];
}

function textOf(locale: Locale3) {
  const w = words(locale);
  return { name: w.name, short_line: w.shortLine, region: w.region, summary: w.description, nights_label: w.nightsLine };
}

function formOf(variant: Variant, locale: Locale3): DestinationForm {
  const blank = emptyDestinationForm();
  if (variant === "new") return { ...blank, text: { ...blank.text, en: { ...blank.text.en, name: words("en").name } } };
  const published = variant === "published";
  return {
    id: "d1",
    slug: words(locale).webAddress,
    published,
    hero: SCENE_PHOTO,
    inset: variant === "published" ? SCENE_PHOTO : null,
    text: { en: textOf("en"), ar: textOf("ar"), es: textOf("es") },
    status: { en: "published", ar: published ? "published" : "draft", es: published ? "published" : "draft" },
  };
}

function itemsOf(locale: Locale3): ItemOption[] {
  const copy = OPS_CATALOG_COPY[locale].items;
  return [1, 2, 3, 4, 5].map((n) => ({ id: `i${n}`, label: numbered(locale, "item", n), meta: n % 2 === 0 ? copy.kindService : copy.kindExperience }));
}

function DestinationsScene({ ctx, variant }: { ctx: SceneContext; variant: Variant }) {
  const locale = ctx.locale as Locale3;
  const [form, setForm] = useState<DestinationForm>(() => formOf(variant, locale));
  const [connected, setConnected] = useState<string[]>(["i1", "i2"]);
  const noop = () => undefined;
  const hasPanel = variant !== "list" && variant !== "list-empty";
  const stays = [1, 2, 3].map((n) => ({ id: `s${n}`, name: numbered(locale, "stay", n), published: n !== 3 }));

  const panel: DestinationPanel | null = hasPanel
    ? {
        form,
        saved: variant === "new" ? emptyDestinationForm().text : { en: textOf("en"), ar: textOf("ar"), es: textOf("es") },
        onForm: setForm,
        // Opened clean: with unsaved changes the kit's Back guard asks "Discard changes?" on load in dev (strict effects).
        dirty: false,
        busy: false,
        stays: variant === "new" ? [] : stays,
        items: itemsOf(locale),
        connectedIds: connected,
        onConnectedChange: setConnected,
        warnings: [],
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
      <DestinationsView
        rows={variant === "list-empty" ? [] : rowsOf(locale)}
        onNew={noop}
        onOpen={noop}
        onMove={() => false}
        onDropOrder={noop}
        panel={panel}
      />
    </Frame>
  );
}

export const scenes: Scenes = {
  list: (ctx) => <DestinationsScene ctx={ctx} variant="list" />,
  "list-empty": (ctx) => <DestinationsScene ctx={ctx} variant="list-empty" />,
  "editor-new": (ctx) => <DestinationsScene ctx={ctx} variant="new" />,
  "editor-published": (ctx) => <DestinationsScene ctx={ctx} variant="published" />,
  "editor-delete-blocked": (ctx) => <DestinationsScene ctx={ctx} variant="delete-blocked" />,
};

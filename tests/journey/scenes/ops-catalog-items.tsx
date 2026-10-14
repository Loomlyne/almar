"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees, in preview mode, so the rail and the density match the real screen (as ops-kit.tsx).
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { CatalogItemsView, type CatalogPanel, type CatalogRow, type PickOption } from "../../../app/dashboard/(ops)/catalog/experiences/catalog-items-screen";
import { emptyCatalogItemForm, type CatalogFilter, type CatalogItemForm } from "../../../app/dashboard/(ops)/catalog/catalog-forms";
import type { Locale3, OpsError, PublishWarningCode } from "../../../components/ops/api-types";
import type { SceneContext, Scenes } from "../scene-types";
import { SCENE_PHOTO, numbered, words } from "./_ops-catalog-words";

/**
 * Every state of Catalog -> Experiences and services (plan 03.2-06), bracket data only, props-only: no request is made.
 * Prices are the placeholder "AED [PRICE]", never a number. The view is the one the wired screen uses; the handlers are
 * no-ops (Save resolves false: nothing is sent). The editor states are the kit editor page (option B). Test-only.
 */
type Variant = "list-filtered" | "editor" | "home-pickup-refused" | "published-no-price";

/** The kit reads the almar-locale cookie and the shell does too; the harness picks the language from ?l=, so set it first. */
function Frame({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

function rowsOf(locale: Locale3): CatalogRow[] {
  const row = (n: number, kind: CatalogRow["kind"], unit: CatalogRow["unit"], priced: boolean, dests: string[], stays: string[], published: boolean): CatalogRow => ({
    id: `i${n}`,
    name: numbered(locale, "item", n),
    kind,
    unit,
    priceText: priced ? `AED ${words(locale).price}` : null,
    destinationIds: dests,
    stayIds: stays,
    stayCount: stays.length,
    published,
    position: n,
  });
  return [
    row(1, "experience", "person", true, ["d1", "d2"], ["s1"], true),
    row(2, "service", "trip", true, ["d1"], [], true),
    row(3, "service", "night", false, ["d1", "d3"], ["s2", "s3"], false),
    row(4, "experience", "person", true, ["d2"], [], true),
    row(5, "service", "trip", true, ["d3"], ["s4"], true),
    row(6, "experience", "trip", false, ["d1"], ["s1", "s2"], false),
  ];
}

const destinationsOf = (locale: Locale3): PickOption[] => [1, 2, 3].map((n) => ({ id: `d${n}`, label: numbered(locale, "destination", n) }));
const staysOf = (locale: Locale3): PickOption[] =>
  [1, 2, 3, 4].map((n) => ({ id: `s${n}`, label: numbered(locale, "stay", n), meta: numbered(locale, "destination", n <= 2 ? 1 : 2) }));

function textOf(locale: Locale3) {
  const w = words(locale);
  return { name: w.name, summary: w.description, duration_label: w.duration };
}

function formOf(variant: Variant, locale: Locale3): CatalogItemForm {
  const base = emptyCatalogItemForm();
  const published = variant === "published-no-price";
  return {
    ...base,
    id: "i1",
    slug: words(locale).webAddress,
    published,
    kind: variant === "home-pickup-refused" ? "service" : "experience",
    unit: variant === "home-pickup-refused" ? "trip" : "person",
    price: published ? "" : words(locale).price,
    is_uae: variant === "home-pickup-refused",
    is_home_pickup: variant === "home-pickup-refused",
    media: SCENE_PHOTO,
    destination_ids: ["d1", "d2"],
    stay_ids: variant === "editor" ? ["s2"] : [],
    text: { en: textOf("en"), ar: textOf("ar"), es: textOf("es") },
    status: { en: "published", ar: published ? "published" : "draft", es: published ? "published" : "draft" },
  };
}

const REFUSED: OpsError = { code: "invalid", field: "is_home_pickup", locale: null, detail: null };

function CatalogItemsScene({ ctx, variant }: { ctx: SceneContext; variant: Variant }) {
  const locale = ctx.locale as Locale3;
  const [form, setForm] = useState<CatalogItemForm>(() => formOf(variant, locale));
  const noop = () => undefined;
  const filtered = variant === "list-filtered";
  const filter: CatalogFilter = filtered ? { kind: "service", destinationId: "d1", stayId: "", query: "" } : { kind: "", destinationId: "", stayId: "", query: "" };
  const warnings: PublishWarningCode[] = variant === "published-no-price" ? ["no_price"] : [];

  const panel: CatalogPanel | null = filtered
    ? null
    : {
        form,
        saved: { en: textOf("en"), ar: textOf("ar"), es: textOf("es") },
        onForm: setForm,
        // Opened clean: with unsaved changes the kit's Back guard asks "Discard changes?" on load in dev (strict effects).
        dirty: false,
        busy: false,
        destinations: destinationsOf(locale),
        stays: staysOf(locale),
        warnings,
        error: variant === "home-pickup-refused" ? REFUSED : null,
        onSave: () => Promise.resolve(false),
        onPublish: noop,
        onUnpublish: noop,
        onDelete: noop,
        onClose: noop,
      };

  return (
    <Frame locale={locale}>
      <CatalogItemsView
        rows={rowsOf(locale)}
        destinations={destinationsOf(locale)}
        stays={staysOf(locale)}
        onNew={noop}
        onOpen={noop}
        onMove={noop}
        onDropOrder={noop}
        panel={panel}
        initialFilter={filter}
      />
    </Frame>
  );
}

export const scenes: Scenes = {
  "list-filtered": (ctx) => <CatalogItemsScene ctx={ctx} variant="list-filtered" />,
  editor: (ctx) => <CatalogItemsScene ctx={ctx} variant="editor" />,
  "editor-translations": (ctx) => <CatalogItemsScene ctx={ctx} variant="editor" />,
  "editor-home-pickup-refused": (ctx) => <CatalogItemsScene ctx={ctx} variant="home-pickup-refused" />,
  "editor-published-no-price": (ctx) => <CatalogItemsScene ctx={ctx} variant="published-no-price" />,
};

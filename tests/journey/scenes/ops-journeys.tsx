"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees, in preview mode, so the rail and the density match the real screen (as ops-kit.tsx).
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { JourneysView, type JourneyPanel, type JourneyRow } from "../../../app/dashboard/(ops)/catalog/packages/journeys-screen";
import type { JourneyForm, JourneyText } from "../../../app/dashboard/(ops)/catalog/packages/journey-forms";
import type { Locale3 } from "../../../components/ops/api-types";
import type { SceneContext, Scenes } from "../scene-types";
import { AMOUNT_PLACEHOLDER, JOURNEY_PHOTO, numberedTeam, teamWords } from "./_ops-team-words";

/**
 * Every state of Catalog -> Packages, the three home journeys (plan 03.2-08), bracket data only, props-only: no request
 * is made. The price line is a bracket and its reading shows [AMOUNT]: never an amount the owner has not written.
 * Test-only.
 */
type Variant = "list" | "editor" | "price-unreadable" | "hidden";

/** The kit reads the almar-locale cookie and the shell does too; the harness picks the language from ?l=, so set it first. */
function Frame({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

/** The list shows the English name and price line (name_en, price_label_en), whatever the dashboard language. */
const ROWS: JourneyRow[] = [1, 2, 3].map((n) => ({
  id: `j${n}`,
  name: numberedTeam("en", "journey", n),
  priceLine: teamWords("en").priceLine,
  published: n !== 3,
}));

function textOf(locale: Locale3): JourneyText {
  const w = teamWords(locale);
  return {
    name: numberedTeam(locale, "journey", 1),
    price_label: w.priceLine,
    tagline: w.tagline,
    duration_label: w.duration,
    ideal_for_label: w.idealForLabel,
    ideal_for: w.idealFor,
    body: w.description,
  };
}

function formOf(variant: Exclude<Variant, "list">): JourneyForm {
  const published = variant !== "hidden";
  return {
    id: "j1",
    slug: "[web-address]",
    published,
    is_featured: false,
    // Hidden: no photo, so Publish says what it needs. (An empty Arabic or Spanish line is not a gap for Maria: the next
    // Save fills it, so the kit does not list it.)
    media: variant === "hidden" ? null : JOURNEY_PHOTO,
    text: { en: textOf("en"), ar: textOf("ar"), es: textOf("es") },
    status: { en: "published", ar: published ? "published" : "draft", es: published ? "published" : "draft" },
    price_from: variant === "price-unreadable" ? null : { amount: AMOUNT_PLACEHOLDER, currency: "USD" },
    price_estimate: null,
  };
}

function JourneysScene({ ctx, variant }: { ctx: SceneContext; variant: Variant }) {
  const locale = ctx.locale as Locale3;
  const [form, setForm] = useState<JourneyForm | null>(() => (variant === "list" ? null : formOf(variant)));
  const noop = () => undefined;

  const panel: JourneyPanel | null = form
    ? {
        form,
        saved: form.text,
        onForm: setForm,
        dirty: false,
        busy: false,
        error: null,
        onSave: () => Promise.resolve(false),
        onPublish: noop,
        onUnpublish: noop,
        onClose: noop,
      }
    : null;

  return (
    <Frame locale={locale}>
      <JourneysView rows={ROWS} onOpen={noop} onMove={noop} onDropOrder={noop} panel={panel} />
    </Frame>
  );
}

export const scenes: Scenes = {
  "journey-list": (ctx) => <JourneysScene ctx={ctx} variant="list" />,
  "journey-editor": (ctx) => <JourneysScene ctx={ctx} variant="editor" />,
  "journey-editor-price-unreadable": (ctx) => <JourneysScene ctx={ctx} variant="price-unreadable" />,
  "journey-editor-hidden": (ctx) => <JourneysScene ctx={ctx} variant="hidden" />,
};

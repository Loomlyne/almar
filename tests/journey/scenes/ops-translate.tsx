"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees, in preview mode, so the rail and the density match the real screens (as ops-kit.tsx).
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { EditPanel } from "../../../components/ops/edit-panel";
import { LocaleTabs } from "../../../components/ops/locale-tabs";
import { PublishBar } from "../../../components/ops/publish-bar";
import { TranslateButton, TranslateButtonView, type TranslateView } from "../../../components/ops/translate-button";
import type { Locale3, TranslationState } from "../../../components/ops/api-types";
import { Field } from "../../../components/ui/field";
import type { SceneContext, Scenes } from "../scene-types";

/**
 * Every state of the Translate button (plan 03.2-10), in the kit's edit panel on the EN tab, bracket data only. The
 * button sits in LocaleTabs' `toolbar` slot, where the wave-4 screens place it. No request is made: `idle` and
 * `disabled-no-english` render the real TranslateButton; the other states render its view in that state. Test-only.
 * The `live` variants (scene file ops-translate-live.tsx, kept apart so the signed pictures' state list never grows)
 * render the real button wired to /api/ops/translate, which the spec answers with page.route; every onDrafts call is
 * written to a hidden log.
 */
type Text = { details: string; name: string; shortLine: string; description: string; nameValue: string; shortValue: string; descriptionValue: string };

const TEXT: Record<Locale3, Text> = {
  en: {
    details: "Details",
    name: "Name",
    shortLine: "Short line",
    description: "Description",
    nameValue: "[Name]",
    shortValue: "[Short line]",
    descriptionValue: "[Description]",
  },
  ar: {
    details: "التفاصيل",
    name: "الاسم",
    shortLine: "سطر قصير",
    description: "الوصف",
    nameValue: "[الاسم]",
    shortValue: "[سطر قصير]",
    descriptionValue: "[الوصف]",
  },
  es: {
    details: "Detalles",
    name: "Nombre",
    shortLine: "Línea breve",
    description: "Descripción",
    nameValue: "[Nombre]",
    shortValue: "[Línea breve]",
    descriptionValue: "[Descripción]",
  },
};

/** The kit reads the almar-locale cookie; the harness picks the language from ?l=, so set it first. */
function Frame({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

type Variant = "idle" | "disabled-no-english" | "live" | "live-existing" | Exclude<TranslateView, "idle">;

/** Which AR / ES tabs hold text in each picture: after a run the filled tabs are drafts. */
function tabStates(variant: Variant): Record<Locale3, TranslationState> {
  if (variant === "disabled-no-english") return { en: "missing", ar: "missing", es: "missing" };
  if (variant === "done" || variant === "confirm") return { en: "published", ar: "draft", es: "draft" };
  if (variant === "partial-ar") return { en: "published", ar: "draft", es: "missing" };
  return { en: "published", ar: "missing", es: "missing" };
}

/** Hidden record of every onDrafts call (target and field names), so a test can count them. */
function DraftLog({ entries }: { entries: string[] }) {
  return (
    <output data-testid="ops-translate-log" className="sr-only">
      {entries.join(" | ")}
    </output>
  );
}

export function TranslateScene({ ctx, variant }: { ctx: SceneContext; variant: Variant }) {
  const locale = ctx.locale as Locale3;
  const t = TEXT[locale];
  const empty = variant === "disabled-no-english";
  const [values, setValues] = useState(() =>
    empty ? { name: "", short: "", description: "" } : { name: t.nameValue, short: t.shortValue, description: t.descriptionValue },
  );
  const source = { name: values.name, short_line: values.short, summary: values.description };
  const noop = () => undefined;
  const live = variant === "live" || variant === "live-existing";
  const [log, setLog] = useState<string[]>([]);
  const [filled, setFilled] = useState<{ ar: boolean; es: boolean }>({ ar: variant === "live-existing", es: variant === "live-existing" });
  const tabs = live
    ? { en: "published" as const, ar: filled.ar ? ("draft" as const) : ("missing" as const), es: filled.es ? ("draft" as const) : ("missing" as const) }
    : tabStates(variant);

  const button = live ? (
    <TranslateButton
      source={source}
      hasExisting={variant === "live-existing"}
      onDrafts={(target, fields) => {
        setLog((l) => [...l, `${target}:${Object.keys(fields).sort().join(",")}`]);
        setFilled((f) => ({ ...f, [target]: true }));
      }}
      locale={locale}
    />
  ) : variant === "idle" || variant === "disabled-no-english" ? (
      <TranslateButton source={source} hasExisting={false} onDrafts={noop} locale={locale} />
    ) : (
      <TranslateButtonView view={variant} locale={locale} onTranslate={noop} onConfirm={noop} onKeep={noop} />
    );

  return (
    <Frame locale={locale}>
      <EditPanel
        open
        onOpenChange={noop}
        title={t.nameValue}
        tabs={[{ key: "details", label: t.details }]}
        tab="details"
        onTabChange={noop}
        dirty={false}
        footer={
          <PublishBar
            isNew={false}
            isPublished={false}
            dirty={false}
            busy={false}
            missing={[]}
            warnings={[]}
            error={null}
            fieldLabel={() => undefined}
            onSave={noop}
            onPublish={noop}
            onUnpublish={noop}
            onDelete={noop}
          />
        }
      >
        <LocaleTabs value="en" onChange={noop} state={tabs} checked={{ ar: false, es: false }} onCheckedChange={noop} toolbar={button}>
          <Field id="tr-name" label={t.name} className="max-w-none" value={values.name} onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))} />
          <Field id="tr-short" label={t.shortLine} className="max-w-none" value={values.short} onChange={(event) => setValues((v) => ({ ...v, short: event.target.value }))} />
          <Field
            id="tr-description"
            label={t.description}
            className="max-w-none"
            multiline
            value={values.description}
            onChange={(event) => setValues((v) => ({ ...v, description: event.target.value }))}
          />
        </LocaleTabs>
        {live ? <DraftLog entries={log} /> : null}
      </EditPanel>
    </Frame>
  );
}

export const scenes: Scenes = {
  idle: (ctx) => <TranslateScene ctx={ctx} variant="idle" />,
  "disabled-no-english": (ctx) => <TranslateScene ctx={ctx} variant="disabled-no-english" />,
  confirm: (ctx) => <TranslateScene ctx={ctx} variant="confirm" />,
  busy: (ctx) => <TranslateScene ctx={ctx} variant="busy" />,
  done: (ctx) => <TranslateScene ctx={ctx} variant="done" />,
  partial: (ctx) => <TranslateScene ctx={ctx} variant="partial-ar" />,
  limit: (ctx) => <TranslateScene ctx={ctx} variant="limit" />,
  failed: (ctx) => <TranslateScene ctx={ctx} variant="failed" />,
};

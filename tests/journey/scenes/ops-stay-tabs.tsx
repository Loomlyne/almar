"use client";

import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";
// The ops shell the owner sees (job 02), as in the ops-kit and ops-media scenes.
import { OpsShell } from "../../../app/dashboard/(ops)/ops-shell";
import { stayTabSections, type StaySectionKey } from "../../../app/dashboard/(ops)/catalog/stays/stay-tab-sections";
import { EditPage } from "../../../components/ops/edit-page";
import type { Locale3 } from "../../../components/ops/api-types";
import { Field } from "../../../components/ui/field";
import { DASHBOARD_COPY } from "../../../lib/copy/dashboard";
import type { SceneContext, Scenes } from "../scene-types";

/**
 * Plan 03.2-15: the stay editor's Rates, Availability and Access cards inside the kit EditPage (option B), for the
 * owner's signature. 03.2-07's stay editor is not on main yet, so its own sections are one bracket stand-in card (the
 * English name, the one translated field) so the page shows where the cards sit and both kinds of Save.
 * Every /api/ops/* request goes through the real kit client: tests/ops-stay-tabs.spec.ts answers it with fixtures
 * (bracket values only, never a rate). Test-only.
 */
const TEXT: Record<Locale3, { stayName: string; name: string; text: string }> = {
  en: { stayName: "[Stay name]", name: "Name", text: "Text" },
  ar: { stayName: "[اسم الإقامة]", name: "الاسم", text: "النص" },
  es: { stayName: "[Nombre de la estancia]", name: "Nombre", text: "Texto" },
};

/** The kit reads the almar-locale cookie and the shell does too; the harness picks the language from ?l=, so set it first. */
function Frame({ locale, children }: { locale: Locale3; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    document.cookie = `almar-locale=${locale}; path=/`;
    setReady(true);
  }, [locale]);
  return ready ? <OpsShell mode="preview">{children}</OpsShell> : null;
}

/** The fixture stay's id: the spec answers every request for it. */
export const STAY_ID = "00000000-0000-4000-8000-000000000015";

function StayEditor({ ctx, isNew = false }: { ctx: SceneContext; isNew?: boolean }) {
  const locale = ctx.locale as Locale3;
  const t = TEXT[locale];
  const rail = DASHBOARD_COPY[locale].rail;
  const [name, setName] = useState(isNew ? "" : t.stayName);
  const [savedName] = useState(isNew ? "" : t.stayName);
  const [cardsDirty, setCardsDirty] = useState<Record<StaySectionKey, boolean>>({ rates: false, availability: false, access: false });
  const onDirtyChange = useCallback((key: StaySectionKey, dirty: boolean) => {
    setCardsDirty((was) => (was[key] === dirty ? was : { ...was, [key]: dirty }));
  }, []);
  // 03.2-07's `dirty` will be an OR of its parts; the cards add theirs.
  const dirty = name !== savedName || Object.values(cardsDirty).some(Boolean);

  return (
    <Frame locale={locale}>
      <EditPage
        openKey={isNew ? "new" : STAY_ID}
        list={<div />}
        backLabel={rail.stays}
        onClose={() => undefined}
        title={name || t.stayName}
        isNew={isNew}
        isPublished={false}
        dirty={dirty}
        missing={[]}
        error={null}
        english={{ name }}
        savedEnglish={{ name: savedName }}
        translations={{ ar: { name: "" }, es: { name: "" } }}
        translationFields={[{ name: "name", label: t.name }]}
        onTranslationChange={() => undefined}
        onSave={async () => true}
        onPublish={() => undefined}
        sections={[
          {
            key: "text",
            title: t.text,
            translatable: true,
            content: (
              <Field id="stay-name" label={t.name} className="max-w-none" lang="en" dir="ltr" value={name} onChange={(event) => setName(event.target.value)} />
            ),
          },
          ...stayTabSections({ stayId: isNew ? null : STAY_ID, locale, onDirtyChange }),
        ]}
      />
    </Frame>
  );
}

const editor = (ctx: SceneContext) => <StayEditor ctx={ctx} />;

/** The state names pick the spec's fixtures and steps; the page is the same editor in each. */
export const scenes: Scenes = {
  rates: editor,
  "rates-empty": editor,
  "rates-overlap": editor,
  "rates-check": editor,
  availability: editor,
  access: editor,
  "two-saves": editor,
  "new-stay": (ctx) => <StayEditor ctx={ctx} isNew />,
};

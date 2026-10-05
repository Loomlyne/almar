"use client";

import { useId, type ReactNode } from "react";
import { Checkbox } from "../ui/checkbox";
import { Chip } from "../ui/chip";
import { OPS_KIT_COPY, type OpsKitCopy } from "../../lib/copy/ops-kit";
import type { Locale3, TranslationState } from "./api-types";
import { TabList, panelId, tabId, type TabItem } from "./tab-list";
import { useDashboardLocale } from "./use-dashboard-locale";

const LOCALES: readonly Locale3[] = ["en", "ar", "es"];

function StateChip({ state, copy }: { state: TranslationState; copy: OpsKitCopy }) {
  return (
    <Chip interactive={false} size="dense" on={state === "published"} muted={state === "missing"}>
      {state === "published" ? copy.published : state === "draft" ? copy.draft : copy.missing}
    </Chip>
  );
}

/**
 * EN / AR / ES tabs for one record. Arabic and Spanish carry a Draft / Missing / Published chip and the one checkbox
 * that turns a draft into published text ("I checked this translation", C-08). The fields of the chosen language are
 * the children, wrapped with its lang and dir. `toolbar` is the slot for the Translate button (03.2-10).
 */
export function LocaleTabs({
  value,
  onChange,
  state,
  checked,
  onCheckedChange,
  toolbar,
  children,
}: {
  value: Locale3;
  onChange: (locale: Locale3) => void;
  state: Record<Locale3, TranslationState>;
  checked: { ar: boolean; es: boolean };
  onCheckedChange: (locale: "ar" | "es", checked: boolean) => void;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const copy = OPS_KIT_COPY[useDashboardLocale()];
  const idBase = useId();
  const items: TabItem[] = LOCALES.map((locale) => ({
    key: locale,
    label: locale.toUpperCase(),
    adornment: locale === "en" ? undefined : <StateChip state={state[locale]} copy={copy} />,
  }));
  const reviewed = value === "ar" || value === "es" ? value : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TabList
        idBase={idBase}
        label={copy.languageTabs}
        items={items}
        value={value}
        onChange={(key) => onChange(key as Locale3)}
      />
      {reviewed || toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">{toolbar}</div>
          {reviewed ? (
            <Checkbox
              label={copy.checkedTranslation}
              checked={checked[reviewed]}
              disabled={state[reviewed] === "missing"}
              onChange={(event) => onCheckedChange(reviewed, event.target.checked)}
            />
          ) : null}
        </div>
      ) : null}
      {reviewed && state[reviewed] === "draft" ? <p className="m-0 text-label text-muted">{copy.draftNote}</p> : null}
      <div
        role="tabpanel"
        id={panelId(idBase)}
        aria-labelledby={tabId(idBase, value)}
        lang={value}
        dir={value === "ar" ? "rtl" : "ltr"}
        className="flex min-w-0 flex-col gap-4"
      >
        {children}
      </div>
    </div>
  );
}

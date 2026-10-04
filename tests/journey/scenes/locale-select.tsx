"use client";

import { useState } from "react";
import { LocaleSelect } from "../../../components/ui/locale-select";
import type { Scenes } from "../scene-types";
import { harnessHref } from "./_images";

function Language({ withHrefs, evil = false }: { withHrefs: boolean; evil?: boolean }) {
  const [value, setValue] = useState("en");
  const hrefs = evil
    ? { en: harnessHref("en"), ar: "https://example.com/ar", es: "//example.com/es" }
    : { en: harnessHref("en"), ar: harnessHref("ar"), es: harnessHref("es") };
  return (
    <div data-testid="harness-locale-select" className="p-4">
      <LocaleSelect
        kind="language"
        value={value}
        onChange={setValue}
        hrefs={withHrefs ? hrefs : undefined}
        id="scene-language"
      />
      <output data-testid="language-value">{value}</output>
    </div>
  );
}

function Currency({ start }: { start: string | null }) {
  const [value, setValue] = useState<string | null>(start);
  const [calls, setCalls] = useState(0);
  return (
    <div data-testid="harness-locale-select" className="p-4">
      <LocaleSelect
        kind="currency"
        value={value}
        placeholder="[Currency]"
        onChange={(next) => {
          setValue(next);
          setCalls((n) => n + 1);
        }}
      />
      <output data-testid="currency-value">{value ?? "none"}</output>
      <output data-testid="currency-calls">{calls}</output>
    </div>
  );
}

export const scenes: Scenes = {
  hrefs: () => <Language withHrefs />,
  "no-hrefs": () => <Language withHrefs={false} />,
  "bad-hrefs": () => <Language withHrefs evil />,
  "currency-none": () => <Currency start={null} />,
  "currency-aed": () => <Currency start="AED" />,
};
